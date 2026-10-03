// Simulación de la ingestión de una tienda: descarga su catálogo, normaliza y
// empareja, y muestra el resultado. NO escribe nada en la base de datos (de
// ella solo lee el catálogo de palas y los productos ya conocidos).
//   npm run prices:dry-run
//   npm run prices:dry-run -- --store=padelproshop
import { createSql, getDatabaseUrl } from "@/data/db/client";
import { buildSeed } from "@/data/seed/build";
import { getAdapter } from "@/ingestion/adapters";
import { createMemoryIngestionRepository } from "@/ingestion/memory-repository";
import { createPostgresIngestionRepository } from "@/ingestion/postgres-repository";
import { runIngestion } from "@/ingestion/run";
import type { CatalogRacket, StoreProduct } from "@/ingestion/types";
import { euros, storeFromArgs } from "./shared";

const NO_EQUIVALENT = "Sin equivalente en el catálogo.";
const MAX_EXAMPLES = 15;

interface Known {
  catalog: CatalogRacket[];
  storeProducts: StoreProduct[];
  source: string;
}

/** Catálogo y productos ya conocidos: de la base de datos (solo lectura) o del seed. */
async function loadKnown(storeSlug: string): Promise<Known> {
  const url = getDatabaseUrl();
  if (!url) {
    const seed = buildSeed(new Date());
    const brandName = new Map(seed.brands.map((brand) => [brand.id, brand.name]));
    return {
      source: "seed en memoria",
      storeProducts: [],
      catalog: seed.rackets.map((racket) => ({
        id: racket.id,
        brand: brandName.get(racket.brand_id) ?? "",
        model: racket.model,
        year: racket.year,
        gtins: seed.racketIdentifiers
          .filter((id) => id.racket_id === racket.id && id.type === "gtin")
          .map((id) => id.value),
      })),
    };
  }

  const sql = createSql(url, 1);
  try {
    const repository = createPostgresIngestionRepository(sql);
    const store = await repository.getStore(storeSlug);
    return {
      source: "base de datos",
      catalog: await repository.loadCatalog(),
      storeProducts: store ? await repository.listStoreProducts(store.id) : [],
    };
  } finally {
    await sql.end();
  }
}

function section(title: string): void {
  console.log(`\n${title}\n${"─".repeat(title.length)}`);
}

async function main(): Promise<void> {
  const storeSlug = storeFromArgs("padelproshop");
  const adapter = getAdapter(storeSlug);
  const known = await loadKnown(storeSlug);

  console.log(`DRY RUN · ${adapter.store.name} · catálogo de ${known.source} · no se escribe nada`);

  const repository = createMemoryIngestionRepository([], known.catalog, known.storeProducts);
  const summary = await runIngestion(adapter, repository);

  if (summary.status === "failed") {
    console.error(`\nLa ejecución ha fallado: ${summary.errorMessage}`);
    process.exitCode = 1;
    return;
  }

  const products = repository.state.storeProducts.filter((product) => product.missedRuns === 0);
  const matched = products.filter((product) => product.matchingStatus === "matched");
  const pending = products.filter((product) => product.matchingStatus === "pending_review");
  const rejected = products.filter((product) => product.matchingStatus === "rejected");
  const vetoed = rejected.filter((product) => product.matchingNote !== NO_EQUIVALENT);
  const racketName = new Map(
    known.catalog.map((racket) => [racket.id, `${racket.brand} ${racket.model} ${racket.year}`]),
  );

  if (adapter.lastFetch) {
    section("Descarga");
    console.log(`Total anunciado por la tienda: ${adapter.lastFetch.announced}`);
    console.log(`Total descargado:              ${adapter.lastFetch.downloaded}`);
    console.log(`Productos distintos:           ${adapter.lastFetch.unique}`);
    console.log(`Duplicados descartados:        ${adapter.lastFetch.duplicates}`);
    console.log(`Páginas leídas:                ${adapter.lastFetch.pages}`);
  }

  section("Resumen");
  console.log(`Productos encontrados:      ${summary.productsSeen}`);
  console.log(`Productos disponibles:      ${products.filter((p) => p.listingStatus === "active").length}`);
  console.log(`Productos con EAN válido:   ${products.filter((product) => product.gtin).length}`);
  console.log(`Productos sin EAN:          ${products.filter((product) => !product.gtin).length}`);
  console.log(`Precios que se publicarían: ${repository.state.publishedPrices.length}`);
  console.log(`Coincidencias automáticas:  ${matched.length}`);
  console.log(`  por EAN:                  ${matched.filter((p) => p.matchingMethod === "gtin").length}`);
  console.log(`  por marca/modelo/año:     ${matched.filter((p) => p.matchingMethod === "attributes").length}`);
  console.log(`Pendientes de revisión:     ${pending.length}`);
  console.log(`Sin coincidencia:           ${rejected.length}`);
  console.log(`  descartados por un veto:  ${vetoed.length}`);
  console.log(`Productos agotados:         ${products.filter((p) => p.listingStatus === "out_of_stock").length}`);
  console.log(`Descartados por datos:      ${summary.productsInvalid}`);

  section("Coincidencias automáticas");
  for (const product of matched) {
    console.log(racketName.get(product.racketId ?? "") ?? "?");
    console.log(`  → ${product.title}`);
    console.log(`  → EAN ${product.gtin ?? "—"} · emparejado por ${product.matchingMethod}`);
    console.log(
      `  → ${euros(product.price)}${product.listingStatus === "out_of_stock" ? " · AGOTADO" : ""} · ${product.url}`,
    );
  }
  if (matched.length === 0) console.log("(ninguna)");

  section("Pendientes de revisión");
  for (const product of pending.slice(0, MAX_EXAMPLES)) {
    console.log(`${product.title} · EAN ${product.gtin ?? "—"} · ${euros(product.price)}`);
    console.log(`  → ${product.matchingNote}`);
  }
  if (pending.length === 0) console.log("(ninguno)");
  if (pending.length > MAX_EXAMPLES) console.log(`… y ${pending.length - MAX_EXAMPLES} más`);

  section("Descartados por un veto (EAN, año o variante distintos)");
  for (const product of vetoed.slice(0, MAX_EXAMPLES)) {
    console.log(`${product.title} · EAN ${product.gtin ?? "—"}`);
    console.log(`  → ${product.matchingNote}`);
  }
  if (vetoed.length === 0) console.log("(ninguno)");
  if (vetoed.length > MAX_EXAMPLES) console.log(`… y ${vetoed.length - MAX_EXAMPLES} más`);

  const withOffer = new Set(matched.map((product) => product.racketId));
  const missing = known.catalog.filter((racket) => !withOffer.has(racket.id));
  section(`Palas de PalaRadar sin producto en ${adapter.store.name} (${missing.length} de ${known.catalog.length})`);
  for (const racket of missing) console.log(`${racket.brand} ${racket.model} ${racket.year}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
