// «Palas parecidas» de la ficha contra PostgreSQL real: la consulta tiene que ser
// válida y determinista tanto si la pala de la ficha tiene precio como si no.
// Una pala sin precio ordenaba por la constante `0`, que PostgreSQL lee como
// posición de columna (42P10), y su ficha devolvía un error 500.
// Todo ocurre en una transacción que se deshace al final.
// Solo se ejecuta con `npm run test:db` (necesita DATABASE_URL).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadCatalog } from "@/catalog/load";
import type { CatalogImport, ImportRacket } from "@/catalog/types";
import { createSql, getDatabaseUrl, type Sql } from "@/data/db/client";
import { createPostgresRepository } from "@/data/postgres-repository";
import { createMockAdapter } from "@/ingestion/adapters/mock";
import { createPostgresIngestionRepository } from "@/ingestion/postgres-repository";
import { runIngestion } from "@/ingestion/run";
import type { StoreListing } from "@/ingestion/types";
import { similarityTarget } from "@/lib/similar";

const url = getDatabaseUrl();
const ROLLBACK = new Error("rollback");
const STORE = "tienda-real-de-test";
const NOW = new Date();
// Sin «test» en el nombre: el matcher nunca empareja solo una «pala de test».
const BRAND = "Marca Inventada";
/** Más que palas tiene el catálogo: así el corte no deja fuera las de este test. */
const ALL = 5000;

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

// Cinco palas inventadas con los mismos atributos: entre ellas solo deciden el
// orden la cercanía de precio (si la hay), el año y la dirección.
// Los EAN son de uso interno (prefijo 2): válidos, pero de ningún producto real.
const RACKETS = [
  { model: "Parecida Alfa", year: 2024, price: 100, ean: "2000000000015" },
  { model: "Parecida Beta", year: 2026, price: 150, ean: "2000000000039" },
  { model: "Parecida Gamma", year: 2025, price: 110, ean: "2000000000046" },
  { model: "Parecida Delta", year: 2027, price: 300, ean: "2000000000053" },
  { model: "Parecida Omega", year: 2026, price: null, ean: "2000000000060" },
];
const slug = (model: string) => {
  const item = RACKETS.find((racket) => racket.model === model);
  return `marca-inventada-${model.toLowerCase().replace(" ", "-")}-${item?.year}`;
};
const ALFA = slug("Parecida Alfa");
const BETA = slug("Parecida Beta");
const GAMMA = slug("Parecida Gamma");
const DELTA = slug("Parecida Delta");
const OMEGA = slug("Parecida Omega");
const OURS = new Set([ALFA, BETA, GAMMA, DELTA, OMEGA]);

function racket(model: string, year: number, ean: string): ImportRacket {
  const fact = (attribute: string, value: string) =>
    ({ attribute, value, raw: null, unit: null, source: "test-fabricante", url: null, kind: "fact" as const, confidence: "high" as const, selected: true });
  return {
    key: `test-${model}-${year}`, existingSlug: null, brand: BRAND, model, year,
    player: null, variants: [], available: true, unavailableReason: null,
    facts: [fact("shape", "diamante"), fact("weight", "350-365")],
    identifiers: [{ type: "gtin", value: ean, source: "test-fabricante" }],
    content: [], media: [], legacyUrls: [], storeLinks: [],
  };
}

const catalog: CatalogImport = {
  generatedAt: NOW.toISOString(),
  sources: [{ slug: "test-fabricante", name: "Fabricante de test", kind: "manufacturer", url: null }],
  rackets: RACKETS.map((item) => racket(item.model, item.year, item.ean)),
};

const LISTINGS: StoreListing[] = RACKETS.flatMap((item, index) =>
  item.price === null
    ? []
    : [{
        externalId: `PARECIDA-${index}`, title: `${BRAND} ${item.model} ${item.year}`.toUpperCase(), brand: BRAND, ean: item.ean,
        url: `https://example.com/parecida-${index}`, price: item.price, listPrice: null, available: true, checkedAt: NOW.toISOString(),
      }],
);

/** Carga las cinco palas y publica el precio de cuatro; devuelve cómo pedir las parecidas de una. */
async function setup(tx: Sql) {
  await loadCatalog(tx, catalog, NOW);
  const summary = await runIngestion(
    createMockAdapter(LISTINGS, { storeSlug: STORE, isDemo: false, shipping: null }),
    createPostgresIngestionRepository(tx),
    NOW,
  );
  assert.equal(summary.status, "success", summary.errorMessage ?? "");
  assert.equal(summary.productsMatched, 4, "las cuatro palas con oferta quedan emparejadas");

  const repository = createPostgresRepository(tx);
  return async (targetSlug: string) => {
    const pala = await repository.getPalaBySlug(targetSlug);
    assert.ok(pala, `existe ${targetSlug}`);
    // El mismo camino que la ficha: app/pala/[slug]/page.tsx.
    const target = similarityTarget(pala);
    const similar = await repository.getSimilarPalas(target, ALL);
    return { target, all: similar.map((item) => item.pala.slug), ours: similar.map((item) => item.pala.slug).filter((s) => OURS.has(s)) };
  };
}

describe("palas parecidas en PostgreSQL", { skip: !url && "DATABASE_URL no configurada" }, () => {
  it("una pala sin precio obtiene sus parecidas, ordenadas sin el criterio de precio", async () => {
    await rolledBack(async (tx) => {
      const similarTo = await setup(tx);
      const { target, all, ours } = await similarTo(OMEGA);

      assert.equal(target.price, null);
      // Sin precio de referencia: mismas tiendas, así que la más reciente primero.
      assert.deepEqual(ours, [DELTA, BETA, GAMMA, ALFA]);
      assert.ok(!all.includes(OMEGA), "no se propone a sí misma");

      // Determinista: repetir la consulta devuelve el catálogo entero en el mismo orden.
      assert.deepEqual((await similarTo(OMEGA)).all, all);
    });
  });

  it("una pala con precio conserva el orden por cercanía de precio", async () => {
    await rolledBack(async (tx) => {
      const similarTo = await setup(tx);
      const { target, ours } = await similarTo(ALFA);

      assert.equal(target.price, 100);
      // 110 € (a 10), 150 € (a 50), 300 € (a 200); la que no tiene precio no se propone.
      assert.deepEqual(ours, [GAMMA, BETA, DELTA]);

      // Desde la más cara, el orden cambia: manda la distancia, no el año ni la dirección.
      assert.deepEqual((await similarTo(DELTA)).ours, [BETA, GAMMA, ALFA]);
    });
  });

  it("el límite se aplica igual con precio y sin él", async () => {
    await rolledBack(async (tx) => {
      await setup(tx);
      const repository = createPostgresRepository(tx);
      for (const targetSlug of [OMEGA, ALFA]) {
        const pala = await repository.getPalaBySlug(targetSlug);
        assert.ok(pala);
        const similar = await repository.getSimilarPalas(similarityTarget(pala), 2);
        assert.equal(similar.length, 2);
        for (const item of similar) {
          assert.equal(item.pala.shape, "diamante");
          assert.notEqual(item.pala.price, null);
        }
      }
    });
  });
});
