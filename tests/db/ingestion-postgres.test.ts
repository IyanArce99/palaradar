// Comprueba el repositorio de ingestión contra PostgreSQL real. Todo ocurre
// dentro de una transacción que se deshace al final: no deja datos en la base.
// Solo se ejecuta con `npm run test:db` (necesita DATABASE_URL).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadDevSeed, refreshPriceStats, upsertCatalog } from "@/data/db/admin";
import { createSql, getDatabaseUrl, getQueryCount, type Sql } from "@/data/db/client";
import { createPostgresRepository } from "@/data/postgres-repository";
import { buildSeed } from "@/data/seed/build";
import { createMockAdapter, GTIN_METALBONE_34_2025, MOCK_STORE_SLUG, mockScenario } from "@/ingestion/adapters/mock";
import { createMemoryIngestionRepository } from "@/ingestion/memory-repository";
import { createPostgresIngestionRepository } from "@/ingestion/postgres-repository";
import { runIngestion } from "@/ingestion/run";
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
