import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPadelProShopAdapter, toListings } from "@/ingestion/adapters/padelproshop";
import { normalizeGtin } from "@/ingestion/gtin";
import { runIngestion } from "@/ingestion/run";
import { createRepository, DAY_1 } from "./fixtures";

// Productos con la forma real de /collections/palas-padel/products.json.
function product(id: number, fields: { title: string; vendor: string; handle: string; sku: string | null; price: string; compareAt?: string | null; available?: boolean }) {
  return {
    id,
    title: fields.title,
    handle: fields.handle,
    vendor: fields.vendor,
    product_type: "Palas",
    variants: [
      {
        id: id * 10,
        title: "Default Title",
        sku: fields.sku,
        price: fields.price,
        compare_at_price: fields.compareAt ?? null,
        available: fields.available ?? true,
      },
    ],
  };
}

const METALBONE = product(1, {
  title: "Pala Adidas Metalbone 3.4 2025 Ale Galán",
  vendor: "Adidas",
  handle: "pala-adidas-metalbone-3-4-ale-galan",
  sku: "8435739402740",
  price: "214.00",
  compareAt: "390.00",
  available: false,
});
const NO_EAN = product(2, {
  title: "Pala Nox Equation Hard Advanced 2027",
  vendor: "Nox",
  handle: "pala-nox-equation",
  sku: "NOX-INTERNO",
  price: "112.95",
});

const noPause = async () => {};

describe("adaptador de PadelProShop", () => {
  it("convierte un producto de Shopify al formato común", () => {
    const [listing] = toListings([METALBONE], DAY_1.toISOString());

    assert.deepEqual(listing, {
      externalId: "10",
      title: "Pala Adidas Metalbone 3.4 2025 Ale Galán",
      brand: "Adidas",
      ean: "8435739402740",
      url: "https://padelproshop.com/products/pala-adidas-metalbone-3-4-ale-galan",
      price: 214,
      listPrice: 390,
      available: false,
      checkedAt: DAY_1.toISOString(),
      currency: "EUR",
    });
  });

  it("un SKU que no es un código de barras no se toma por EAN", () => {
    const [listing] = toListings([NO_EAN], DAY_1.toISOString());

    assert.equal(normalizeGtin(listing.ean), null);
  });

  it("recorre las páginas hasta la última y hace una pausa entre ellas", async () => {
    const fullPage = Array.from({ length: 250 }, (_, i) =>
      product(100 + i, { title: `Pala ${i}`, vendor: "Marca", handle: `pala-${i}`, sku: null, price: "100.00" }),
    );
    const requested: string[] = [];
    let pauses = 0;

    const adapter = createPadelProShopAdapter(
      async (url) => {
        requested.push(url);
        return { products: requested.length === 1 ? fullPage : [METALBONE] };
      },
      async () => {
        pauses++;
      },
    );
    const listings = await adapter.fetchProducts();

    assert.equal(listings.length, 251);
    assert.equal(pauses, 1);
    assert.deepEqual(requested, [
      "https://padelproshop.com/collections/palas-padel/products.json?limit=250&page=1",
      "https://padelproshop.com/collections/palas-padel/products.json?limit=250&page=2",
    ]);
  });

  it("un catálogo vacío es un fallo: no da por desaparecidos todos los productos", async () => {
    const repository = createRepository();
    await runIngestion(
      createPadelProShopAdapter(async () => ({ products: [METALBONE] }), noPause),
      repository,
      DAY_1,
    );
    const summary = await runIngestion(
      createPadelProShopAdapter(async () => ({ products: [] }), noPause),
      repository,
      DAY_1,
    );

    assert.equal(summary.status, "failed");
    assert.match(summary.errorMessage ?? "", /catálogo vacío/);
    assert.equal(repository.state.storeProducts[0].missedRuns, 0);
  });

  it("un error de la tienda deja la ejecución como fallida", async () => {
    const repository = createRepository();
    const summary = await runIngestion(
      createPadelProShopAdapter(async () => {
        throw new Error("PadelProShop respondió 503");
      }, noPause),
      repository,
      DAY_1,
    );

    assert.equal(summary.status, "failed");
    assert.equal(repository.state.storeProducts.length, 0);
  });

  it("empareja por EAN y no publica el producto agotado", async () => {
    const repository = createRepository();
    const summary = await runIngestion(
      createPadelProShopAdapter(async () => ({ products: [METALBONE, NO_EAN] }), noPause),
      repository,
      DAY_1,
    );

    const byTitle = new Map(repository.state.storeProducts.map((p) => [p.title, p]));

    assert.equal(summary.productsMatched, 2);
    assert.equal(byTitle.get(METALBONE.title)?.matchingMethod, "gtin");
    assert.equal(byTitle.get(METALBONE.title)?.listingStatus, "out_of_stock");
    assert.equal(byTitle.get(NO_EAN.title)?.matchingMethod, "attributes");
    assert.deepEqual(
      repository.state.publishedPrices.map((price) => price.racketId),
      ["equation-hard-advanced-2027"],
    );
  });
});
