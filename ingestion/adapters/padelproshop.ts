import type { StoreAdapter, StoreListing, StoreShipping } from "../types";

// Adaptador de PadelProShop (Shopify). Fuente autorizada por la tienda: el
// catálogo JSON de su colección de palas. No se lee el HTML de la web.

const BASE_URL = "https://padelproshop.com";
const COLLECTION_PATH = "/collections/palas-padel/products.json";
const PAGE_SIZE = 250;
const MAX_PAGES = 20;
const PAUSE_BETWEEN_PAGES_MS = 1000;
const USER_AGENT = "PalaRadarBot/0.1 (+https://palaradar.es; comparador de precios)";

/** Correos 48/72 h en Península y Baleares: 2,99 € y gratis a partir de 50 €. */
const SHIPPING: StoreShipping = { cost: 2.99, freeFrom: 50 };

interface ShopifyVariant {
  id: number;
  title: string;
  /** En PadelProShop el SKU es el EAN/UPC del producto */
  sku: string | null;
  price: string;
  compare_at_price: string | null;
  available: boolean;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  variants: ShopifyVariant[];
}

interface ProductsPage {
  products: ShopifyProduct[];
}

export type FetchPage = (url: string) => Promise<ProductsPage>;

async function fetchPage(url: string): Promise<ProductsPage> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`PadelProShop respondió ${response.status} en ${url}`);
  }
  return (await response.json()) as ProductsPage;
}

function toNumber(value: string | null): number | null {
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Convierte productos de Shopify al formato común: un listado por variante. */
export function toListings(products: ShopifyProduct[], checkedAt: string): StoreListing[] {
  return products.flatMap((product) =>
    product.variants.map((variant) => ({
      // El id de variante es estable aunque cambien el título o la URL del producto.
      externalId: String(variant.id),
      title:
        product.variants.length > 1 ? `${product.title} ${variant.title}` : product.title,
      brand: product.vendor || null,
      ean: variant.sku,
      url: `${BASE_URL}/products/${product.handle}`,
      price: toNumber(variant.price) ?? Number.NaN,
      listPrice: toNumber(variant.compare_at_price),
      available: variant.available === true,
      checkedAt,
      currency: "EUR",
    })),
  );
}

/**
 * Adaptador de PadelProShop. `fetchJson` y `pause` se pueden sustituir en los
 * tests para no hacer peticiones reales.
 */
export function createPadelProShopAdapter(
  fetchJson: FetchPage = fetchPage,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): StoreAdapter {
  return {
    store: { slug: "padelproshop", name: "PadelProShop", url: BASE_URL, isDemo: false },
    shipping: SHIPPING,

    async fetchProducts() {
      const products: ShopifyProduct[] = [];

      for (let page = 1; page <= MAX_PAGES; page++) {
        if (page > 1) await pause(PAUSE_BETWEEN_PAGES_MS);

        const batch = (await fetchJson(
          `${BASE_URL}${COLLECTION_PATH}?limit=${PAGE_SIZE}&page=${page}`,
        )).products;
        if (!Array.isArray(batch)) throw new Error("Respuesta inesperada de PadelProShop.");

        products.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }

      // Un catálogo vacío es un fallo del origen, no una tienda sin palas: sin
      // esta comprobación, todos sus productos se darían por desaparecidos.
      if (products.length === 0) throw new Error("PadelProShop devolvió un catálogo vacío.");

      return toListings(products, new Date().toISOString());
    },
  };
}
