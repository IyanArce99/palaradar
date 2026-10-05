// La ventana de 30 días sobre PostgreSQL real: agregados, colección «Mejor precio
// hoy» y ficha. Todo ocurre en una transacción que se deshace al final.
// Solo se ejecuta con `npm run test:db` (necesita DATABASE_URL).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { refreshPriceStats } from "@/data/db/admin";
import { createSql, getDatabaseUrl, type Sql } from "@/data/db/client";
import { createPostgresRepository } from "@/data/postgres-repository";
import { createMockAdapter, GTIN_METALBONE_34_2025 } from "@/ingestion/adapters/mock";
import { createPostgresIngestionRepository } from "@/ingestion/postgres-repository";
import { runIngestion } from "@/ingestion/run";
import { DEFAULT_QUERY } from "@/lib/catalog/query";

const url = getDatabaseUrl();
const ROLLBACK = new Error("rollback");
const DAY_MS = 86_400_000;

/** Tienda ficticia que el test hace pasar por real; nunca llega a guardarse. */
const REAL_TEST_STORE = "tienda-real-de-test";
const SLUG = "adidas-metalbone-3-4-2025";
/** Por debajo de cualquier precio real de la pala: es su mejor precio mientras dura el test. */
const TODAY_PRICE = 99;
const USUAL_PRICE = 140;

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

interface StatsRow {
  status: string;
  avg_30d: number | null;
  min_price: number | null;
  price_30d_ago: number | null;
  tracked_since: string | null;
}

async function stats(tx: Sql): Promise<StatsRow> {
  const [row] = await tx<StatsRow[]>`
    select st.price_status::text as status, st.avg_30d, st.min_price, st.price_30d_ago, st.tracked_since::text as tracked_since
    from racket_price_stats st join rackets r on r.id = st.racket_id where r.slug = ${SLUG}`;
  return row;
}

async function inBestPriceCollection(tx: Sql): Promise<boolean> {
  const result = await createPostgresRepository(tx).searchCatalog(
    { ...DEFAULT_QUERY, q: "metalbone 3.4 2025", collection: "mejor-precio" },
    { pageSize: 50 },
  );
  return result.items.some((item) => item.slug === SLUG);
}

describe("ventana de 30 días en PostgreSQL", { skip: !url && "DATABASE_URL no configurada" }, () => {
  it("sin 30 días de histórico no hay veredicto; con ellos, sale de los últimos 30 días", async () => {
    await rolledBack(async (tx) => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString().slice(0, 10);

      // Solo cuenta el histórico de este test: se aparta el que la pala ya tuviera.
      await tx`delete from price_history where racket_id = (select id from rackets where slug = ${SLUG})`;

      const adapter = createMockAdapter(
        [{
          externalId: "MB34", title: "Pala Adidas Metalbone 3.4 2025", brand: "Adidas", ean: GTIN_METALBONE_34_2025,
          url: "https://example.com/producto/MB34", price: TODAY_PRICE, listPrice: null, available: true, checkedAt: now.toISOString(),
        }],
        { storeSlug: REAL_TEST_STORE, isDemo: false, shipping: { cost: 0, freeFrom: null } },
      );
      const summary = await runIngestion(adapter, createPostgresIngestionRepository(tx), now);
      assert.equal(summary.status, "success", summary.errorMessage ?? "");

      // --- Primer día de seguimiento: «Precio reciente» ---
      const recent = await stats(tx);
      assert.equal(recent.status, "recent");
      assert.equal(recent.avg_30d, null);
      assert.equal(recent.min_price, null);
      assert.equal(recent.price_30d_ago, null);
      assert.equal(recent.tracked_since, today);
      assert.equal(await inBestPriceCollection(tx), false);

      const before = await createPostgresRepository(tx).getPalaBySlug(SLUG);
      assert.equal(before?.price?.current, TODAY_PRICE);
      assert.equal(before?.price?.verdict.status, "recent");
      assert.equal(before?.price?.verdict.label, "Precio reciente");
      assert.equal(before?.price?.average30, null);
      assert.equal(before?.price?.min30, null);
      assert.equal(before?.price?.trackedSince, today);

      // --- La misma pala con 40 días de histórico a un precio más alto ---
      const older = Array.from({ length: 40 }, (_, i) => daysAgo(i + 1));
      await tx`
        insert into price_history (racket_id, store_id, price, price_date)
        select r.id, s.id, ${USUAL_PRICE}, d::date
        from rackets r, stores s, unnest(${older}::text[]) as d
        where r.slug = ${SLUG} and s.slug = ${REAL_TEST_STORE}`;
      await refreshPriceStats(tx, now, false);

      const good = await stats(tx);
      assert.equal(good.status, "good");
      assert.equal(Number(good.min_price), TODAY_PRICE);
      assert.equal(Number(good.price_30d_ago), USUAL_PRICE);
      assert.equal(good.tracked_since, daysAgo(40));
      // 30 días a 140 € y hoy a 99 €: la media queda entre los dos precios.
      assert.ok(Number(good.avg_30d) > TODAY_PRICE && Number(good.avg_30d) < USUAL_PRICE);
      assert.equal(await inBestPriceCollection(tx), true);

      const after = await createPostgresRepository(tx).getPalaBySlug(SLUG);
      assert.equal(after?.price?.verdict.label, "Buen momento para comprar");
      assert.equal(after?.price?.min30?.price, TODAY_PRICE);
      assert.equal(after?.price?.average30, Number(good.avg_30d));
    });
  });
});
