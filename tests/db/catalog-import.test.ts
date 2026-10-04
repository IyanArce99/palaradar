// Carga del catálogo enriquecido contra PostgreSQL real, en transacciones que
// se deshacen. Solo se ejecuta con `npm run test:db` (necesita DATABASE_URL).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadCatalog } from "@/catalog/load";
import type { CatalogImport, ImportFact, ImportRacket } from "@/catalog/types";
import { createSql, getDatabaseUrl, type Sql } from "@/data/db/client";
import { createPostgresRepository } from "@/data/postgres-repository";
import { createMockAdapter } from "@/ingestion/adapters/mock";
import { createPostgresIngestionRepository } from "@/ingestion/postgres-repository";
import { runIngestion } from "@/ingestion/run";

const url = getDatabaseUrl();
const ROLLBACK = new Error("rollback");
const STORE = "tienda-real-de-test";
const NOW = new Date();

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

function fact(attribute: string, value: string, extra: Partial<ImportFact> = {}): ImportFact {
  return { attribute, value, raw: null, unit: null, source: "test-fabricante", url: "https://example.com/oficial", kind: "fact", confidence: "high", selected: true, ...extra };
}

function racket(fields: Partial<ImportRacket> = {}): ImportRacket {
  return {
    key: "test-pala-inventada",
    existingSlug: null,
    brand: "Marca De Test",
    model: "Modelo Inventado HRD+",
    year: 2026,
    player: "Jugador Inventado",
    variants: ["hard", "plus"],
    available: true,
    unavailableReason: null,
    facts: [
      fact("shape", "hibrida", { raw: "Híbrida" }),
      fact("shape", "lagrima", { source: "test-tienda", selected: false, confidence: "medium", raw: "Lágrima" }),
      fact("weight", "350-365", { unit: "g" }),
      fact("balance", "alto", { raw: "Head Heavy" }),
      fact("level", "avanzado / competicion", { source: "test-tienda", kind: "declared", confidence: "medium", raw: "Avanzado / Competición" }),
      fact("play_style", "potencia", { source: "test-tienda", kind: "declared", confidence: "medium", raw: "Potencia" }),
      fact("thickness_mm", "38", { unit: "mm" }),
      fact("core", "eva soft", { raw: "EVA Soft" }),
      fact("score_power", "9.5", { source: "test-tienda", kind: "rating", selected: false, confidence: "medium" }),
    ],
    identifiers: [
      // EAN de uso interno (prefijo 2): válido, pero no puede ser de ningún producto real.
      { type: "gtin", value: "2000000000015", source: "test-fabricante" },
      { type: "manufacturer_ref", value: "TEST-REF-1", source: "test-fabricante" },
      { type: "padelzoom_slug", value: "test-pala-inventada", source: "test-tienda" },
    ],
    content: [{ source: "test-tienda", kind: "analysis", body: "Texto de una fuente.", url: null, words: 5 }],
    media: [{ source: "test-tienda", url: "https://example.com/pala.jpg" }],
    legacyUrls: [{ source: "test-tienda", path: "/test-pala-inventada/" }],
    storeLinks: [],
    ...fields,
  };
}

const file = (rackets: ImportRacket[]): CatalogImport => ({
  generatedAt: NOW.toISOString(),
  sources: [
    { slug: "test-fabricante", name: "Fabricante de test", kind: "manufacturer", url: null },
    { slug: "test-tienda", name: "Tienda de test", kind: "store", url: null },
  ],
  rackets,
});

const SLUG = "marca-de-test-modelo-inventado-hrd-plus-2026";

describe("carga del catálogo enriquecido", { skip: !url && "DATABASE_URL no configurada" }, () => {
  it("crea la pala con sus valores publicados, datos con fuente e identificadores", async () => {
    await rolledBack(async (tx) => {
      const summary = await loadCatalog(tx, file([racket()]), NOW);
      assert.equal(summary.created, 1);
      assert.equal(summary.brandsCreated, 1);
      assert.equal(summary.facts, 9);

      const [row] = await tx<{ id: string; shape: string; balance: string; play_style: string; levels: string[]; weight_min: number; weight_max: number; thickness_mm: number; player: string; variants: string[]; is_available: boolean; enrichment_level: number; editorial_status: string; images: string[] }[]>`
        select id, shape, balance, play_style, levels::text[] as levels, weight_min, weight_max, thickness_mm, player, variants,
               is_available, enrichment_level, editorial_status, images
        from rackets where slug = ${SLUG}`;
      assert.equal(row.shape, "hibrida");
      assert.equal(row.balance, "alto");
      assert.equal(row.play_style, "potencia");
      assert.deepEqual(row.levels, ["avanzado", "competicion"]);
      assert.deepEqual([row.weight_min, row.weight_max, row.thickness_mm], [350, 365, 38]);
      assert.equal(row.player, "Jugador Inventado");
      assert.deepEqual(row.variants, ["hard", "plus"]);
      assert.equal(row.is_available, true);
      assert.equal(row.enrichment_level, 2);
      assert.equal(row.editorial_status, "draft");
      assert.match(row.images[0], /generica-hibrida-\d\.svg$/);

      // Cada dato conserva valor, original, fuente, tipo y confianza; solo uno por atributo es el publicado.
      const facts = await tx<{ attribute: string; value: string; raw_value: string | null; source: string; kind: string; confidence: string; selected: boolean }[]>`
        select attribute, value, raw_value, source, kind, confidence, selected from racket_facts
        where racket_id = ${row.id} order by attribute, source`;
      assert.equal(facts.length, 9);
      const shapes = facts.filter((item) => item.attribute === "shape");
      assert.deepEqual(shapes.map((item) => [item.source, item.value, item.raw_value, item.selected]), [
        ["test-fabricante", "hibrida", "Híbrida", true],
        ["test-tienda", "lagrima", "Lágrima", false],
      ]);
      const rating = facts.find((item) => item.attribute === "score_power");
      assert.deepEqual([rating?.kind, rating?.selected], ["rating", false]);

      // El conflicto de forma sigue visible aunque haya un valor elegido; las valoraciones no cuentan.
      const conflicts = await tx<{ attribute: string; distinct_values: number }[]>`
        select attribute, distinct_values::int as distinct_values from racket_fact_conflicts where racket_id = ${row.id}`;
      assert.deepEqual(conflicts.map((item) => [item.attribute, item.distinct_values]), [["shape", 2]]);

      const identifiers = await tx<{ type: string; value: string }[]>`
        select type::text as type, value from racket_identifiers where racket_id = ${row.id} order by type`;
      assert.deepEqual(identifiers.map((item) => item.type), ["gtin", "manufacturer_ref", "padelzoom_slug"]);
      assert.equal(identifiers[0].value, "02000000000015");

      const [extra] = await tx<{ content: number; media: number; urls: number; rights: string }[]>`
        select (select count(*)::int from racket_source_content where racket_id = ${row.id}) as content,
               (select count(*)::int from racket_media where racket_id = ${row.id}) as media,
               (select count(*)::int from legacy_urls where racket_id = ${row.id}) as urls,
               (select rights_status from racket_media where racket_id = ${row.id}) as rights`;
      assert.deepEqual(extra, { content: 1, media: 1, urls: 1, rights: "pending" });

      // La web la ofrece, sin precio y sin texto de terceros.
      const pala = await createPostgresRepository(tx).getPalaBySlug(SLUG);
      assert.equal(pala?.shape, "hibrida");
      assert.equal(pala?.price, null);
      assert.equal(JSON.stringify(pala).includes("Texto de una fuente"), false);
    });
  });

  it("repetir la carga no duplica nada", async () => {
    await rolledBack(async (tx) => {
      const counts = async () =>
        (await tx<{ rackets: number; facts: number; identifiers: number; brands: number }[]>`
          select (select count(*)::int from rackets) as rackets, (select count(*)::int from racket_facts) as facts,
                 (select count(*)::int from racket_identifiers) as identifiers, (select count(*)::int from brands) as brands`)[0];

      await loadCatalog(tx, file([racket()]), NOW);
      const first = await counts();
      const second = await loadCatalog(tx, file([racket()]), NOW);

      assert.deepEqual(await counts(), first);
      assert.equal(second.created, 0);
      assert.equal(second.identifiers, 0);
    });
  });

  it("una pala sin forma resuelta se carga, pero la web no la ofrece", async () => {
    await rolledBack(async (tx) => {
      const facts = [
        fact("shape", "diamante", { selected: false, confidence: "medium" }),
        fact("shape", "lagrima", { source: "test-tienda", selected: false, confidence: "medium" }),
        fact("weight", "365"),
      ];
      const summary = await loadCatalog(tx, file([racket({ facts, available: false, unavailableReason: "Forma sin resolver." })]), NOW);
      assert.equal(summary.unavailable, 1);

      const [row] = await tx<{ is_available: boolean; unavailable_reason: string }[]>`
        select is_available, unavailable_reason from rackets where slug = ${SLUG}`;
      assert.deepEqual(row, { is_available: false, unavailable_reason: "Forma sin resolver." });

      const repository = createPostgresRepository(tx);
      assert.equal(await repository.getPalaBySlug(SLUG), null);
      assert.equal((await repository.getAllPalaSlugs()).includes(SLUG), false);
      const search = await repository.searchCatalog({
        q: "modelo inventado", collection: "todas", levels: [], styles: [], brands: [], shapes: [],
        balances: [], years: [], maxPrice: null, sort: "popularidad", page: 1,
      });
      assert.equal(search.total, 0);
    });
  });

  it("un valor fijado a mano no lo cambia una carga posterior", async () => {
    await rolledBack(async (tx) => {
      await loadCatalog(tx, file([racket()]), NOW);
      // Una persona decide que la forma buena es la de la tienda.
      await tx`
        update racket_facts f set selected = (f.source = 'test-tienda'), pinned = (f.source = 'test-tienda')
        from rackets r where r.id = f.racket_id and r.slug = ${SLUG} and f.attribute = 'shape'`;

      await loadCatalog(tx, file([racket()]), NOW);

      const shapes = await tx<{ source: string; selected: boolean }[]>`
        select f.source, f.selected from racket_facts f join rackets r on r.id = f.racket_id
        where r.slug = ${SLUG} and f.attribute = 'shape' order by f.source`;
      assert.deepEqual(shapes.map((item) => [item.source, item.selected]), [
        ["test-fabricante", false],
        ["test-tienda", true],
      ]);
    });
  });

  it("amplía una pala que ya existía sin duplicarla ni pisar sus datos verificados", async () => {
    await rolledBack(async (tx) => {
      const [before] = await tx<{ id: string; slug: string; shape: string; model: string; description: string }[]>`
        select id, slug, shape::text as shape, model, description from rackets order by slug limit 1`;
      const [{ total }] = await tx<{ total: number }[]>`select count(*)::int as total from rackets`;

      const summary = await loadCatalog(
        tx,
        file([racket({ existingSlug: before.slug, identifiers: [], facts: [fact("shape", "hibrida"), fact("thickness_mm", "36", { unit: "mm" })] })]),
        NOW,
      );
      assert.equal(summary.created, 0);
      assert.equal(summary.enrichedExisting, 1);

      const [after] = await tx<{ shape: string; model: string; description: string; thickness_mm: number; player: string }[]>`
        select shape::text as shape, model, description, thickness_mm, player from rackets where id = ${before.id}`;
      assert.equal((await tx<{ total: number }[]>`select count(*)::int as total from rackets`)[0].total, total);
      // Forma, nombre y texto se respetan; los campos nuevos se rellenan.
      assert.deepEqual([after.shape, after.model, after.description], [before.shape, before.model, before.description]);
      assert.equal(after.thickness_mm, 36);
      assert.equal(after.player, "Jugador Inventado");
      const [{ facts }] = await tx<{ facts: number }[]>`
        select count(*)::int as facts from racket_facts
        where racket_id = ${before.id} and source = 'test-fabricante'`;
      assert.equal(facts, 2);
    });
  });

  it("un identificador que ya es de otra pala no cambia de dueño", async () => {
    await rolledBack(async (tx) => {
      const [taken] = await tx<{ value: string; racket_id: string }[]>`
        select value, racket_id from racket_identifiers where type = 'gtin' limit 1`;
      const summary = await loadCatalog(
        tx,
        file([racket({ identifiers: [{ type: "gtin", value: taken.value, source: "test-fabricante" }] })]),
        NOW,
      );

      assert.equal(summary.identifiers, 0);
      assert.equal(summary.identifiersSkipped, 1);
      const [still] = await tx<{ racket_id: string }[]>`
        select racket_id from racket_identifiers where type = 'gtin' and value = ${taken.value}`;
      assert.equal(still.racket_id, taken.racket_id);
    });
  });

  it("los emparejamientos del fichero quedan fijados y la ingestión los respeta y publica su precio", async () => {
    await rolledBack(async (tx) => {
      const ingestion = createPostgresIngestionRepository(tx);
      const store = { storeSlug: STORE, isDemo: false, shipping: null };
      // Un título que el matcher nunca emparejaría solo con la pala inventada.
      const listing = {
        externalId: "SKU-RARO",
        title: "MARCA DE TEST MODELO INVENTADO",
        brand: "Marca De Test",
        ean: null,
        url: "https://example.com/producto",
        price: 123.45,
        listPrice: null,
        available: true,
        checkedAt: NOW.toISOString(),
      };
      await runIngestion(createMockAdapter([listing], store), ingestion, NOW);

      const link = { store: STORE, externalId: "SKU-RARO", confidence: "medium" as const, reason: "Importación de prueba" };
      const summary = await loadCatalog(tx, file([racket({ storeLinks: [link, { ...link, externalId: "NO-EXISTE" }] })]), NOW);
      assert.equal(summary.storeLinks, 1);
      assert.equal(summary.storeLinksMissing, 1);

      await runIngestion(createMockAdapter([listing], store), ingestion, NOW);

      const [product] = await tx<{ matching_status: string; matching_method: string; matching_confidence: string; slug: string }[]>`
        select p.matching_status::text as matching_status, p.matching_method::text as matching_method,
               p.matching_confidence, r.slug
        from store_products p join rackets r on r.id = p.racket_id where p.external_id = 'SKU-RARO'`;
      assert.deepEqual(product, { matching_status: "matched", matching_method: "manual", matching_confidence: "medium", slug: SLUG });

      const pala = await createPostgresRepository(tx).getPalaBySlug(SLUG);
      assert.equal(pala?.price?.current, 123.45);
      assert.equal(pala?.price?.bestOffer.store.slug, STORE);
    });
  });
});
