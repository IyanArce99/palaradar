import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createMockAdapter, GTIN_METALBONE_34_2025, mockScenario } from "@/ingestion/adapters/mock";
import { runIngestion } from "@/ingestion/run";
import type { StoreListing } from "@/ingestion/types";
import { createRepository, DAY_1, DAY_2, DAY_3, listing, STORE } from "./fixtures";
import { GOLDEN_DAYS, goldenResult, goldenRuns } from "./golden-scenario";

const METALBONE = "metalbone-34-2025";

/** Una Metalbone 3.4 con EAN, al precio y fecha indicados. */
function metalbone(price: number, at: Date, extra: Partial<StoreListing> = {}): StoreListing {
  return listing(
    { externalId: "MB34", title: "Pala Adidas Metalbone 3.4 2025", brand: "Adidas", ean: GTIN_METALBONE_34_2025, price, ...extra },
    at,
  );
}

async function ingest(repository: ReturnType<typeof createRepository>, listings: StoreListing[], at: Date) {
  return runIngestion(createMockAdapter(listings), repository, at);
}

describe("producto nuevo", () => {
  it("crea el producto de tienda, publica su precio y abre el histórico", async () => {
    const repository = createRepository();
    const summary = await ingest(repository, [metalbone(249.95, DAY_1)], DAY_1);

    const [product] = repository.state.storeProducts;
    const [price] = repository.state.publishedPrices;

    assert.equal(summary.status, "success");
    assert.equal(summary.productsSeen, 1);
    assert.equal(summary.productsMatched, 1);
    assert.equal(summary.pricesUpdated, 1);
    assert.equal(product.racketId, METALBONE);
    assert.equal(product.matchingMethod, "gtin");
    assert.equal(price.price, 249.95);
    assert.equal(price.previousPrice, null);
    assert.deepEqual(repository.state.priceHistory, [
      { racket_id: METALBONE, store_id: STORE.id, price_date: "2026-10-05", price: 249.95 },
    ]);
    assert.equal(repository.state.statsRefreshes, 1);
  });

  it("guarda sin publicar un producto que no se ha podido emparejar", async () => {
    const repository = createRepository();
    const summary = await ingest(
      repository,
      [listing({ title: "Pala Nox Equation Hard Advanced", brand: "Nox", price: 110 })],
      DAY_1,
    );

    assert.equal(summary.productsPending, 1);
    assert.equal(repository.state.storeProducts[0].matchingStatus, "pending_review");
    assert.equal(repository.state.publishedPrices.length, 0);
  });
});

describe("cambio de precio", () => {
  it("toma el precio anterior de nuestro histórico, no del precio de lista de la tienda", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(249.95, DAY_1, { listPrice: 390 })], DAY_1);
    const summary = await ingest(repository, [metalbone(229.95, DAY_2, { listPrice: 390 })], DAY_2);

    const [price] = repository.state.publishedPrices;

    assert.equal(summary.pricesUpdated, 1);
    assert.equal(price.price, 229.95);
    assert.equal(price.previousPrice, 249.95);
    assert.equal(repository.state.storeProducts[0].listPrice, 390);
    assert.deepEqual(
      repository.state.priceHistory.map((row) => [row.price_date, row.price]),
      [["2026-10-05", 249.95], ["2026-10-06", 229.95]],
    );
  });

  it("si el precio no cambia solo avanza la fecha de comprobación", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(249.95, DAY_1)], DAY_1);
    const summary = await ingest(repository, [metalbone(249.95, DAY_2)], DAY_2);

    const [price] = repository.state.publishedPrices;

    assert.equal(summary.pricesUpdated, 0);
    assert.equal(price.previousPrice, null);
    assert.equal(price.checkedAt, DAY_2.toISOString());
    assert.equal(repository.state.priceHistory.length, 2);
  });

  it("una subida no deja un precio anterior mayor que el actual", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(229.95, DAY_1)], DAY_1);
    await ingest(repository, [metalbone(249.95, DAY_2)], DAY_2);

    const [price] = repository.state.publishedPrices;

    assert.equal(price.price, 249.95);
    assert.equal(price.previousPrice, 229.95);
  });

  it("guarda un solo registro de histórico por día, con el último precio visto", async () => {
    const repository = createRepository();
    const afternoon = new Date("2026-10-05T16:00:00Z");
    await ingest(repository, [metalbone(249.95, DAY_1)], DAY_1);
    await ingest(repository, [metalbone(239.95, afternoon)], afternoon);

    assert.deepEqual(
      repository.state.priceHistory.map((row) => [row.price_date, row.price]),
      [["2026-10-05", 239.95]],
    );
  });
});

describe("bajada de más del 40 %", () => {
  it("la retiene sin publicarla ni dar por comprobado el precio anterior", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(249.95, DAY_1)], DAY_1);
    const summary = await ingest(repository, [metalbone(99.95, DAY_2)], DAY_2);

    const [product] = repository.state.storeProducts;
    const [price] = repository.state.publishedPrices;

    assert.equal(summary.pricesHeld, 1);
    assert.equal(summary.pricesUpdated, 0);
    assert.equal(price.price, 249.95);
    assert.equal(price.checkedAt, DAY_1.toISOString());
    assert.equal(product.pendingPrice, 99.95);
    assert.equal(repository.state.priceHistory.length, 1);
  });

  it("la acepta cuando la ejecución siguiente la confirma", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(249.95, DAY_1)], DAY_1);
    await ingest(repository, [metalbone(99.95, DAY_2)], DAY_2);
    const summary = await ingest(repository, [metalbone(99.95, DAY_3)], DAY_3);

    const [price] = repository.state.publishedPrices;

    assert.equal(summary.pricesUpdated, 1);
    assert.equal(price.price, 99.95);
    assert.equal(price.previousPrice, 249.95);
    assert.equal(repository.state.storeProducts[0].pendingPrice, null);
  });

  it("la descarta si el precio vuelve a su valor normal", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(249.95, DAY_1)], DAY_1);
    await ingest(repository, [metalbone(99.95, DAY_2)], DAY_2);
    await ingest(repository, [metalbone(249.95, DAY_3)], DAY_3);

    const [price] = repository.state.publishedPrices;

    assert.equal(price.price, 249.95);
    assert.equal(price.previousPrice, null);
    assert.equal(price.checkedAt, DAY_3.toISOString());
    assert.equal(repository.state.storeProducts[0].pendingPrice, null);
  });

  it("publica sin retener una bajada del 40 % o menor", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(250, DAY_1)], DAY_1);
    const summary = await ingest(repository, [metalbone(150, DAY_2)], DAY_2);

    assert.equal(summary.pricesHeld, 0);
    assert.equal(repository.state.publishedPrices[0].price, 150);
  });
});

describe("producto agotado", () => {
  it("deja de publicarse, pero conserva el emparejamiento y el histórico", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(249.95, DAY_1)], DAY_1);
    await ingest(repository, [metalbone(249.95, DAY_2, { available: false })], DAY_2);

    const [product] = repository.state.storeProducts;

    assert.equal(repository.state.publishedPrices.length, 0);
    assert.equal(product.listingStatus, "out_of_stock");
    assert.equal(product.matchingStatus, "matched");
    assert.equal(product.racketId, METALBONE);
    assert.equal(repository.state.priceHistory.length, 1);
  });

  it("vuelve a publicarse cuando hay stock de nuevo", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(249.95, DAY_1)], DAY_1);
    await ingest(repository, [metalbone(249.95, DAY_2, { available: false })], DAY_2);
    await ingest(repository, [metalbone(239.95, DAY_3)], DAY_3);

    assert.equal(repository.state.publishedPrices[0].price, 239.95);
    assert.equal(repository.state.storeProducts[0].listingStatus, "active");
  });

  it("publica el más barato disponible cuando la tienda tiene varios productos de la misma pala", async () => {
    const repository = createRepository();
    await ingest(
      repository,
      [
        metalbone(249.95, DAY_1, { externalId: "MB34-A", available: false }),
        metalbone(259.95, DAY_1, { externalId: "MB34-B" }),
        metalbone(269.95, DAY_1, { externalId: "MB34-C" }),
      ],
      DAY_1,
    );

    assert.equal(repository.state.publishedPrices.length, 1);
    assert.equal(repository.state.publishedPrices[0].price, 259.95);
  });
});

describe("producto desaparecido", () => {
  it("a la primera ausencia conserva el precio sin darlo por comprobado", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(249.95, DAY_1)], DAY_1);
    await ingest(repository, [], DAY_2);

    const [product] = repository.state.storeProducts;
    const [price] = repository.state.publishedPrices;

    assert.equal(product.missedRuns, 1);
    assert.equal(product.listingStatus, "active");
    assert.equal(price.price, 249.95);
    assert.equal(price.checkedAt, DAY_1.toISOString());
    assert.equal(repository.state.priceHistory.length, 1);
  });

  it("a la segunda ausencia seguida lo retira, conservando el histórico", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(249.95, DAY_1)], DAY_1);
    await ingest(repository, [], DAY_2);
    await ingest(repository, [], DAY_3);

    const [product] = repository.state.storeProducts;

    assert.equal(product.listingStatus, "missing");
    assert.equal(repository.state.publishedPrices.length, 0);
    assert.equal(repository.state.priceHistory.length, 1);
  });

  it("si reaparece, vuelve a estar activo y se le reinicia el contador", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(249.95, DAY_1)], DAY_1);
    await ingest(repository, [], DAY_2);
    await ingest(repository, [metalbone(249.95, DAY_3)], DAY_3);

    const [product] = repository.state.storeProducts;

    assert.equal(product.missedRuns, 0);
    assert.equal(repository.state.publishedPrices[0].checkedAt, DAY_3.toISOString());
  });
});

describe("cambios en la tienda", () => {
  it("un cambio de URL actualiza el enlace sin crear otro producto", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(249.95, DAY_1, { url: "https://example.com/vieja" })], DAY_1);
    await ingest(repository, [metalbone(249.95, DAY_2, { url: "https://example.com/nueva" })], DAY_2);

    assert.equal(repository.state.storeProducts.length, 1);
    assert.equal(repository.state.publishedPrices[0].url, "https://example.com/nueva");
  });

  it("respeta una decisión manual aunque el matcher opinara otra cosa", async () => {
    const repository = createRepository();
    const ambiguous = listing({ externalId: "X1", title: "Pala Siux Fenix Pro Glow Purple 2026", brand: "Siux", price: 289.95 });
    await ingest(repository, [ambiguous], DAY_1);

    // Una persona revisa el producto y lo asigna a la Fenix Pro.
    Object.assign(repository.state.storeProducts[0], {
      racketId: "fenix-pro-2026",
      matchingStatus: "matched",
      matchingMethod: "manual",
    });
    await ingest(repository, [{ ...ambiguous, checkedAt: DAY_2.toISOString() }], DAY_2);

    assert.equal(repository.state.storeProducts[0].matchingMethod, "manual");
    assert.equal(repository.state.publishedPrices[0].racketId, "fenix-pro-2026");
  });
});

describe("fallo de la tienda", () => {
  it("registra la ejecución como fallida y no toca ningún precio", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(249.95, DAY_1)], DAY_1);
    const summary = await runIngestion(
      createMockAdapter([], { fail: "La tienda no responde" }),
      repository,
      DAY_2,
    );

    const [product] = repository.state.storeProducts;
    const [price] = repository.state.publishedPrices;

    assert.equal(summary.status, "failed");
    assert.equal(summary.errorMessage, "La tienda no responde");
    assert.equal(repository.state.runs[1].status, "failed");
    assert.equal(product.missedRuns, 0);
    assert.equal(price.price, 249.95);
    assert.equal(price.checkedAt, DAY_1.toISOString());
  });
});

describe("fallo a mitad de la ejecución", () => {
  it("no deja precios a medio actualizar y registra la ejecución como fallida", async () => {
    const repository = createRepository();
    await ingest(
      repository,
      [
        metalbone(249.95, DAY_1),
        listing({ externalId: "EQ", title: "Pala Nox Equation Hard Advanced 2027", brand: "Nox", price: 112.95 }),
      ],
      DAY_1,
    );
    const before = structuredClone({
      products: repository.state.storeProducts,
      prices: repository.state.publishedPrices,
      history: repository.state.priceHistory,
    });

    // El histórico falla cuando ya se han guardado productos y publicado un precio.
    repository.recordHistory = async () => {
      throw new Error("Fallo de base de datos");
    };
    const summary = await ingest(
      repository,
      [
        metalbone(229.95, DAY_2),
        listing({ externalId: "EQ", title: "Pala Nox Equation Hard Advanced 2027", brand: "Nox", price: 99.95 }, DAY_2),
      ],
      DAY_2,
    );

    assert.equal(summary.status, "failed");
    assert.equal(summary.pricesUpdated, 0);
    assert.equal(repository.state.runs[1].status, "failed");
    assert.deepEqual(repository.state.storeProducts, before.products);
    assert.deepEqual(repository.state.publishedPrices, before.prices);
    assert.deepEqual(repository.state.priceHistory, before.history);
  });
});

describe("escrituras por lotes", () => {
  it("produce exactamente el mismo resultado que la ingestión producto a producto", async () => {
    const repository = createRepository();
    const summaries = [];
    for (const [index, listings] of goldenRuns().entries()) {
      summaries.push(await ingest(repository, listings, GOLDEN_DAYS[index]));
    }

    const golden: unknown = JSON.parse(
      readFileSync(join(process.cwd(), "tests/ingestion/golden/ingestion.json"), "utf8"),
    );
    assert.deepEqual(goldenResult(summaries, repository.state), golden);
  });

  it("no hace una escritura por producto: una llamada por tabla y los agregados una vez", async () => {
    const repository = createRepository();
    const calls: Record<string, number> = {};
    for (const method of ["saveStoreProducts", "publishPrices", "unpublishPrices", "recordHistory", "refreshStats", "listStoreProducts", "listPublishedPrices", "loadCatalog"] as const) {
      const original = repository[method].bind(repository) as (...args: unknown[]) => Promise<unknown>;
      (repository as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
        calls[method] = (calls[method] ?? 0) + 1;
        return original(...args);
      };
    }

    const listings = Array.from({ length: 300 }, (_, i) =>
      metalbone(249.95 + i, DAY_1, { externalId: `MB34-${i}` }),
    );
    const summary = await ingest(repository, listings, DAY_1);

    assert.equal(summary.productsMatched, 300);
    assert.equal(repository.state.storeProducts.length, 300);
    assert.equal(repository.state.publishedPrices[0].price, 249.95);
    assert.deepEqual(calls, {
      loadCatalog: 1,
      listStoreProducts: 1,
      listPublishedPrices: 1,
      saveStoreProducts: 1,
      unpublishPrices: 1,
      publishPrices: 1,
      recordHistory: 1,
      refreshStats: 1,
    });
  });
});

describe("escenario completo del adaptador de prueba", () => {
  it("cubre alta, EAN, agotado, desaparición y cambio de precio en dos lecturas", async () => {
    const repository = createRepository();
    const scenario = mockScenario(DAY_1.toISOString(), DAY_2.toISOString());

    const first = await ingest(repository, scenario.firstRun, DAY_1);
    assert.equal(first.productsSeen, 5);
    assert.equal(first.productsMatched, 4);
    assert.equal(first.pricesUpdated, 3);

    const second = await ingest(repository, scenario.secondRun, DAY_2);
    const byId = new Map(repository.state.storeProducts.map((product) => [product.externalId, product]));
    const published = new Map(repository.state.publishedPrices.map((price) => [price.racketId, price]));

    assert.equal(second.pricesUpdated, 2);
    // EAN distinto: nunca emparejado.
    assert.equal(byId.get("V04")?.matchingStatus, "rejected");
    // Agotado: emparejado pero sin publicar.
    assert.equal(byId.get("KYRA")?.racketId, "kyra-2027");
    assert.equal(published.has("kyra-2027"), false);
    // Desaparecido una vez: sigue publicado con la comprobación antigua.
    assert.equal(byId.get("DRAX")?.missedRuns, 1);
    assert.equal(published.get("drax-plus-2027")?.checkedAt, DAY_1.toISOString());
    // Cambio de precio y producto nuevo.
    assert.equal(published.get(METALBONE)?.previousPrice, 249.95);
    assert.equal(published.get("fenix-pro-2026")?.price, 289.95);
  });
});
