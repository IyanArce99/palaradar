// Demostración de la ingestión con el adaptador de prueba y el repositorio en
// memoria: no llama a ninguna tienda ni escribe en la base de datos.
//   npm run ingest:demo
import { buildSeed } from "@/data/seed/build";
import { createMockAdapter, MOCK_STORE_SLUG, mockScenario } from "@/ingestion/adapters/mock";
import { createMemoryIngestionRepository } from "@/ingestion/memory-repository";
import { runIngestion } from "@/ingestion/run";
import type { RunSummary } from "@/ingestion/types";

function report(label: string, summary: RunSummary): void {
  console.log(
    `${label}: ${summary.status} · vistos ${summary.productsSeen} · emparejados ${summary.productsMatched} · ` +
      `en revisión ${summary.productsPending} · precios actualizados ${summary.pricesUpdated} · retenidos ${summary.pricesHeld}`,
  );
}

async function main(): Promise<void> {
  const firstDay = new Date();
  const secondDay = new Date(firstDay.getTime() + 86_400_000);
  const seed = buildSeed(firstDay);
  const brandName = new Map(seed.brands.map((brand) => [brand.id, brand.name]));

  const repository = createMemoryIngestionRepository(
    seed.stores,
    seed.rackets.map((racket) => ({
      id: racket.id,
      brand: brandName.get(racket.brand_id) ?? "",
      model: racket.model,
      year: racket.year,
      gtins: seed.racketIdentifiers
        .filter((identifier) => identifier.racket_id === racket.id && identifier.type === "gtin")
        .map((identifier) => identifier.value),
    })),
  );

  const scenario = mockScenario(firstDay.toISOString(), secondDay.toISOString());
  report("1.ª lectura", await runIngestion(createMockAdapter(scenario.firstRun), repository, firstDay));
  report("2.ª lectura", await runIngestion(createMockAdapter(scenario.secondRun), repository, secondDay));

  console.log(`\nProductos de «${MOCK_STORE_SLUG}»:`);
  console.table(
    repository.state.storeProducts.map((product) => ({
      producto: product.title,
      emparejamiento: product.matchingStatus,
      método: product.matchingMethod ?? "—",
      estado: product.listingStatus,
      precio: product.price,
      nota: product.matchingNote ?? "",
    })),
  );

  console.log("Precios publicados:");
  console.table(
    repository.state.publishedPrices.map((price) => ({
      pala: seed.rackets.find((racket) => racket.id === price.racketId)?.slug,
      precio: price.price,
      anterior: price.previousPrice,
      comprobado: price.checkedAt.slice(0, 10),
    })),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
