import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAdapter } from "@/ingestion/adapters";
import {
  createPadelNuestroAdapter,
  pageUrl,
  parseAnnouncedTotal,
  parseProducts,
  toListings,
  type PageResponse,
} from "@/ingestion/adapters/padelnuestro";
import { normalizeGtin } from "@/ingestion/gtin";
import { normalizeListing } from "@/ingestion/normalizer";
import { runIngestion } from "@/ingestion/run";
import { createRepository, DAY_1, DAY_2 } from "./fixtures";

// Productos con la forma real del JSON-LD de /palas-padel (un ItemList dentro de un CollectionPage).
interface Fields {
  sku: string;
  name: string;
  brand?: string | null;
  price?: string | number | null;
  currency?: string | null;
  availability?: string | null;
  url?: string | null;
  image?: string | null;
}

function listItem(fields: Fields, position: number) {
  const url = fields.url === undefined ? `https://www.padelnuestro.com/${fields.sku.toLowerCase()}` : fields.url;
  return {
    "@type": "ListItem",
    position,
    name: fields.name,
    url,
    item: {
      "@type": "Product",
      "@id": `${url}#product`,
      name: fields.name,
      description: "Descripción de la tienda.",
      sku: fields.sku,
      image: fields.image === undefined ? `https://www.padelnuestro.com/media/${fields.sku}.jpg` : fields.image,
      offers: {
        "@type": "Offer",
        price: fields.price === undefined ? "199.95" : fields.price,
        priceCurrency: fields.currency === undefined ? "EUR" : fields.currency,
        url,
        availability:
          fields.availability === undefined ? "https://schema.org/InStock" : fields.availability,
        itemCondition: "https://schema.org/NewCondition",
      },
      ...(fields.brand === null ? {} : { brand: { "@type": "Brand", name: fields.brand ?? "Adidas" } }),
    },
  };
}

function pageHtml(products: Fields[], announced: number): string {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Palas de Pádel",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: products.map((fields, index) => listItem(fields, index + 1)),
    },
  };
  return `<!doctype html><html><head>
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body>
    <p class="toolbar-amount" id="toolbar-amount"> <span class="toolbar-number">${announced}</span> productos </p>
    </body></html>`;
}

const METALBONE: Fields = {
  sku: "113683-P",
  name: "ADIDAS METALBONE 3.4 2025",
  brand: "Adidas",
  price: "199.95",
  url: "https://www.padelnuestro.com/pala-adidas-metalbone-3-4-ar1aa0u22",
  image: "https://www.padelnuestro.com/media/catalog/product/113683.jpg",
};
const EQUATION: Fields = { sku: "162318-P", name: "NOX EQUATION HARD ADVANCED 2027", brand: "Nox", price: "124.95" };
const SOLD_OUT: Fields = {
  sku: "113757-P",
  name: "STARVIE KYRA 2027",
  brand: "StarVie",
  price: 89.95,
  availability: "https://schema.org/OutOfStock",
};

const filler = (count: number, from = 0): Fields[] =>
  Array.from({ length: count }, (_, i) => ({ sku: `F${from + i}-P`, name: `MARCA INVENTADA MODELO ${from + i} 2026`, brand: "Marca Inventada" }));

/** Servidor de mentira: sirve las páginas indicadas y 404 para el resto. */
function server(pages: Record<number, PageResponse | string>) {
  const requested: string[] = [];
  let pauses = 0;
  const fetchPage = async (url: string): Promise<PageResponse> => {
    requested.push(url);
    const page = Number(new URL(url).searchParams.get("p"));
    const response = pages[page];
    if (response === undefined) return { status: 404, html: "<html>No encontrado</html>" };
    return typeof response === "string" ? { status: 200, html: response } : response;
  };
  const pause = async () => {
    pauses++;
  };
  return { adapter: createPadelNuestroAdapter(fetchPage, pause), requested, pauses: () => pauses };
}

describe("JSON-LD del listado de Padel Nuestro", () => {
  it("extrae SKU, nombre, marca, precio, moneda, disponibilidad, URL e imagen", () => {
    const [product] = parseProducts(pageHtml([METALBONE], 1));

    assert.deepEqual(product, {
      sku: "113683-P",
      name: "ADIDAS METALBONE 3.4 2025",
      brand: "Adidas",
      price: 199.95,
      currency: "EUR",
      available: true,
      url: "https://www.padelnuestro.com/pala-adidas-metalbone-3-4-ar1aa0u22",
      image: "https://www.padelnuestro.com/media/catalog/product/113683.jpg",
    });
  });

  it("InStock es disponible; OutOfStock y cualquier otro estado, no", () => {
    const products = parseProducts(
      pageHtml(
        [
          METALBONE,
          SOLD_OUT,
          { sku: "PRE-P", name: "PALA EN RESERVA 2026", availability: "https://schema.org/PreOrder" },
        ],
        3,
      ),
    );
    assert.deepEqual(products.map((product) => product.available), [true, false, false]);
  });

  it("acepta el precio como texto o como número", () => {
    const products = parseProducts(pageHtml([METALBONE, SOLD_OUT], 2));
    assert.deepEqual(products.map((product) => product.price), [199.95, 89.95]);
  });

  it("encuentra el ItemList también dentro de un @graph", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [{ "@type": "WebSite" }, { "@type": "ItemList", itemListElement: [listItem(METALBONE, 1)] }],
    })}</script>`;
    assert.equal(parseProducts(html)[0].sku, "113683-P");
  });

  it("la marca y la imagen son opcionales", () => {
    const [product] = parseProducts(pageHtml([{ sku: "X-P", name: "PALA SIN MARCA 2026", brand: null, image: null }], 1));
    assert.equal(product.brand, null);
    assert.equal(product.image, null);
  });

  for (const [field, broken] of [
    ["sku", { ...METALBONE, sku: "" }],
    ["offers.price", { ...METALBONE, price: null }],
    ["offers.price", { ...METALBONE, price: "gratis" }],
    ["offers.priceCurrency", { ...METALBONE, currency: null }],
    ["offers.availability", { ...METALBONE, availability: null }],
    ["url", { ...METALBONE, url: null }],
  ] as const) {
    it(`falla si a un producto le falta ${field}`, () => {
      assert.throws(() => parseProducts(pageHtml([EQUATION, broken as Fields], 2)), new RegExp(`le falta .*${field}`));
    });
  }

  it("falla si la página no trae el listado de productos", () => {
    assert.throws(() => parseProducts("<html><body>Mantenimiento</body></html>"), /no contiene el listado/);
    assert.throws(
      () => parseProducts('<script type="application/ld+json">{ roto</script>'),
      /no es JSON válido/,
    );
  });

  it("lee el total anunciado, también cuando la barra muestra un rango", () => {
    assert.equal(parseAnnouncedTotal(pageHtml([METALBONE], 916)), 916);
    assert.equal(
      parseAnnouncedTotal(
        '<p class="toolbar-amount" id="toolbar-amount">Artículos <span class="toolbar-number">1</span>-<span class="toolbar-number">36</span> de <span class="toolbar-number">1.916</span></p>',
      ),
      1916,
    );
    assert.throws(() => parseAnnouncedTotal("<html></html>"), /total de productos/);
  });
});

describe("formato común", () => {
  it("usa el SKU como identificador externo y nunca como EAN", () => {
    const [listing] = toListings(parseProducts(pageHtml([METALBONE], 1)), DAY_1.toISOString());

    assert.deepEqual(listing, {
      externalId: "113683-P",
      title: "ADIDAS METALBONE 3.4 2025",
      brand: "Adidas",
      ean: null,
      url: "https://www.padelnuestro.com/pala-adidas-metalbone-3-4-ar1aa0u22",
      price: 199.95,
      listPrice: null,
      available: true,
      checkedAt: DAY_1.toISOString(),
      currency: "EUR",
    });
    assert.equal(normalizeGtin(listing.ean), null);
  });

  it("el precio publicado es el del producto, sin envío, porque la regla de envío no está verificada", () => {
    const adapter = createPadelNuestroAdapter();
    const [listing] = toListings(parseProducts(pageHtml([METALBONE], 1)), DAY_1.toISOString());
    const normalized = normalizeListing(listing, adapter.shipping, DAY_1);

    assert.equal(adapter.shipping, null);
    assert.ok(normalized.ok);
    assert.equal(normalized.offer.price, 199.95);
    assert.equal(normalized.offer.shipping, null);
    assert.equal(normalized.offer.total, 199.95);
    assert.equal(normalized.offer.listPrice, null);
  });

  it("descarta un precio en otra moneda", () => {
    const [listing] = toListings(parseProducts(pageHtml([{ ...METALBONE, currency: "GBP" }], 1)), DAY_1.toISOString());
    const normalized = normalizeListing(listing, null, DAY_1);
    assert.equal(normalized.ok, false);
  });

  it("está registrado como tienda real", () => {
    const adapter = getAdapter("padelnuestro");
    assert.deepEqual(adapter.store, {
      slug: "padelnuestro",
      name: "Padel Nuestro",
      url: "https://www.padelnuestro.com",
      isDemo: false,
    });
  });
});

describe("paginación", () => {
  it("calcula las páginas a partir del total anunciado y confirma el final con un 404", async () => {
    // 80 productos de 36 en 36: 3 páginas (36 + 36 + 8).
    const all = filler(80);
    const { adapter, requested, pauses } = server({
      1: pageHtml(all.slice(0, 36), 80),
      2: pageHtml(all.slice(36, 72), 80),
      3: pageHtml(all.slice(72), 80),
    });
    const listings = await adapter.fetchProducts();

    assert.equal(listings.length, 80);
    assert.deepEqual(requested, [1, 2, 3, 4].map(pageUrl));
    assert.match(requested[0], /\/palas-padel\?p=1&product_list_limit=36&product_list_order=new$/);
    // Secuencial y con una pausa antes de cada petición salvo la primera.
    assert.equal(pauses(), 3);
    assert.deepEqual(adapter.lastFetch, { announced: 80, downloaded: 80, unique: 80, duplicates: 0, pages: 3 });
  });

  it("una sola página también se confirma con el 404 de la siguiente", async () => {
    const { adapter, requested } = server({ 1: pageHtml([METALBONE, EQUATION], 2) });
    assert.equal((await adapter.fetchProducts()).length, 2);
    assert.deepEqual(requested, [1, 2].map(pageUrl));
  });

  it("falla si falta una página intermedia", async () => {
    const all = filler(80);
    const { adapter } = server({ 1: pageHtml(all.slice(0, 36), 80), 3: pageHtml(all.slice(72), 80) });
    await assert.rejects(adapter.fetchProducts(), /falta la página 2 de 3/);
    assert.equal(adapter.lastFetch, null);
  });

  it("falla si falta la última página esperada", async () => {
    const all = filler(80);
    const { adapter } = server({ 1: pageHtml(all.slice(0, 36), 80), 2: pageHtml(all.slice(36, 72), 80) });
    await assert.rejects(adapter.fetchProducts(), /falta la página 3 de 3/);
  });

  it("falla si después de la última página esperada hay otra más", async () => {
    const all = filler(80);
    const { adapter } = server({
      1: pageHtml(all.slice(0, 36), 72),
      2: pageHtml(all.slice(36, 72), 72),
      3: pageHtml(all.slice(72), 72),
    });
    await assert.rejects(adapter.fetchProducts(), /se esperaba el final del listado tras la página 2/);
  });

  it("falla si el número de productos leídos no coincide con el anunciado", async () => {
    const all = filler(80);
    const { adapter } = server({
      1: pageHtml(all.slice(0, 36), 80),
      2: pageHtml(all.slice(36, 70), 80),
      3: pageHtml(all.slice(72), 80),
    });
    await assert.rejects(adapter.fetchProducts(), /anuncia 80 productos y se han leído 78/);
  });

  it("falla si una página responde con un error", async () => {
    const all = filler(80);
    const { adapter } = server({ 1: pageHtml(all.slice(0, 36), 80), 2: { status: 503, html: "" } });
    await assert.rejects(adapter.fetchProducts(), /respondió 503 en la página 2/);

    const down = server({ 1: { status: 403, html: "Forbidden" } });
    await assert.rejects(down.adapter.fetchProducts(), /respondió 403 en la primera página/);
  });
});

describe("duplicados", () => {
  it("un SKU repetido se queda en un único producto y se cuenta", async () => {
    // 72 anunciados; el primero de la página 2 repite uno de la página 1.
    const all = filler(71);
    const { adapter } = server({
      1: pageHtml(all.slice(0, 36), 72),
      2: pageHtml([all[0], ...all.slice(36, 71)], 72),
    });
    const listings = await adapter.fetchProducts();

    assert.equal(listings.length, 71);
    assert.equal(new Set(listings.map((listing) => listing.externalId)).size, 71);
    assert.deepEqual(adapter.lastFetch, { announced: 72, downloaded: 72, unique: 71, duplicates: 1, pages: 2 });
  });

  it("dos productos con el mismo nombre y distinto SKU no son duplicados", async () => {
    const { adapter } = server({
      1: pageHtml([METALBONE, { ...METALBONE, sku: "999999-P" }], 2),
    });
    assert.equal((await adapter.fetchProducts()).length, 2);
    assert.equal(adapter.lastFetch?.duplicates, 0);
  });

  it("demasiados repetidos invalidan la descarga", async () => {
    const all = filler(36);
    const { adapter } = server({
      1: pageHtml(all, 72),
      2: pageHtml(all, 72),
    });
    await assert.rejects(adapter.fetchProducts(), /36 productos repetidos de 72/);
  });
});

describe("ingestión con el adaptador de Padel Nuestro", () => {
  const catalogPage = [
    METALBONE,
    EQUATION,
    SOLD_OUT,
    // Sin año: ambiguo.
    { sku: "AMB-P", name: "NOX EQUATION HARD ADVANCED", brand: "Nox", price: "110.00" },
    // Año distinto al de nuestra pala.
    { sku: "OLD-P", name: "ADIDAS METALBONE 3.4 2024", brand: "Adidas", price: "150.00" },
    // No está en nuestro catálogo.
    { sku: "NEW-P", name: "MARCA INVENTADA MODELO UNO 2026", brand: "Marca Inventada", price: "99.95" },
  ];

  it("empareja sin EAN por marca, modelo y año, y solo publica lo disponible", async () => {
    const repository = createRepository();
    const { adapter } = server({ 1: pageHtml(catalogPage, catalogPage.length) });
    const summary = await runIngestion(adapter, repository, DAY_1);
    const bySku = new Map(repository.state.storeProducts.map((product) => [product.externalId, product]));

    assert.equal(summary.status, "success", summary.errorMessage ?? "");
    assert.equal(summary.productsSeen, 6);
    assert.equal(summary.productsMatched, 3);
    assert.equal(summary.productsPending, 1);

    // Ninguno lleva EAN y los emparejados lo están por atributos.
    assert.ok(repository.state.storeProducts.every((product) => product.gtin === null));
    assert.equal(bySku.get("113683-P")?.matchingMethod, "attributes");
    assert.equal(bySku.get("113683-P")?.racketId, "metalbone-34-2025");
    assert.equal(bySku.get("162318-P")?.racketId, "equation-hard-advanced-2027");

    // Agotado: emparejado, guardado con su precio, pero sin publicar.
    assert.equal(bySku.get("113757-P")?.racketId, "kyra-2027");
    assert.equal(bySku.get("113757-P")?.listingStatus, "out_of_stock");
    assert.equal(bySku.get("113757-P")?.price, 89.95);

    // Ambiguo → revisión; año distinto y fuera de catálogo → sin emparejar. Ninguno crea palas.
    assert.equal(bySku.get("AMB-P")?.matchingStatus, "pending_review");
    assert.equal(bySku.get("AMB-P")?.racketId, null);
    assert.equal(bySku.get("OLD-P")?.matchingStatus, "rejected");
    assert.equal(bySku.get("NEW-P")?.matchingStatus, "rejected");
    assert.equal(bySku.get("NEW-P")?.racketId, null);

    const published = new Map(repository.state.publishedPrices.map((price) => [price.racketId, price]));
    assert.deepEqual([...published.keys()].sort(), ["equation-hard-advanced-2027", "metalbone-34-2025"]);
    assert.equal(published.get("metalbone-34-2025")?.price, 199.95);
    assert.equal(published.get("metalbone-34-2025")?.shipping, null);
    assert.equal(published.get("metalbone-34-2025")?.previousPrice, null);
    assert.equal(published.get("metalbone-34-2025")?.url, METALBONE.url);
    assert.deepEqual(
      repository.state.priceHistory.map((row) => [row.racket_id, row.price]).sort(),
      [["equation-hard-advanced-2027", 124.95], ["metalbone-34-2025", 199.95]],
    );
  });

  it("el precio anterior sale de nuestro histórico al cambiar el precio", async () => {
    const repository = createRepository();
    await runIngestion(server({ 1: pageHtml([METALBONE], 1) }).adapter, repository, DAY_1);
    await runIngestion(server({ 1: pageHtml([{ ...METALBONE, price: "189.95" }], 1) }).adapter, repository, DAY_2);

    const [price] = repository.state.publishedPrices;
    assert.equal(price.price, 189.95);
    assert.equal(price.previousPrice, 199.95);
  });

  it("una descarga que no cuadra no escribe nada y conserva los precios anteriores", async () => {
    const repository = createRepository();
    await runIngestion(server({ 1: pageHtml([METALBONE, EQUATION], 2) }).adapter, repository, DAY_1);
    const before = structuredClone({
      products: repository.state.storeProducts,
      prices: repository.state.publishedPrices,
      history: repository.state.priceHistory,
    });

    // La tienda anuncia 40 productos, pero falta la segunda página.
    const broken = server({ 1: pageHtml([{ ...METALBONE, price: "1.00" }, ...filler(35)], 40) });
    const summary = await runIngestion(broken.adapter, repository, DAY_2);

    assert.equal(summary.status, "failed");
    assert.match(summary.errorMessage ?? "", /falta la página 2 de 2/);
    assert.deepEqual(repository.state.storeProducts, before.products);
    assert.deepEqual(repository.state.publishedPrices, before.prices);
    assert.deepEqual(repository.state.priceHistory, before.history);
    assert.equal(repository.state.runs[1].status, "failed");
  });
});
