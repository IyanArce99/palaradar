// Decisiones manuales de emparejamiento contra PostgreSQL real, en transacciones
// que se deshacen. Solo se ejecuta con `npm run test:db` (necesita DATABASE_URL).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadCatalog } from "@/catalog/load";
import type { CatalogImport, ImportRacket } from "@/catalog/types";
import { createSql, getDatabaseUrl, type Sql } from "@/data/db/client";
import { createPostgresRepository } from "@/data/postgres-repository";
import { createMockAdapter } from "@/ingestion/adapters/mock";
import { applyDecisions, type DecisionFile, type ProductDecision } from "@/ingestion/decisions";
import { createPostgresIngestionRepository } from "@/ingestion/postgres-repository";
import { runIngestion } from "@/ingestion/run";
import type { StoreListing } from "@/ingestion/types";

const url = getDatabaseUrl();
const ROLLBACK = new Error("rollback");
const STORE = "tienda-real-de-test";
const NOW = new Date();
// EAN de uso interno (prefijo 2): válido, pero no puede ser de ningún producto real.
const EAN = "2000000000022";
const SLUG_2026 = "marca-de-test-modelo-inventado-hrd-plus-2026";
const SLUG_2027 = "marca-de-test-modelo-inventado-hrd-plus-2027";

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

/** La misma pala inventada en dos temporadas: el título sin año no las distingue. */
function racket(year: number): ImportRacket {
  const fact = (attribute: string, value: string) =>
    ({ attribute, value, raw: null, unit: null, source: "test-fabricante", url: null, kind: "fact" as const, confidence: "high" as const, selected: true });
  return {
    key: `test-pala-inventada-${year}`, existingSlug: null, brand: "Marca De Test", model: "Modelo Inventado HRD+", year,
    player: null, variants: ["hard", "plus"], available: true, unavailableReason: null,
    facts: [fact("shape", "diamante"), fact("weight", "350-365")],
    identifiers: [], content: [], media: [], legacyUrls: [], storeLinks: [],
  };
}

const catalog: CatalogImport = {
  generatedAt: NOW.toISOString(),
  sources: [{ slug: "test-fabricante", name: "Fabricante de test", kind: "manufacturer", url: null }],
  rackets: [racket(2026), racket(2027)],
};

const listing = (externalId: string, title: string, extra: Partial<StoreListing> = {}): StoreListing => ({
  externalId, title, brand: "Marca De Test", ean: null, url: `https://example.com/${externalId}`,
  price: 123.45, listPrice: null, available: true, checkedAt: NOW.toISOString(), ...extra,
});
const LISTINGS = [
  listing("SIN-AÑO", "MARCA DE TEST MODELO INVENTADO HRD+", { ean: EAN }),
  listing("PACK", "PACK MARCA DE TEST MODELO INVENTADO HRD+ 2026", { price: 199 }),
  listing("EDICION", "MARCA DE TEST MODELO INVENTADO HRD+ EDICIÓN RARA", { price: 250 }),
];

const decision = (externalId: string, fields: Partial<ProductDecision>): ProductDecision => ({
  store: STORE, externalId, title: externalId, decision: "review", reason: "sin ficha equivalente en catálogo", ...fields,
});
const DECISIONS: DecisionFile = {
  title: "Decisiones de prueba",
  decidedAt: "2026-10-05",
  products: [
    decision("SIN-AÑO", { decision: "match", racket: SLUG_2026, confidence: "high", reason: "Revisado a mano" }),
    decision("PACK", { decision: "reject", reason: "Pack: no es la pala suelta" }),
    decision("EDICION", {}),
  ],
};

async function setup(tx: Sql) {
  await loadCatalog(tx, catalog, NOW);
  const ingest = () =>
    runIngestion(createMockAdapter(LISTINGS, { storeSlug: STORE, isDemo: false, shipping: null }), createPostgresIngestionRepository(tx), NOW);
  await ingest();
  const states = async () =>
    Object.fromEntries(
      (await tx<{ external_id: string; status: string; method: string | null; confidence: string | null; note: string | null; slug: string | null }[]>`
        select p.external_id, p.matching_status::text as status, p.matching_method::text as method,
               p.matching_confidence as confidence, p.matching_note as note, r.slug
        from store_products p join stores s on s.id = p.store_id left join rackets r on r.id = p.racket_id
        where s.slug = ${STORE}`).map((row) => [row.external_id, row]),
    );
  return { ingest, states };
}

describe("decisiones manuales de emparejamiento", { skip: !url && "DATABASE_URL no configurada" }, () => {
  it("empareja, rechaza y fija en revisión; la ingestión lo respeta y repetirlo no cambia nada", async () => {
    await rolledBack(async (tx) => {
      const { ingest, states } = await setup(tx);
      // Sin decisión, el matcher deja los tres en revisión: nada se publica.
      assert.deepEqual(Object.values(await states()).map((row) => row.status), ["pending_review", "pending_review", "pending_review"]);

      const report = await applyDecisions(tx, DECISIONS, NOW);
      assert.deepEqual(
        [report.matched, report.rejected, report.inReview, report.unchanged, report.gtinsAdded, report.duplicates.length],
        [1, 1, 1, 0, 1, 0],
      );

      const expected = {
        "SIN-AÑO": { external_id: "SIN-AÑO", status: "matched", method: "manual", confidence: "high", note: "Revisado a mano", slug: SLUG_2026 },
        PACK: { external_id: "PACK", status: "rejected", method: "manual", confidence: null, note: "Pack: no es la pala suelta", slug: null },
        EDICION: { external_id: "EDICION", status: "pending_review", method: "manual", confidence: null, note: "sin ficha equivalente en catálogo", slug: null },
      };
      assert.deepEqual(await states(), expected);
      // El EAN del producto emparejado queda como identificador de la pala.
      const [owner] = await tx<{ slug: string; source: string }[]>`
        select r.slug, i.source from racket_identifiers i join rackets r on r.id = i.racket_id
        where i.type = 'gtin' and i.value = ${`0${EAN}`}`;
      assert.deepEqual(owner, { slug: SLUG_2026, source: STORE });

      // Repetirlo no cambia nada.
      const again = await applyDecisions(tx, DECISIONS, NOW);
      assert.deepEqual([again.matched, again.rejected, again.inReview, again.unchanged, again.gtinsAdded], [0, 0, 0, 3, 0]);

      // La siguiente ingestión no recalcula las decisiones y publica el precio del emparejado.
      await ingest();
      assert.deepEqual(await states(), expected);
      const repository = createPostgresRepository(tx);
      assert.equal((await repository.getPalaBySlug(SLUG_2026))?.price?.current, 123.45);
      assert.equal((await repository.getPalaBySlug(SLUG_2027))?.price, null);
    });
  });

  it("corrige un enlace equivocado: el producto, su precio, su histórico y su EAN cambian de pala", async () => {
    await rolledBack(async (tx) => {
      const { ingest } = await setup(tx);
      await applyDecisions(tx, DECISIONS, NOW);
      await ingest();

      const correction: DecisionFile = {
        ...DECISIONS,
        products: [decision("SIN-AÑO", { decision: "match", racket: SLUG_2027, confidence: "high", reason: "Era la de 2027", from: SLUG_2026, history: "move" })],
      };
      const report = await applyDecisions(tx, correction, NOW);
      assert.deepEqual(
        [report.matched, report.pricesMoved, report.pricesRemoved, report.historyMoved, report.historyDeleted, report.identifiersMoved],
        [1, 1, 0, 1, 0, 1],
      );

      const repository = createPostgresRepository(tx);
      assert.equal((await repository.getPalaBySlug(SLUG_2026))?.price, null);
      assert.equal((await repository.getPalaBySlug(SLUG_2027))?.price?.current, 123.45);
      const history = await tx<{ slug: string }[]>`
        select r.slug from price_history h join rackets r on r.id = h.racket_id join stores s on s.id = h.store_id where s.slug = ${STORE}`;
      assert.deepEqual(history.map((row) => row.slug), [SLUG_2027]);

      // Y lo mismo hacia «sin pala»: se retira el precio, se borra su histórico y su EAN.
      const removal: DecisionFile = {
        ...DECISIONS,
        products: [decision("SIN-AÑO", { decision: "reject", reason: "colección 2027, sin ficha en el catálogo", from: SLUG_2027, history: "delete" })],
      };
      const removed = await applyDecisions(tx, removal, NOW);
      assert.deepEqual([removed.rejected, removed.pricesRemoved, removed.historyDeleted, removed.identifiersRemoved], [1, 1, 1, 1]);
      assert.equal((await repository.getPalaBySlug(SLUG_2027))?.price, null);
      const [{ left }] = await tx<{ left: number }[]>`
        select count(*)::int as left from price_history h join stores s on s.id = h.store_id where s.slug = ${STORE}`;
      assert.equal(left, 0);
    });
  });

  it("no aplica una decisión si el producto ya no está como cuando se revisó", async () => {
    await rolledBack(async (tx) => {
      await setup(tx);
      await applyDecisions(tx, DECISIONS, NOW);

      const stale = (products: ProductDecision[]) => applyDecisions(tx, { ...DECISIONS, products }, NOW);
      // Ya está decidido de otra forma: no se pisa en silencio.
      await assert.rejects(stale([decision("PACK", { decision: "match", racket: SLUG_2026, confidence: "high", reason: "Otra cosa" })]), /ya no está en revisión/);
      // La corrección parte de una pala a la que el producto no está enlazado.
      await assert.rejects(stale([decision("SIN-AÑO", { decision: "reject", reason: "No", from: SLUG_2027 })]), /ya no está enlazado/);
      await assert.rejects(stale([decision("NO-EXISTE", {})]), /No existe el producto/);
    });
  });

  it("corrige el año, el modelo y la dirección de una pala sin tocar lo que cuelga de ella", async () => {
    await rolledBack(async (tx) => {
      await setup(tx);
      await applyDecisions(tx, DECISIONS, NOW);
      const fixed = "marca-de-test-modelo-inventado-hrd-plus-2025";
      const file: DecisionFile = {
        ...DECISIONS,
        rackets: [{ slug: SLUG_2026, set: { slug: fixed, year: 2025 }, reason: "El año estaba mal" }],
        products: [decision("SIN-AÑO", { decision: "match", racket: fixed, confidence: "high", reason: "Revisado a mano" })],
      };

      const report = await applyDecisions(tx, file, NOW);
      assert.deepEqual([report.racketsFixed, report.unchanged], [1, 1]);
      const [row] = await tx<{ year: number; products: number }[]>`
        select r.year, (select count(*)::int from store_products p where p.racket_id = r.id) as products
        from rackets r where r.slug = ${fixed}`;
      assert.deepEqual(row, { year: 2025, products: 1 });
      // Repetirlo, con la dirección antigua ya inexistente, no falla ni cambia nada.
      assert.equal((await applyDecisions(tx, file, NOW)).racketsFixed, 0);
      // No puede ocupar la dirección de otra pala.
      await assert.rejects(
        applyDecisions(tx, { ...file, rackets: [{ slug: fixed, set: { slug: SLUG_2027 }, reason: "x" }] }, NOW),
        /Ya existe otra pala/,
      );
    });
  });
});
