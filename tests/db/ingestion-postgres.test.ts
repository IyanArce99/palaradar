// Comprueba el repositorio de ingestión contra PostgreSQL real. Todo ocurre
// dentro de una transacción que se deshace al final: no deja datos en la base.
// Solo se ejecuta con `npm run test:db` (necesita DATABASE_URL).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSql, getDatabaseUrl, type Sql } from "@/data/db/client";
import { createMockAdapter, MOCK_STORE_SLUG, mockScenario } from "@/ingestion/adapters/mock";
import { createPostgresIngestionRepository } from "@/ingestion/postgres-repository";
import { runIngestion } from "@/ingestion/run";

const url = getDatabaseUrl();
const ROLLBACK = new Error("rollback");

const DAY_1 = new Date("2026-10-05T06:00:00Z");
const DAY_2 = new Date("2026-10-06T06:00:00Z");

describe("ingestión sobre PostgreSQL", { skip: !url && "DATABASE_URL no configurada" }, () => {
  it("guarda productos, precios, histórico y ejecuciones como el repositorio en memoria", async () => {
    const sql = createSql(url as string, 1);

    try {
      await sql.begin(async (transaction) => {
        const tx = transaction as unknown as Sql;
        const repository = createPostgresIngestionRepository(tx);
        const scenario = mockScenario(DAY_1.toISOString(), DAY_2.toISOString());

        const first = await runIngestion(createMockAdapter(scenario.firstRun), repository, DAY_1);
        assert.equal(first.status, "success", first.errorMessage ?? "");
        assert.equal(first.productsSeen, 5);
        assert.equal(first.productsMatched, 4);

        const second = await runIngestion(createMockAdapter(scenario.secondRun), repository, DAY_2);
        assert.equal(second.status, "success", second.errorMessage ?? "");

        const products = await tx<{ external_id: string; matching_status: string; matching_method: string | null; listing_status: string; missed_runs: number; gtin: string | null }[]>`
          select p.external_id, p.matching_status, p.matching_method, p.listing_status, p.missed_runs, p.gtin
          from store_products p join stores s on s.id = p.store_id
          where s.slug = ${MOCK_STORE_SLUG}`;
        const byId = new Map(products.map((product) => [product.external_id, product]));

        assert.equal(products.length, 6);
        assert.equal(byId.get("MB34")?.matching_method, "gtin");
        assert.equal(byId.get("MB34")?.gtin, "08435739402740");
        assert.equal(byId.get("EQ27")?.matching_method, "attributes");
        assert.equal(byId.get("V04")?.matching_status, "rejected");
        assert.equal(byId.get("KYRA")?.listing_status, "out_of_stock");
        assert.equal(byId.get("DRAX")?.missed_runs, 1);

        const [metalbone] = await tx<{ current_price: number; previous_price: number | null; checked_at: string }[]>`
          select sp.current_price, sp.previous_price, sp.checked_at
          from store_prices sp
          join stores s on s.id = sp.store_id
          join rackets r on r.id = sp.racket_id
          where s.slug = ${MOCK_STORE_SLUG} and r.slug = 'adidas-metalbone-3-4-2025'`;
        assert.equal(metalbone.current_price, 229.95);
        assert.equal(metalbone.previous_price, 249.95);
        assert.equal(metalbone.checked_at, DAY_2.toISOString());

        const history = await tx<{ price_date: string; price: number }[]>`
          select h.price_date, h.price
          from price_history h
          join stores s on s.id = h.store_id
          join rackets r on r.id = h.racket_id
          where s.slug = ${MOCK_STORE_SLUG} and r.slug = 'adidas-metalbone-3-4-2025'
            and h.price_date in ('2026-10-05', '2026-10-06')
          order by h.price_date`;
        assert.deepEqual(
          history.map((row) => [row.price_date, row.price]),
          [["2026-10-05", 249.95], ["2026-10-06", 229.95]],
        );

        const runs = await tx<{ status: string; products_seen: number; prices_updated: number }[]>`
          select r.status, r.products_seen, r.prices_updated
          from ingestion_runs r join stores s on s.id = r.store_id
          where s.slug = ${MOCK_STORE_SLUG} order by r.started_at`;
        assert.deepEqual(runs.map((run) => run.status), ["success", "success"]);
        assert.equal(runs[0].products_seen, 5);

        // Los agregados del catálogo reflejan el precio nuevo.
        const [stats] = await tx<{ best_price: number }[]>`
          select st.best_price from racket_price_stats st
          join rackets r on r.id = st.racket_id where r.slug = 'adidas-metalbone-3-4-2025'`;
        assert.ok(stats.best_price <= 229.95);

        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    } finally {
      await sql.end();
    }
  });
});
