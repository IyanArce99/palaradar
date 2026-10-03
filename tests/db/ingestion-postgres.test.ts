// Comprueba el repositorio de ingestión contra PostgreSQL real. Todo ocurre
// dentro de una transacción que se deshace al final: no deja datos en la base.
// Solo se ejecuta con `npm run test:db` (necesita DATABASE_URL).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countStoreData,
  loadDevSeed,
  purgeDemoData,
  refreshPriceStats,
  upsertCatalog,
} from "@/data/db/admin";
import { createSql, getDatabaseUrl, getQueryCount, type Sql } from "@/data/db/client";
import { createPostgresRepository } from "@/data/postgres-repository";
import { buildSeed } from "@/data/seed/build";
import { createMockAdapter, GTIN_METALBONE_34_2025, MOCK_STORE_SLUG, mockScenario } from "@/ingestion/adapters/mock";
import { createMemoryIngestionRepository } from "@/ingestion/memory-repository";
import { createPostgresIngestionRepository, listPendingReview } from "@/ingestion/postgres-repository";
import { INTERRUPTED_RUN_MESSAGE } from "@/ingestion/repository";
import { IngestionLockedError, runIngestion } from "@/ingestion/run";
import type { StoreListing } from "@/ingestion/types";
import { GOLDEN_DAYS, goldenRuns } from "../ingestion/golden-scenario";

const url = getDatabaseUrl();
const ROLLBACK = new Error("rollback");

const DAY_1 = new Date("2026-10-05T06:00:00Z");
const DAY_2 = new Date("2026-10-06T06:00:00Z");

/** Tienda ficticia que el test hace pasar por real; nunca llega a guardarse. */
const REAL_TEST_STORE = "tienda-real-de-test";
const METALBONE_SLUG = "adidas-metalbone-3-4-2025";

/** Ejecuta `work` en una transacción que siempre se deshace. */
async function rolledBack(work: (tx: Sql) => Promise<void>): Promise<void> {
  const sql = createSql(url as string, 1);
  try {
    await sql.begin(async (transaction) => {
      await work(transaction as unknown as Sql);
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  } finally {
    await sql.end();
  }
}

function metalbone(price: number, at: Date): StoreListing {
  return {
    externalId: "MB34",
    title: "Pala Adidas Metalbone 3.4 2025",
    brand: "Adidas",
    ean: GTIN_METALBONE_34_2025,
    url: "https://example.com/producto/MB34",
    price,
    listPrice: null,
    available: true,
    checkedAt: at.toISOString(),
  };
}

async function tableCounts(tx: Sql) {
  const [counts] = await tx<{ prices: number; history: number; products: number; runs: number; stores: number }[]>`
    select (select count(*)::int from store_prices) as prices,
           (select count(*)::int from price_history) as history,
           (select count(*)::int from store_products) as products,
           (select count(*)::int from ingestion_runs) as runs,
           (select count(*)::int from stores) as stores`;
  return counts;
}

describe("ingestión sobre PostgreSQL", { skip: !url && "DATABASE_URL no configurada" }, () => {
  it("guarda productos, precios, histórico y ejecuciones como el repositorio en memoria", async () => {
    await rolledBack(async (tx) => {
      const repository = createPostgresIngestionRepository(tx);
      const scenario = mockScenario(DAY_1.toISOString(), DAY_2.toISOString());
      const store = { storeSlug: REAL_TEST_STORE, isDemo: false };

      const first = await runIngestion(createMockAdapter(scenario.firstRun, store), repository, DAY_1);
      assert.equal(first.status, "success", first.errorMessage ?? "");
      assert.equal(first.productsSeen, 5);
      assert.equal(first.productsMatched, 4);
      assert.equal(first.pricesUpdated, 3);

      const second = await runIngestion(createMockAdapter(scenario.secondRun, store), repository, DAY_2);
      assert.equal(second.status, "success", second.errorMessage ?? "");
      assert.equal(second.pricesUpdated, 2);

      const products = await tx<{ external_id: string; matching_status: string; matching_method: string | null; listing_status: string; missed_runs: number; gtin: string | null }[]>`
        select p.external_id, p.matching_status, p.matching_method, p.listing_status, p.missed_runs, p.gtin
        from store_products p join stores s on s.id = p.store_id
        where s.slug = ${REAL_TEST_STORE}`;
      const byId = new Map(products.map((product) => [product.external_id, product]));

      assert.equal(products.length, 6);
      assert.equal(byId.get("MB34")?.matching_method, "gtin");
      assert.equal(byId.get("MB34")?.gtin, "08435739402740");
      assert.equal(byId.get("EQ27")?.matching_method, "attributes");
      assert.equal(byId.get("V04")?.matching_status, "rejected");
      assert.equal(byId.get("KYRA")?.listing_status, "out_of_stock");
      assert.equal(byId.get("DRAX")?.missed_runs, 1);

      const [price] = await tx<{ current_price: number; previous_price: number | null; checked_at: string }[]>`
        select sp.current_price, sp.previous_price, sp.checked_at
        from store_prices sp
        join stores s on s.id = sp.store_id
        join rackets r on r.id = sp.racket_id
        where s.slug = ${REAL_TEST_STORE} and r.slug = ${METALBONE_SLUG}`;
      assert.equal(price.current_price, 229.95);
      assert.equal(price.previous_price, 249.95);
      assert.equal(price.checked_at, DAY_2.toISOString());

      const history = await tx<{ price_date: string; price: number }[]>`
        select h.price_date, h.price
        from price_history h
        join stores s on s.id = h.store_id
        join rackets r on r.id = h.racket_id
        where s.slug = ${REAL_TEST_STORE} and r.slug = ${METALBONE_SLUG}
        order by h.price_date`;
      assert.deepEqual(
        history.map((row) => [row.price_date, row.price]),
        [["2026-10-05", 249.95], ["2026-10-06", 229.95]],
      );

      const runs = await tx<{ status: string; products_seen: number; prices_updated: number }[]>`
        select r.status, r.products_seen, r.prices_updated
        from ingestion_runs r join stores s on s.id = r.store_id
        where s.slug = ${REAL_TEST_STORE} order by r.started_at`;
      assert.deepEqual(runs.map((run) => run.status), ["success", "success"]);
      assert.equal(runs[0].products_seen, 5);

      // Los agregados del catálogo reflejan el precio nuevo.
      const [stats] = await tx<{ best_price: number }[]>`
        select st.best_price from racket_price_stats st
        join rackets r on r.id = st.racket_id where r.slug = ${METALBONE_SLUG}`;
      assert.ok(stats.best_price <= 229.95);
    });
  });

  it("conserva el histórico cuando el producto desaparece de la tienda", async () => {
    await rolledBack(async (tx) => {
      const repository = createPostgresIngestionRepository(tx);
      const store = { storeSlug: REAL_TEST_STORE, isDemo: false };
      const day3 = new Date("2026-10-07T06:00:00Z");

      await runIngestion(createMockAdapter([metalbone(249.95, DAY_1)], store), repository, DAY_1);
      await runIngestion(createMockAdapter([], store), repository, DAY_2);
      await runIngestion(createMockAdapter([], store), repository, day3);

      const [state] = await tx<{ published: number; history: number; listing_status: string }[]>`
        select (select count(*)::int from store_prices p where p.store_id = s.id) as published,
               (select count(*)::int from price_history h where h.store_id = s.id) as history,
               (select listing_status from store_products p where p.store_id = s.id) as listing_status
        from stores s where s.slug = ${REAL_TEST_STORE}`;

      assert.equal(state.listing_status, "missing");
      assert.equal(state.published, 0);
      assert.equal(state.history, 1);
    });
  });
});

describe("ingestión por lotes sobre PostgreSQL", { skip: !url && "DATABASE_URL no configurada" }, () => {
  const store = { storeSlug: REAL_TEST_STORE, isDemo: false };
  const byKey = <T>(key: (item: T) => string) => (a: T, b: T) => key(a).localeCompare(key(b));

  it("deja en la base de datos lo mismo que el repositorio en memoria", async () => {
    await rolledBack(async (tx) => {
      const postgres = createPostgresIngestionRepository(tx);
      // Mismo catálogo y misma tienda en los dos repositorios.
      const storeRow = await postgres.ensureStore(createMockAdapter([], store).store);
      const memory = createMemoryIngestionRepository([storeRow], await postgres.loadCatalog());

      for (const [index, listings] of goldenRuns().entries()) {
        const adapter = createMockAdapter(listings, store);
        const inMemory = await runIngestion(adapter, memory, GOLDEN_DAYS[index]);
        const inPostgres = await runIngestion(adapter, postgres, GOLDEN_DAYS[index]);

        assert.equal(inPostgres.status, "success", inPostgres.errorMessage ?? "");
        for (const field of ["productsSeen", "productsMatched", "productsPending", "pricesUpdated", "productsInvalid", "pricesHeld"] as const) {
          assert.equal(inPostgres[field], inMemory[field], `${field} en la lectura ${index + 1}`);
        }
      }

      const products = await postgres.listStoreProducts(storeRow.id);
      assert.ok(products.length >= 9);
      assert.deepEqual(
        products.sort(byKey((product) => product.externalId)),
        [...memory.state.storeProducts].sort(byKey((product) => product.externalId)),
      );

      assert.deepEqual(
        (await postgres.listPublishedPrices(storeRow.id)).sort(byKey((price) => price.racketId)),
        [...memory.state.publishedPrices].sort(byKey((price) => price.racketId)),
      );

      const history = await tx<{ racket_id: string; store_id: string; price: number; price_date: string }[]>`
        select racket_id, store_id, price, price_date from price_history where store_id = ${storeRow.id}`;
      const historyKey = byKey((row: { racket_id: string; price_date: string }) => `${row.racket_id} ${row.price_date}`);
      assert.deepEqual(
        history.map((row) => ({ ...row })).sort(historyKey),
        [...memory.state.priceHistory].sort(historyKey),
      );
    });
  });

  it("el número de consultas no depende del número de productos", async () => {
    await rolledBack(async (tx) => {
      const repository = createPostgresIngestionRepository(tx);
      const now = new Date();
      // Más productos que el tamaño de un lote, para ejercitar el troceado.
      const listings: StoreListing[] = Array.from({ length: 1200 }, (_, i) => ({
        externalId: `SYN-${i}`,
        title: `Pala Marca Inventada Modelo ${i} 2026`,
        brand: "Marca Inventada",
        ean: null,
        url: `https://example.com/producto/SYN-${i}`,
        price: 100 + i,
        listPrice: null,
        available: true,
        checkedAt: now.toISOString(),
      }));
      listings.push(metalbone(249.95, now));

      const before = getQueryCount();
      const summary = await runIngestion(createMockAdapter(listings, store), repository, now);
      const queries = getQueryCount() - before;

      assert.equal(summary.status, "success", summary.errorMessage ?? "");
      assert.equal(summary.productsSeen, 1201);
      assert.equal(summary.productsMatched, 1);

      const [{ count }] = await tx<{ count: number }[]>`
        select count(*)::int as count from store_products p
        join stores s on s.id = p.store_id where s.slug = ${REAL_TEST_STORE}`;
      assert.equal(count, 1201);
      assert.ok(queries <= 25, `la ejecución ha hecho ${queries} consultas`);
    });
  });
});

describe("tiendas reales y de demostración", { skip: !url && "DATABASE_URL no configurada" }, () => {
  // Un precio imposible de batir: si una tienda cuenta, será el mejor precio.
  const CHEAPEST = 1;

  async function bestPrice(tx: Sql): Promise<number | null> {
    const [row] = await tx<{ best_price: number }[]>`
      select st.best_price from racket_price_stats st
      join rackets r on r.id = st.racket_id where r.slug = ${METALBONE_SLUG}`;
    return row?.best_price ?? null;
  }

  it("una tienda demo no participa en el mejor precio, las ofertas, el histórico ni los agregados", async () => {
    await rolledBack(async (tx) => {
      const now = new Date();
      const adapter = createMockAdapter([metalbone(CHEAPEST, now)], { shipping: { cost: 0, freeFrom: null } });
      assert.equal(adapter.store.isDemo, true);

      const summary = await runIngestion(adapter, createPostgresIngestionRepository(tx), now);
      assert.equal(summary.status, "success", summary.errorMessage ?? "");

      // El precio demo está guardado, pero no cuenta.
      const [stored] = await tx<{ current_price: number }[]>`
        select sp.current_price from store_prices sp
        join stores s on s.id = sp.store_id join rackets r on r.id = sp.racket_id
        where s.slug = ${MOCK_STORE_SLUG} and r.slug = ${METALBONE_SLUG}`;
      assert.equal(stored.current_price, CHEAPEST);

      assert.notEqual(await bestPrice(tx), CHEAPEST);

      const pala = await createPostgresRepository(tx).getPalaBySlug(METALBONE_SLUG);
      assert.ok(pala);
      assert.ok((pala.price?.offers ?? []).every((offer) => offer.store.slug !== MOCK_STORE_SLUG));
      assert.notEqual(pala.price?.current, CHEAPEST);
      assert.ok(pala.priceHistory.every((point) => point.price !== CHEAPEST));

      const catalog = await createPostgresRepository(tx).searchCatalog({
        q: "metalbone 3.4 2025", collection: "todas", levels: [], styles: [], brands: [], shapes: [],
        balances: [], years: [], maxPrice: null, sort: "precio", page: 1,
      });
      assert.ok(catalog.items.every((item) => item.price !== CHEAPEST));
    });
  });

  it("ninguna tienda demo aparece en la ficha de ninguna pala", async () => {
    await rolledBack(async (tx) => {
      const demo = new Set(
        (await tx<{ slug: string }[]>`select slug from stores where is_demo`).map((row) => row.slug),
      );
      const repository = createPostgresRepository(tx);

      for (const slug of await repository.getAllPalaSlugs()) {
        const pala = await repository.getPalaBySlug(slug);
        for (const offer of pala?.price?.offers ?? []) {
          assert.equal(demo.has(offer.store.slug), false, `${slug} muestra la tienda demo ${offer.store.slug}`);
        }
      }

      const [{ count }] = await tx<{ count: number }[]>`
        select count(*)::int as count from racket_price_stats st
        join stores s on s.id = st.best_store_id where s.is_demo`;
      assert.equal(count, 0);
    });
  });

  it("una tienda real sí participa", async () => {
    await rolledBack(async (tx) => {
      const now = new Date();
      const adapter = createMockAdapter([metalbone(CHEAPEST, now)], {
        storeSlug: REAL_TEST_STORE,
        isDemo: false,
        shipping: { cost: 0, freeFrom: null },
      });

      await runIngestion(adapter, createPostgresIngestionRepository(tx), now);

      assert.equal(await bestPrice(tx), CHEAPEST);
      const pala = await createPostgresRepository(tx).getPalaBySlug(METALBONE_SLUG);
      assert.equal(pala?.price?.current, CHEAPEST);
      assert.equal(pala?.price?.bestOffer.store.slug, REAL_TEST_STORE);
    });
  });

  it("PadelProShop es una tienda real", async () => {
    await rolledBack(async (tx) => {
      const stores = await tx<{ slug: string; is_demo: boolean }[]>`select slug, is_demo from stores`;
      const padelproshop = stores.find((store) => store.slug === "padelproshop");

      assert.ok(padelproshop, "PadelProShop debería estar ya ingerida en esta base de datos");
      assert.equal(padelproshop.is_demo, false);
      assert.ok(stores.filter((store) => store.slug.startsWith("tienda-demo-")).every((store) => store.is_demo));
    });
  });

  it("las tiendas demo solo cuentan si se pide expresamente al calcular los agregados", async () => {
    await rolledBack(async (tx) => {
      const now = new Date();
      const adapter = createMockAdapter([metalbone(CHEAPEST, now)], { shipping: { cost: 0, freeFrom: null } });
      await runIngestion(adapter, createPostgresIngestionRepository(tx), now);

      await refreshPriceStats(tx, now, true);
      assert.equal(await bestPrice(tx), CHEAPEST);

      await refreshPriceStats(tx, now, false);
      assert.notEqual(await bestPrice(tx), CHEAPEST);
    });
  });
});

describe("bloqueo de ingestión en PostgreSQL", { skip: !url && "DATABASE_URL no configurada" }, () => {
  /** Dos procesos distintos: cada uno con sus propias conexiones. */
  async function twoProcesses(work: (a: Sql, b: Sql) => Promise<void>): Promise<void> {
    const a = createSql(url as string, 2);
    const b = createSql(url as string, 2);
    try {
      await work(a, b);
    } finally {
      await Promise.all([a.end(), b.end()]);
    }
  }

  const runCount = async (sql: Sql) =>
    (await sql<{ count: number }[]>`select count(*)::int as count from ingestion_runs`)[0].count;

  it("con una ingestión en marcha, la segunda aborta sin escribir nada", async () => {
    await twoProcesses(async (a, b) => {
      const first = createPostgresIngestionRepository(a);
      const second = createPostgresIngestionRepository(b);
      const runsBefore = await runCount(b);

      const outcome = await first.withIngestionLock(async () => {
        // Mientras la primera tiene el bloqueo, la segunda no llega ni a registrar su ejecución.
        await assert.rejects(
          runIngestion(createMockAdapter([metalbone(1, new Date())], { storeSlug: REAL_TEST_STORE, isDemo: false }), second),
          IngestionLockedError,
        );
        assert.deepEqual(await second.withIngestionLock(async () => "no debería ejecutarse"), { acquired: false });
        return "primera";
      });

      assert.deepEqual(outcome, { acquired: true, value: "primera" });
      assert.equal(await runCount(b), runsBefore);
      const [{ exists }] = await b<{ exists: boolean }[]>`
        select exists (select 1 from stores where slug = ${REAL_TEST_STORE}) as exists`;
      assert.equal(exists, false);
    });
  });

  it("el bloqueo se libera después de una ejecución correcta", async () => {
    await twoProcesses(async (a, b) => {
      await createPostgresIngestionRepository(a).withIngestionLock(async () => "ok");
      assert.deepEqual(
        await createPostgresIngestionRepository(b).withIngestionLock(async () => "segunda"),
        { acquired: true, value: "segunda" },
      );
    });
  });

  it("el bloqueo se libera después de un error", async () => {
    await twoProcesses(async (a, b) => {
      await assert.rejects(
        createPostgresIngestionRepository(a).withIngestionLock(async () => {
          throw new Error("fallo a mitad de la ingestión");
        }),
        /fallo a mitad/,
      );
      assert.deepEqual(
        await createPostgresIngestionRepository(b).withIngestionLock(async () => "segunda"),
        { acquired: true, value: "segunda" },
      );
    });
  });

  it("el bloqueo se libera si el proceso muere con la conexión abierta", async () => {
    await twoProcesses(async (a, b) => {
      let release: () => void = () => {};
      const hanging = new Promise<void>((resolve) => {
        release = resolve;
      });
      const held = createPostgresIngestionRepository(a).withIngestionLock(() => hanging);
      held.catch(() => {});

      const second = createPostgresIngestionRepository(b);
      // Espera a que la primera tenga el bloqueo.
      for (let i = 0; i < 50 && (await second.withIngestionLock(async () => null)).acquired; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.deepEqual(await second.withIngestionLock(async () => null), { acquired: false });

      // Corta las conexiones del primer proceso sin terminar su transacción.
      await a.end({ timeout: 0 });
      release();

      let acquired = false;
      for (let i = 0; i < 50 && !acquired; i++) {
        acquired = (await second.withIngestionLock(async () => null)).acquired;
        if (!acquired) await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(acquired, true);
    });
  });

  it("si una tienda falla se conservan sus precios y la ejecución queda registrada", async () => {
    await rolledBack(async (tx) => {
      const repository = createPostgresIngestionRepository(tx);
      const store = { storeSlug: REAL_TEST_STORE, isDemo: false };

      await runIngestion(createMockAdapter([metalbone(249.95, DAY_1)], store), repository, DAY_1);
      const failed = await runIngestion(
        createMockAdapter([], { ...store, fail: "La tienda no responde" }),
        repository,
        DAY_2,
      );
      assert.equal(failed.status, "failed");

      const [state] = await tx<{ price: number; checked_at: string; history: number; runs: string[] }[]>`
        select sp.current_price as price, sp.checked_at,
               (select count(*)::int from price_history h where h.store_id = s.id) as history,
               array(select r.status::text from ingestion_runs r where r.store_id = s.id order by r.started_at) as runs
        from stores s join store_prices sp on sp.store_id = s.id
        where s.slug = ${REAL_TEST_STORE}`;

      assert.equal(state.price, 249.95);
      assert.equal(state.checked_at, DAY_1.toISOString());
      assert.equal(state.history, 1);
      assert.deepEqual(state.runs, ["success", "failed"]);
    });
  });

  it("una ejecución que quedó «en marcha» se da por fallida en la siguiente", async () => {
    await rolledBack(async (tx) => {
      const repository = createPostgresIngestionRepository(tx);
      const store = await repository.ensureStore(
        createMockAdapter([], { storeSlug: REAL_TEST_STORE, isDemo: false }).store,
      );
      const orphan = await repository.startRun(store.id, DAY_1.toISOString());

      await runIngestion(
        createMockAdapter([metalbone(249.95, DAY_2)], { storeSlug: REAL_TEST_STORE, isDemo: false }),
        repository,
        DAY_2,
      );

      const [run] = await tx<{ status: string; error_message: string }[]>`
        select status, error_message from ingestion_runs where id = ${orphan}`;
      assert.equal(run.status, "failed");
      assert.equal(run.error_message, INTERRUPTED_RUN_MESSAGE);
    });
  });
});

describe("histórico global y por tienda", { skip: !url && "DATABASE_URL no configurada" }, () => {
  const historyOf = async (tx: Sql, storeSlug: string) =>
    tx<{ racket_id: string; price_date: string; price: number }[]>`
      select h.racket_id, h.price_date, h.price from price_history h
      join stores s on s.id = h.store_id where s.slug = ${storeSlug}
      order by h.racket_id, h.price_date`;

  it("distingue el mejor precio del mercado del precio de cada tienda, sin tiendas demo", async () => {
    await rolledBack(async (tx) => {
      const catalog = createPostgresRepository(tx);
      const ingestion = createPostgresIngestionRepository(tx);
      const padelproshopBefore = await historyOf(tx, "padelproshop");
      const before = await catalog.getPriceHistory(METALBONE_SLUG);
      assert.ok(before);

      // Una segunda tienda real, más barata, y una tienda demo más barata todavía.
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const free = { cost: 0, freeFrom: null };
      await runIngestion(
        createMockAdapter([metalbone(2, now)], { storeSlug: REAL_TEST_STORE, isDemo: false, shipping: free }),
        ingestion,
        now,
      );
      await runIngestion(createMockAdapter([metalbone(1, now)], { shipping: free }), ingestion, now);

      const history = await catalog.getPriceHistory(METALBONE_SLUG);
      assert.ok(history);

      // Por tienda: la nueva tiene su propia serie y las demás conservan la suya intacta.
      const stores = history.byStore.map((series) => series.store.slug);
      assert.ok(stores.includes(REAL_TEST_STORE));
      assert.equal(stores.includes(MOCK_STORE_SLUG), false);
      assert.deepEqual(
        history.byStore.find((series) => series.store.slug === REAL_TEST_STORE)?.points,
        [{ date: today, price: 2 }],
      );
      for (const series of before.byStore) {
        assert.deepEqual(
          history.byStore.find((item) => item.store.slug === series.store.slug)?.points,
          series.points,
        );
      }

      // Global: hoy gana la tienda real nueva (no la demo) y cuenta una tienda más.
      const marketToday = history.market.find((point) => point.date === today);
      const beforeToday = before.market.find((point) => point.date === today);
      assert.equal(marketToday?.price, 2);
      assert.equal(marketToday?.store.slug, REAL_TEST_STORE);
      assert.equal(marketToday?.storeCount, (beforeToday?.storeCount ?? 0) + 1);

      // El global coincide con la serie que ya usa el gráfico de la ficha.
      const pala = await catalog.getPalaBySlug(METALBONE_SLUG);
      assert.deepEqual(
        history.market.map(({ date, price }) => ({ date, price })),
        pala?.priceHistory,
      );

      // El histórico de PadelProShop no ha cambiado.
      assert.deepEqual(await historyOf(tx, "padelproshop"), padelproshopBefore);
    });
  });

  it("una pala que no existe no tiene histórico", async () => {
    await rolledBack(async (tx) => {
      assert.equal(await createPostgresRepository(tx).getPriceHistory("no-existe"), null);
    });
  });
});

describe("cola de revisión", { skip: !url && "DATABASE_URL no configurada" }, () => {
  it("los productos ambiguos quedan guardados como pending_review, sin emparejar, y se pueden consultar", async () => {
    await rolledBack(async (tx) => {
      const before = await listPendingReview(tx);
      // Los tres de PadelProShop siguen en revisión, sin pala asignada.
      assert.equal(before.filter((product) => product.store === "padelproshop").length, 3);
      const [{ matched }] = await tx<{ matched: number }[]>`
        select count(*)::int as matched from store_products
        where matching_status = 'pending_review' and (racket_id is not null or matching_method is not null)`;
      assert.equal(matched, 0);

      const store = { storeSlug: REAL_TEST_STORE, isDemo: false };
      const ambiguous: StoreListing = {
        ...metalbone(105, DAY_1),
        externalId: "EQ-SIN",
        title: "Pala Nox Equation Hard Advanced",
        brand: "Nox",
        ean: null,
      };
      const repository = createPostgresIngestionRepository(tx);
      const first = await runIngestion(createMockAdapter([ambiguous], store), repository, DAY_1);
      // Una segunda lectura no lo empareja ni lo saca de la cola.
      await runIngestion(createMockAdapter([{ ...ambiguous, checkedAt: DAY_2.toISOString() }], store), repository, DAY_2);

      assert.equal(first.productsPending, 1);
      const pending = await listPendingReview(tx);
      const added = pending.find((product) => product.store === REAL_TEST_STORE);

      assert.equal(pending.length, before.length + 1);
      assert.equal(added?.externalId, "EQ-SIN");
      assert.ok(added?.note);
      const [{ published }] = await tx<{ published: number }[]>`
        select count(*)::int as published from store_prices sp
        join stores s on s.id = sp.store_id where s.slug = ${REAL_TEST_STORE}`;
      assert.equal(published, 0);
    });
  });
});

describe("limpieza de datos demo", { skip: !url && "DATABASE_URL no configurada" }, () => {
  const TARGET = "base-de-test";

  it("no borra nada sin confirmación o con la confirmación de otra base de datos", async () => {
    await rolledBack(async (tx) => {
      const before = await tableCounts(tx);

      await assert.rejects(purgeDemoData(tx, { confirmation: undefined, target: TARGET }), /No se ha borrado nada/);
      await assert.rejects(purgeDemoData(tx, { confirmation: "otra-base", target: TARGET }), /no coincide/);
      assert.deepEqual(await tableCounts(tx), before);
    });
  });

  it("con confirmación borra solo las tiendas demo y lo que cuelga de ellas", async () => {
    await rolledBack(async (tx) => {
      // Garantiza que hay datos demo que borrar aunque la base ya esté limpia.
      const now = new Date();
      await runIngestion(createMockAdapter([metalbone(1, now)]), createPostgresIngestionRepository(tx), now);

      const demo = await countStoreData(tx, true);
      const real = await countStoreData(tx, false);
      const catalogBefore = await tx<{ rackets: number; brands: number; identifiers: number }[]>`
        select (select count(*)::int from rackets) as rackets, (select count(*)::int from brands) as brands,
               (select count(*)::int from racket_identifiers) as identifiers`;
      const statsBefore = await tx`select racket_id, best_price, best_store_id from racket_price_stats order by racket_id`;
      assert.ok(demo.stores.length > 0 && demo.storePrices > 0 && demo.storeProducts > 0);

      const deleted = await purgeDemoData(tx, { confirmation: TARGET, target: TARGET, now });

      assert.deepEqual(deleted, demo);
      assert.deepEqual(await countStoreData(tx, true), {
        stores: [], storePrices: 0, priceHistory: 0, storeProducts: 0, ingestionRuns: 0, priceStats: 0,
      });
      assert.deepEqual(await countStoreData(tx, false), real);
      assert.deepEqual(
        await tx`
          select (select count(*)::int from rackets) as rackets, (select count(*)::int from brands) as brands,
                 (select count(*)::int from racket_identifiers) as identifiers`,
        catalogBefore,
      );
      assert.deepEqual(
        await tx`select racket_id, best_price, best_store_id from racket_price_stats order by racket_id`,
        statsBefore,
      );
    });
  });
});

describe("seed sobre datos reales", { skip: !url && "DATABASE_URL no configurada" }, () => {
  it("el seed del catálogo no borra tiendas, precios, histórico ni emparejamientos", async () => {
    await rolledBack(async (tx) => {
      const before = await tableCounts(tx);
      await upsertCatalog(tx, buildSeed(new Date()));
      assert.deepEqual(await tableCounts(tx), before);
    });
  });

  it("el seed de desarrollo se niega a borrar datos de tiendas reales", async () => {
    await rolledBack(async (tx) => {
      const before = await tableCounts(tx);
      assert.ok(before.products > 0, "esta base de datos debería tener datos reales de PadelProShop");

      await assert.rejects(loadDevSeed(tx, buildSeed(new Date())), /tiendas reales \(.*padelproshop/);
      await assert.rejects(
        loadDevSeed(tx, buildSeed(new Date()), { force: true, nodeEnv: "production" }),
        /NODE_ENV=production/,
      );
      assert.deepEqual(await tableCounts(tx), before);
    });
  });
});
