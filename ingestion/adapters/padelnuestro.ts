import type { FetchReport, StoreAdapter, StoreListing } from "../types";

// Adaptador de Padel Nuestro (Magento 2). Fuente autorizada por la tienda: el
// listado de su categoría de palas, que incluye los datos estructurados
// (JSON-LD, un ItemList con un Product por pala) de cada producto. No se leen
// las fichas individuales ni se interpreta el HTML visible.
//
// La tienda no publica EAN: su `sku` es un código interno y solo sirve como
// identificador del producto en la tienda. El emparejamiento va por las reglas
// de marca, modelo, variante y año.

const BASE_URL = "https://www.padelnuestro.com";
const CATEGORY_PATH = "/palas-padel";
const PAGE_SIZE = 36;
/**
 * Orden «Más nuevo». El orden por defecto («Más vendidos») tiene muchos empates
 * y reparte los productos de forma distinta en cada página pedida: en una
 * pasada de prueba repitió 67 de 916 productos y, por tanto, dejó fuera otros 67.
 */
const SORT_ORDER = "new";
/** Proporción máxima de productos repetidos (es decir, no leídos) que se tolera en una descarga. */
const MAX_DUPLICATE_RATIO = 0.02;
/** Tope de seguridad: muy por encima del catálogo real (unas 26 páginas). */
const MAX_PAGES = 200;
const PAUSE_BETWEEN_PAGES_MS = 1500;
const REQUEST_TIMEOUT_MS = 30_000;
const USER_AGENT = "PalaRadarPriceBot/1.0 (+https://palaradar.com)";

const IN_STOCK = "InStock";

export interface PageResponse {
  status: number;
  html: string;
}

export type FetchHtml = (url: string) => Promise<PageResponse>;

async function fetchHtml(url: string): Promise<PageResponse> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html", "Accept-Language": "es-ES,es;q=0.9" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return { status: response.status, html: await response.text() };
}

export function pageUrl(page: number): string {
  return `${BASE_URL}${CATEGORY_PATH}?p=${page}&product_list_limit=${PAGE_SIZE}&product_list_order=${SORT_ORDER}`;
}

/** Un producto del listado, tal como lo publica la tienda en su JSON-LD. */
export interface PadelNuestroProduct {
  /** Código interno de Padel Nuestro (p. ej. «113683-P»). NO es un EAN */
  sku: string;
  name: string;
  brand: string | null;
  price: number;
  currency: string;
  available: boolean;
  url: string;
  /** Imagen de la tienda. Informativa: PalaRadar no la guarda ni la muestra */
  image: string | null;
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null;
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch {
      throw new Error("Padel Nuestro: un bloque JSON-LD del listado no es JSON válido.");
    }
  }
  return blocks;
}

/** El ItemList de productos, esté en la raíz, en `mainEntity` o dentro de un `@graph`. */
function findItemList(node: unknown): Json | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findItemList(item);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(node)) return null;
  if (node["@type"] === "ItemList" && Array.isArray(node.itemListElement)) return node;
  return findItemList(node.mainEntity) ?? findItemList(node["@graph"]);
}

/** «https://schema.org/InStock» → «InStock» */
function availabilityName(value: unknown): string | null {
  return text(value)?.split("/").pop() ?? null;
}

function toProduct(entry: unknown, position: number): PadelNuestroProduct {
  const listItem = isObject(entry) ? entry : {};
  const item = isObject(listItem.item) ? listItem.item : {};
  const offers = isObject(item.offers) ? item.offers : {};
  const brand = isObject(item.brand) ? text(item.brand.name) : text(item.brand);

  const sku = text(item.sku);
  const name = text(item.name) ?? text(listItem.name);
  const url = text(item.url) ?? text(listItem.url) ?? text(offers.url);
  const price = Number(offers.price);
  const currency = text(offers.priceCurrency);
  const availability = availabilityName(offers.availability);

  // Un producto al que le falta un dato obligatorio no se salta: se para la
  // ejecución, porque significa que el formato de la tienda ha cambiado.
  const missing = [
    !sku && "sku",
    !name && "name",
    !url && "url",
    (offers.price === undefined || offers.price === null || offers.price === "" || !Number.isFinite(price)) && "offers.price",
    !currency && "offers.priceCurrency",
    !availability && "offers.availability",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `Padel Nuestro: al producto ${position} («${name ?? sku ?? "sin nombre"}») le falta ${missing.join(", ")}.`,
    );
  }

  return {
    sku: sku as string,
    name: name as string,
    brand,
    price,
    currency: currency as string,
    // Solo «InStock» es disponible; agotado, reserva o cualquier otro estado no se publica.
    available: availability === IN_STOCK,
    url: url as string,
    image: text(item.image),
  };
}

/** Productos del JSON-LD de una página del listado. */
export function parseProducts(html: string): PadelNuestroProduct[] {
  const list = findItemList(jsonLdBlocks(html));
  if (!list) throw new Error("Padel Nuestro: la página no contiene el listado de productos (JSON-LD ItemList).");
  return (list.itemListElement as unknown[]).map((entry, index) => toProduct(entry, index + 1));
}

/** Total de productos que anuncia la barra del listado («916 productos»). */
export function parseAnnouncedTotal(html: string): number {
  const toolbar = /<p[^>]*class="toolbar-amount"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
  // Con varios números («1-36 de 916»), el total es el último.
  const numbers = [...toolbar.matchAll(/<span[^>]*class="toolbar-number"[^>]*>\s*([\d.]+)\s*<\/span>/g)].map(
    (match) => Number(match[1].replaceAll(".", "")),
  );
  const total = numbers.at(-1);
  if (total === undefined || !Number.isInteger(total) || total <= 0) {
    throw new Error("Padel Nuestro: no se ha podido leer el total de productos del listado.");
  }
  return total;
}

/** Convierte los productos al formato común. El EAN es siempre null: la tienda no lo publica. */
export function toListings(products: PadelNuestroProduct[], checkedAt: string): StoreListing[] {
  return products.map((product) => ({
    externalId: product.sku,
    title: product.name,
    brand: product.brand,
    ean: null,
    url: product.url,
    price: product.price,
    // El precio tachado de la tienda no se lee: el precio anterior sale de nuestro histórico.
    listPrice: null,
    available: product.available,
    checkedAt,
    currency: product.currency,
  }));
}

export interface PadelNuestroAdapter extends StoreAdapter {
  lastFetch: FetchReport | null;
}

/**
 * Adaptador de Padel Nuestro. `fetchPage` y `pause` se pueden sustituir en los
 * tests para no hacer peticiones reales.
 *
 * La descarga es secuencial, con pausa entre páginas, y es todo o nada: si el
 * resultado no cuadra con lo que anuncia la tienda, falla y no se escribe nada.
 */
export function createPadelNuestroAdapter(
  fetchPage: FetchHtml = fetchHtml,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): PadelNuestroAdapter {
  const adapter: PadelNuestroAdapter = {
    store: { slug: "padelnuestro", name: "Padel Nuestro", url: BASE_URL, isDemo: false },
    // Sin verificar todavía su coste de envío y su umbral de envío gratis: se
    // publica el precio del producto, sin envío. Cuando se verifiquen, van aquí.
    shipping: null,
    lastFetch: null,

    async fetchProducts() {
      adapter.lastFetch = null;

      const first = await fetchPage(pageUrl(1));
      if (first.status !== 200) {
        throw new Error(`Padel Nuestro respondió ${first.status} en la primera página del listado.`);
      }
      const announced = parseAnnouncedTotal(first.html);
      const expectedPages = Math.ceil(announced / PAGE_SIZE);
      if (expectedPages > MAX_PAGES) {
        throw new Error(`Padel Nuestro anuncia ${announced} productos: demasiados para ser el listado de palas.`);
      }

      const downloaded: PadelNuestroProduct[] = parseProducts(first.html);

      for (let page = 2; page <= expectedPages; page++) {
        await pause(PAUSE_BETWEEN_PAGES_MS);
        const response = await fetchPage(pageUrl(page));
        if (response.status === 404) {
          throw new Error(`Padel Nuestro: falta la página ${page} de ${expectedPages} del listado (404).`);
        }
        if (response.status !== 200) {
          throw new Error(`Padel Nuestro respondió ${response.status} en la página ${page} del listado.`);
        }
        downloaded.push(...parseProducts(response.html));
      }

      // La página siguiente a la última debe ser un 404: confirma que el
      // listado termina donde se esperaba y no ha crecido durante la descarga.
      await pause(PAUSE_BETWEEN_PAGES_MS);
      const beyond = await fetchPage(pageUrl(expectedPages + 1));
      if (beyond.status !== 404) {
        throw new Error(
          `Padel Nuestro: se esperaba el final del listado tras la página ${expectedPages}, ` +
            `pero la ${expectedPages + 1} respondió ${beyond.status}.`,
        );
      }

      if (downloaded.length !== announced) {
        throw new Error(
          `Padel Nuestro anuncia ${announced} productos y se han leído ${downloaded.length}: la descarga no es fiable.`,
        );
      }

      // El orden del listado («más vendidos») puede moverse durante la descarga
      // y repetir un producto en dos páginas. Se identifica por SKU, nunca por nombre.
      const bySku = new Map<string, PadelNuestroProduct>();
      for (const product of downloaded) {
        if (!bySku.has(product.sku)) bySku.set(product.sku, product);
      }

      const duplicates = downloaded.length - bySku.size;
      adapter.lastFetch = {
        announced,
        downloaded: downloaded.length,
        unique: bySku.size,
        duplicates,
        pages: expectedPages,
      };

      // Cada repetido es un producto que no ha llegado a leerse. Unos pocos se
      // toleran (se leerán en la siguiente ejecución); muchos indican que el
      // orden del listado ha dejado de ser estable y la descarga no vale.
      if (duplicates > announced * MAX_DUPLICATE_RATIO) {
        throw new Error(
          `Padel Nuestro: ${duplicates} productos repetidos de ${announced}: faltan demasiados para dar la descarga por buena.`,
        );
      }

      return toListings([...bySku.values()], new Date().toISOString());
    },
  };

  return adapter;
}
