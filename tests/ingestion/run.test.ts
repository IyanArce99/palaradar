import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createMockAdapter, GTIN_METALBONE_34_2025, mockScenario } from "@/ingestion/adapters/mock";
import { normalizeGtin } from "@/ingestion/gtin";
import { CONFLICT_NOTE_PREFIX, DROP_IDENTITY_PREFIX, isHumanOnlyReview, KEPT_LINK_PREFIX, runIngestion } from "@/ingestion/run";
import type { StoreListing } from "@/ingestion/types";
import { createMemoryIngestionRepository } from "@/ingestion/memory-repository";
import { catalog, createRepository, DAY_1, DAY_2, DAY_3, listing, STORE } from "./fixtures";
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

// Etapa 1 de la auditoría: varios productos de una tienda en la misma pala.
describe("varios productos de una tienda en la misma pala", () => {
  const galan = (price: number, at: Date, extra: Partial<StoreListing> = {}) =>
    listing(
      { externalId: "GALAN", title: "Pala Adidas Ale Galán edición especial", brand: "Adidas", ean: GTIN_METALBONE_34_2025, url: "https://example.com/producto/GALAN", price, ...extra },
      at,
    );

  it("con el mismo nombre son duplicados: se publica el más barato y se cuentan", async () => {
    const repository = createRepository();
    const summary = await ingest(repository, [metalbone(259.95, DAY_1, { externalId: "MB34-A" }), metalbone(249.95, DAY_1, { externalId: "MB34-B" })], DAY_1);

    assert.equal(repository.state.publishedPrices[0].price, 249.95);
    assert.equal(summary.duplicateOffers, 1);
    assert.equal(summary.productsConflicting, 0);
    assert.deepEqual(summary.conflicts, []);
  });

  it("con otro nombre es un conflicto: se mantiene el publicado y el nuevo va a revisión, sin publicar su precio", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(249.95, DAY_1, { externalId: "MB34-A" })], DAY_1);
    const summary = await ingest(repository, [metalbone(249.95, DAY_2, { externalId: "MB34-A" }), galan(199.95, DAY_2)], DAY_2);

    const byId = new Map(repository.state.storeProducts.map((product) => [product.externalId, product]));
    const [price] = repository.state.publishedPrices;

    assert.equal(price.price, 249.95);
    assert.equal(price.url, "https://example.com/producto");
    assert.equal(byId.get("GALAN")?.matchingStatus, "pending_review");
    assert.equal(byId.get("GALAN")?.racketId, null);
    assert.match(byId.get("GALAN")?.matchingNote ?? "", /^Conflicto en la tienda: «Pala Adidas Metalbone 3.4 2025» \(MB34-A\)/);
    assert.equal(byId.get("MB34-A")?.matchingStatus, "matched");
    assert.equal(summary.productsConflicting, 1);
    assert.equal(summary.productsPending, 1);
    assert.equal(summary.productsMatched, 1);
    assert.deepEqual(summary.conflicts, [{ racketId: METALBONE, kept: "MB34-A", review: ["GALAN"] }]);
    // El histórico no mezcla los dos productos.
    assert.deepEqual(repository.state.priceHistory.map((row) => row.price), [249.95, 249.95]);
  });

  it("sin nada publicado ni fijado, ninguno se publica: los dos van a revisión", async () => {
    const repository = createRepository();
    const summary = await ingest(repository, [metalbone(249.95, DAY_1, { externalId: "MB34-A" }), galan(199.95, DAY_1)], DAY_1);

    assert.equal(repository.state.publishedPrices.length, 0);
    assert.ok(repository.state.storeProducts.every((product) => product.matchingStatus === "pending_review"));
    assert.equal(summary.productsMatched, 0);
    assert.equal(summary.productsConflicting, 2);
    assert.deepEqual(summary.conflicts, [{ racketId: METALBONE, kept: null, review: ["MB34-A", "GALAN"] }]);
  });

  it("un enlace fijado a mano manda sobre el automático que choca con él", async () => {
    const repository = createRepository();
    await ingest(repository, [galan(199.95, DAY_1)], DAY_1);
    Object.assign(repository.state.storeProducts[0], { matchingMethod: "manual", matchingNote: "Es la Metalbone 3.4: edición de Ale Galán." });
    await ingest(repository, [galan(199.95, DAY_2), metalbone(249.95, DAY_2, { externalId: "MB34-A" })], DAY_2);

    const byId = new Map(repository.state.storeProducts.map((product) => [product.externalId, product]));
    assert.equal(byId.get("GALAN")?.matchingStatus, "matched");
    assert.equal(byId.get("GALAN")?.matchingNote, "Es la Metalbone 3.4: edición de Ale Galán.");
    assert.equal(byId.get("MB34-A")?.matchingStatus, "pending_review");
    assert.equal(repository.state.publishedPrices[0].url, "https://example.com/producto/GALAN");
  });

  it("si el producto mantenido se agota, el conflictivo sigue en revisión y la pala se queda sin precio", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(249.95, DAY_1, { externalId: "MB34-A" })], DAY_1);
    await ingest(repository, [metalbone(249.95, DAY_2, { externalId: "MB34-A" }), galan(199.95, DAY_2)], DAY_2);
    const summary = await ingest(repository, [metalbone(249.95, DAY_3, { externalId: "MB34-A", available: false }), galan(199.95, DAY_3)], DAY_3);

    const byId = new Map(repository.state.storeProducts.map((product) => [product.externalId, product]));
    assert.equal(repository.state.publishedPrices.length, 0);
    assert.equal(byId.get("GALAN")?.matchingStatus, "pending_review");
    assert.ok(byId.get("GALAN")?.matchingNote?.startsWith(CONFLICT_NOTE_PREFIX));
    // El conflicto ya estaba: no se vuelve a contar como nuevo.
    assert.equal(summary.productsConflicting, 0);
  });

  it("cuando el producto publicado cambia por otro, no hay «precio anterior» y se cuenta el cambio", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(249.95, DAY_1, { externalId: "MB34-A" })], DAY_1);
    const summary = await ingest(
      repository,
      [metalbone(249.95, DAY_2, { externalId: "MB34-A", available: false }), metalbone(239.95, DAY_2, { externalId: "MB34-B" })],
      DAY_2,
    );

    const [price] = repository.state.publishedPrices;
    assert.equal(price.price, 239.95);
    assert.equal(price.previousPrice, null);
    assert.equal(price.url, "https://example.com/producto");
    assert.equal(summary.offerSwitches, 1);
  });
});

// C4: un conflicto de identidad solo lo resuelve una persona; el stock o la ausencia del otro producto no lo deshacen.
describe("un conflicto solo lo resuelve una persona", () => {
  const anchor = (at: Date, extra: Partial<StoreListing> = {}) => metalbone(249.95, at, { externalId: "MB34-A", ...extra });
  const galan = (at: Date) =>
    listing({ externalId: "GALAN", title: "Pala Adidas Ale Galán edición especial", brand: "Adidas", ean: GTIN_METALBONE_34_2025, url: "https://example.com/producto/GALAN", price: 199.95 }, at);
  const DAY_4 = new Date("2026-10-08T06:00:00Z");
  const DAY_5 = new Date("2026-10-09T06:00:00Z");

  /** Ancla publicada el día 1; el conflictivo llega el día 2. */
  async function withConflict() {
    const repository = createRepository();
    await ingest(repository, [anchor(DAY_1)], DAY_1);
    await ingest(repository, [anchor(DAY_2), galan(DAY_2)], DAY_2);
    return repository;
  }
  const product = (repository: ReturnType<typeof createRepository>, id: string) =>
    repository.state.storeProducts.find((item) => item.externalId === id);

  it("el ancla desaparece dos ejecuciones: el conflictivo no se empareja ni se publica", async () => {
    const repository = await withConflict();
    await ingest(repository, [galan(DAY_3)], DAY_3);
    const summary = await ingest(repository, [galan(DAY_4)], DAY_4);

    assert.equal(product(repository, "MB34-A")?.listingStatus, "missing");
    assert.equal(product(repository, "GALAN")?.matchingStatus, "pending_review");
    assert.ok(product(repository, "GALAN")?.matchingNote?.startsWith(CONFLICT_NOTE_PREFIX));
    assert.equal(repository.state.publishedPrices.length, 0);
    assert.equal(summary.productsMatched, 0);
  });

  it("el ancla reaparece: el conflicto sigue igual", async () => {
    const repository = await withConflict();
    await ingest(repository, [galan(DAY_3)], DAY_3);
    await ingest(repository, [galan(DAY_4)], DAY_4);
    await ingest(repository, [anchor(DAY_5), galan(DAY_5)], DAY_5);

    assert.equal(product(repository, "MB34-A")?.matchingStatus, "matched");
    assert.equal(product(repository, "GALAN")?.matchingStatus, "pending_review");
    assert.equal(repository.state.publishedPrices[0]?.url, "https://example.com/producto");
  });

  it("una ejecución fallida no cuenta como ausencia ni cambia el conflicto", async () => {
    const repository = await withConflict();
    const summary = await runIngestion(createMockAdapter([], { fail: "La tienda no responde" }), repository, DAY_3);

    assert.equal(summary.status, "failed");
    assert.equal(product(repository, "MB34-A")?.missedRuns, 0);
    assert.equal(product(repository, "GALAN")?.matchingStatus, "pending_review");
    assert.equal(repository.state.publishedPrices[0]?.price, 249.95);
  });

  it("una decisión manual resuelve el conflicto y el producto pasa a publicarse", async () => {
    const repository = await withConflict();
    // La persona confirma que la edición Galán es la Metalbone 3.4 (lo que haría prices:decisions con «match»).
    Object.assign(product(repository, "GALAN") as object, {
      matchingStatus: "matched",
      matchingMethod: "manual",
      racketId: METALBONE,
      matchingNote: "Es la Metalbone 3.4, edición de Ale Galán.",
    });
    await ingest(repository, [anchor(DAY_3), galan(DAY_3)], DAY_3);

    assert.equal(product(repository, "GALAN")?.matchingStatus, "matched");
    assert.equal(repository.state.publishedPrices[0]?.price, 199.95);
  });

  it("una revisión por otro motivo sigue recalculándose: se resuelve sola cuando el catálogo lo permite", async () => {
    const catalogCopy = catalog.map((racket) => ({ ...racket, gtins: [...racket.gtins] }));
    const repository = createMemoryIngestionRepository([STORE], catalogCopy);
    catalogCopy.push({ id: "fenix-pro-2026-bis", brand: "Siux", model: "Fenix Pro", year: 2026, gtins: [] });
    const fenix = (at: Date) => listing({ externalId: "FENIX", title: "Pala Siux Fenix Pro 2026", brand: "Siux", price: 289.95 }, at);
    await ingest(repository, [fenix(DAY_1)], DAY_1);
    assert.equal(product(repository, "FENIX")?.matchingStatus, "pending_review");

    catalogCopy.pop();
    await ingest(repository, [fenix(DAY_2)], DAY_2);
    assert.equal(product(repository, "FENIX")?.matchingStatus, "matched");
    assert.equal(product(repository, "FENIX")?.racketId, "fenix-pro-2026");
  });

  it("isHumanOnlyReview distingue el conflicto de las demás revisiones", () => {
    const base = { matchingStatus: "pending_review" as const, matchingMethod: null };
    assert.equal(isHumanOnlyReview({ ...base, matchingNote: `${CONFLICT_NOTE_PREFIX}…` }), true);
    assert.equal(isHumanOnlyReview({ ...base, matchingNote: `${DROP_IDENTITY_PREFIX}…` }), true);
    assert.equal(isHumanOnlyReview({ ...base, matchingNote: "Varias palas del catálogo podrían coincidir." }), false);
    assert.equal(isHumanOnlyReview({ ...base, matchingNote: null }), false);
    assert.equal(isHumanOnlyReview({ matchingStatus: "matched", matchingMethod: "gtin", matchingNote: `${CONFLICT_NOTE_PREFIX}…` }), false);
    assert.equal(isHumanOnlyReview({ matchingStatus: "pending_review", matchingMethod: "manual", matchingNote: `${CONFLICT_NOTE_PREFIX}…` }), false);
  });
});

// D3 reforzado: repetir un precio demuestra persistencia, no identidad.
describe("bajada extrema e identidad del producto", () => {
  const G = "8445402973996";
  const oxdog = [{ id: "ultimate-pro-2026", brand: "Oxdog", model: "Ultimate Pro", year: 2026, gtins: [normalizeGtin(G) as string] }];
  const createOxdog = () => createMemoryIngestionRepository([STORE], oxdog);
  const pro = (price: number, at: Date, extra: Partial<StoreListing> = {}) =>
    listing({ externalId: "PRO", title: "Pala Oxdog Ultimate Pro 2026", brand: "Oxdog", ean: G, url: "https://example.com/products/ultimate-pro", price, ...extra }, at);
  const product = (repository: ReturnType<typeof createOxdog>, id: string) =>
    repository.state.storeProducts.find((item) => item.externalId === id);

  it("un fallo de extracción entre las dos observaciones no confirma la retención", async () => {
    const repository = createOxdog();
    await ingest(repository, [pro(300, DAY_1)], DAY_1);
    await ingest(repository, [pro(150, DAY_2)], DAY_2);
    await runIngestion(createMockAdapter([], { fail: "La tienda no responde" }), repository, DAY_3);
    assert.equal(repository.state.publishedPrices[0].price, 300);
    assert.equal(product(repository, "PRO")?.pendingPrice, 150);

    await ingest(repository, [pro(150, new Date("2026-10-08T06:00:00Z"))], new Date("2026-10-08T06:00:00Z"));
    assert.equal(repository.state.publishedPrices[0].price, 150);
  });

  it("otro precio bajo durante la retención se acepta como hasta ahora", async () => {
    const repository = createOxdog();
    await ingest(repository, [pro(300, DAY_1)], DAY_1);
    await ingest(repository, [pro(150, DAY_2)], DAY_2);
    await ingest(repository, [pro(145, DAY_3)], DAY_3);
    assert.equal(repository.state.publishedPrices[0].price, 145);
  });

  it("«Pro+» no es «Pro»: el producto nuevo barato va a revisión, no se retiene ni se publica al repetir", async () => {
    const repository = createOxdog();
    await ingest(repository, [pro(300, DAY_1)], DAY_1);
    const plus = (at: Date) => pro(150, at, { externalId: "PLUS", title: "Pala Oxdog Ultimate Pro+ 2026" });
    const summary = await ingest(repository, [pro(300, DAY_2), plus(DAY_2)], DAY_2);
    await ingest(repository, [pro(300, DAY_3), plus(DAY_3)], DAY_3);

    assert.equal(product(repository, "PLUS")?.matchingStatus, "pending_review");
    assert.ok(product(repository, "PLUS")?.matchingNote?.startsWith(DROP_IDENTITY_PREFIX));
    assert.match(product(repository, "PLUS")?.matchingNote ?? "", /«Pala Oxdog Ultimate Pro 2026» \(PRO\)/);
    assert.equal(summary.pricesHeld, 0);
    assert.equal(repository.state.publishedPrices[0].price, 300);
    assert.equal(repository.state.publishedPrices[0].url, "https://example.com/products/ultimate-pro");
  });

  it("«Youth» no es el modelo adulto, y otro año tampoco", async () => {
    for (const title of ["Pala Oxdog Ultimate Pro Youth 2026", "Pala Oxdog Ultimate Pro 2025"]) {
      const repository = createOxdog();
      await ingest(repository, [pro(300, DAY_1)], DAY_1);
      await ingest(repository, [pro(300, DAY_2), pro(150, DAY_2, { externalId: "OTRO", title })], DAY_2);
      await ingest(repository, [pro(300, DAY_3), pro(150, DAY_3, { externalId: "OTRO", title })], DAY_3);
      assert.equal(product(repository, "OTRO")?.matchingStatus, "pending_review", title);
      assert.equal(repository.state.publishedPrices[0].price, 300, title);
    }
  });

  it("la URL compartida no decide: con el mismo nombre se retiene y acepta; con otro, revisión", async () => {
    const same = createOxdog();
    await ingest(same, [pro(300, DAY_1)], DAY_1);
    await ingest(same, [pro(300, DAY_2), pro(150, DAY_2, { externalId: "VAR-2" })], DAY_2);
    assert.equal(product(same, "VAR-2")?.pendingPrice, 150);
    await ingest(same, [pro(300, DAY_3), pro(150, DAY_3, { externalId: "VAR-2" })], DAY_3);
    assert.equal(same.state.publishedPrices[0].price, 150);

    const other = createOxdog();
    await ingest(other, [pro(300, DAY_1)], DAY_1);
    await ingest(other, [pro(300, DAY_2), pro(150, DAY_2, { externalId: "VAR-2", title: "Pala Oxdog Ultimate Pro+ 2026" })], DAY_2);
    assert.equal(product(other, "VAR-2")?.matchingStatus, "pending_review");
  });

  it("sin saber qué producto daba el precio publicado, la bajada va a revisión", async () => {
    const repository = createOxdog();
    // Precio publicado heredado sin producto de tienda detrás (datos anteriores a store_products).
    repository.state.publishedPrices.push({
      racketId: "ultimate-pro-2026", storeId: STORE.id, price: 300, previousPrice: null, shipping: 0,
      availability: "En stock", url: "https://example.com/products/antiguo", checkedAt: DAY_1.toISOString(),
    });
    await ingest(repository, [pro(150, DAY_2)], DAY_2);

    assert.equal(product(repository, "PRO")?.matchingStatus, "pending_review");
    assert.match(product(repository, "PRO")?.matchingNote ?? "", /no se sabe qué producto daba ese precio/);
    // La pala deja de tener precio: el publicado no tiene producto activo que lo sostenga.
    assert.equal(repository.state.publishedPrices.length, 0);
  });

  it("el mismo producto que cambia de nombre al bajar más de un 40 % no se acepta solo", async () => {
    const repository = createOxdog();
    await ingest(repository, [pro(300, DAY_1)], DAY_1);
    await ingest(repository, [pro(150, DAY_2, { title: "Pala Oxdog Ultimate Pro+ 2026" })], DAY_2);

    assert.equal(product(repository, "PRO")?.matchingStatus, "pending_review");
    assert.match(product(repository, "PRO")?.matchingNote ?? "", /ha cambiado de nombre/);
    assert.equal(repository.state.publishedPrices.length, 0);
  });

  it("el precio anterior y su fecha se conservan mientras el nuevo está retenido o pendiente", async () => {
    const repository = createOxdog();
    await ingest(repository, [pro(300, DAY_1)], DAY_1);
    await ingest(repository, [pro(300, DAY_2), pro(150, DAY_2, { externalId: "NUEVO" })], DAY_2);
    const [held] = repository.state.publishedPrices;
    assert.deepEqual([held.price, held.url, held.checkedAt], [300, "https://example.com/products/ultimate-pro", DAY_2.toISOString()]);
    assert.deepEqual(repository.state.priceHistory.map((row) => row.price), [300, 300]);
  });
});

describe("bajada de más del 40 % que llega en otro producto", () => {
  it("un producto nuevo mucho más barato que el precio publicado de su pala se retiene y no se publica", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(200, DAY_1, { externalId: "A" })], DAY_1);
    const summary = await ingest(repository, [metalbone(200, DAY_2, { externalId: "A" }), metalbone(90, DAY_2, { externalId: "B" })], DAY_2);

    const byId = new Map(repository.state.storeProducts.map((product) => [product.externalId, product]));
    const [price] = repository.state.publishedPrices;

    assert.equal(summary.pricesHeld, 1);
    assert.equal(price.price, 200);
    assert.equal(byId.get("B")?.price, null);
    assert.equal(byId.get("B")?.pendingPrice, 90);
    assert.equal(byId.get("B")?.matchingStatus, "matched");
    assert.deepEqual(repository.state.priceHistory.map((row) => row.price), [200, 200]);
  });

  it("se acepta cuando la ejecución siguiente la repite, como un cambio de producto", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(200, DAY_1, { externalId: "A" })], DAY_1);
    await ingest(repository, [metalbone(200, DAY_2, { externalId: "A" }), metalbone(90, DAY_2, { externalId: "B" })], DAY_2);
    const summary = await ingest(repository, [metalbone(200, DAY_3, { externalId: "A" }), metalbone(90, DAY_3, { externalId: "B" })], DAY_3);

    const [price] = repository.state.publishedPrices;
    assert.equal(price.price, 90);
    assert.equal(price.previousPrice, null);
    assert.equal(summary.offerSwitches, 1);
    assert.equal(summary.pricesHeld, 0);
  });

  it("con el producto anterior agotado, el nuevo barato también espera una ejecución", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(200, DAY_1, { externalId: "A" })], DAY_1);
    const held = await ingest(repository, [metalbone(200, DAY_2, { externalId: "A", available: false }), metalbone(90, DAY_2, { externalId: "B" })], DAY_2);
    assert.equal(held.pricesHeld, 1);
    assert.equal(repository.state.publishedPrices.length, 0);

    await ingest(repository, [metalbone(200, DAY_3, { externalId: "A", available: false }), metalbone(90, DAY_3, { externalId: "B" })], DAY_3);
    assert.equal(repository.state.publishedPrices[0]?.price, 90);
  });

  it("un producto nuevo con una oferta normal se publica a la primera", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(200, DAY_1, { externalId: "A" })], DAY_1);
    const summary = await ingest(repository, [metalbone(200, DAY_2, { externalId: "A" }), metalbone(180, DAY_2, { externalId: "B" })], DAY_2);

    assert.equal(summary.pricesHeld, 0);
    assert.equal(repository.state.publishedPrices[0].price, 180);
  });

  it("un producto nuevo barato cuya identidad no cuadra queda en revisión, no publicado", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(200, DAY_1, { externalId: "A" })], DAY_1);
    const other = listing({ externalId: "X", title: "Pala Adidas Ale Galán edición especial", brand: "Adidas", ean: GTIN_METALBONE_34_2025, price: 90 }, DAY_2);
    await ingest(repository, [metalbone(200, DAY_2, { externalId: "A" }), other], DAY_2);
    await ingest(repository, [metalbone(200, DAY_3, { externalId: "A" }), { ...other, checkedAt: DAY_3.toISOString() }], DAY_3);

    const byId = new Map(repository.state.storeProducts.map((product) => [product.externalId, product]));
    assert.equal(repository.state.publishedPrices[0].price, 200);
    assert.equal(byId.get("X")?.matchingStatus, "pending_review");
  });

  it("el mismo producto que baja un 55 % se sigue reteniendo igual que antes", async () => {
    const repository = createRepository();
    await ingest(repository, [metalbone(200, DAY_1)], DAY_1);
    const summary = await ingest(repository, [metalbone(90, DAY_2)], DAY_2);
    assert.equal(summary.pricesHeld, 1);
    assert.equal(repository.state.publishedPrices[0].price, 200);
  });
});

describe("el catálogo crece", () => {
  const fenix = (at: Date, extra: Partial<StoreListing> = {}) =>
    listing({ externalId: "FENIX", title: "Pala Siux Fenix Pro 2026", brand: "Siux", price: 289.95, ...extra }, at);
  // Cada test muta su propio catálogo: el de los fixtures lo comparten los demás.
  const createRepository = () => createMemoryIngestionRepository([STORE], catalog.map((racket) => ({ ...racket, gtins: [...racket.gtins] })));

  it("un enlace automático que funcionaba se conserva con aviso cuando aparece una pala igual de parecida", async () => {
    const repository = createRepository();
    await ingest(repository, [fenix(DAY_1)], DAY_1);
    repository.state.catalog.push({ id: "fenix-pro-2026-bis", brand: "Siux", model: "Fenix Pro", year: 2026, gtins: [] });
    const summary = await ingest(repository, [fenix(DAY_2), fenix(DAY_2, { externalId: "FENIX-NUEVO" })], DAY_2);

    const byId = new Map(repository.state.storeProducts.map((product) => [product.externalId, product]));
    assert.equal(byId.get("FENIX")?.matchingStatus, "matched");
    assert.equal(byId.get("FENIX")?.racketId, "fenix-pro-2026");
    assert.equal(byId.get("FENIX")?.matchingNote, `${KEPT_LINK_PREFIX}Varias palas del catálogo podrían coincidir.`);
    assert.equal(repository.state.publishedPrices[0]?.racketId, "fenix-pro-2026");
    // Un producto nuevo con la misma duda sí queda en revisión.
    assert.equal(byId.get("FENIX-NUEVO")?.matchingStatus, "pending_review");
    assert.equal(summary.linksKept, 1);
  });

  it("si la pala deja de ser candidata, el enlace sigue la regla y la nota desaparece al resolverse", async () => {
    const repository = createRepository();
    await ingest(repository, [fenix(DAY_1)], DAY_1);
    const added = { id: "fenix-pro-2026-bis", brand: "Siux", model: "Fenix Pro", year: 2026, gtins: [] };
    repository.state.catalog.push(added);
    await ingest(repository, [fenix(DAY_2)], DAY_2);
    // La pala original cambia de año: ya no es candidata, y la nueva queda como única.
    const original = repository.state.catalog.find((racket) => racket.id === "fenix-pro-2026");
    if (original) original.year = 2025;
    await ingest(repository, [fenix(DAY_3)], DAY_3);

    const [product] = repository.state.storeProducts;
    assert.equal(product.racketId, "fenix-pro-2026-bis");
    assert.equal(product.matchingNote, null);
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
