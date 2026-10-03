// Tipos de la ingestión de precios. Ver docs/price-ingestion.md.
import type { ListingStatus, MatchingMethod, MatchingStatus, IngestionStatus } from "@/types/db";

/** Un producto tal y como lo devuelve el adaptador de una tienda, ya en formato común. */
export interface StoreListing {
  /** Identificador estable del producto en la tienda (su SKU o id), no la URL */
  externalId: string;
  title: string;
  brand: string | null;
  /** EAN/UPC tal como lo publique la tienda; se valida y normaliza después */
  ean: string | null;
  url: string;
  /** Precio de venta, sin envío */
  price: number;
  /** Precio de lista o tachado que declara la tienda. Informativo */
  listPrice: number | null;
  available: boolean;
  /** Momento en que la tienda devolvió este precio (ISO con hora) */
  checkedAt: string;
  /** Por defecto EUR. Los precios en otra moneda se descartan */
  currency?: string;
}

/** Regla de envío de una tienda: coste fijo y umbral de envío gratis. */
export interface StoreShipping {
  cost: number;
  /** Importe a partir del cual el envío es gratis; null si nunca lo es */
  freeFrom: number | null;
}

/**
 * Lo único específico de cada tienda. Un adaptador sabe obtener el catálogo de
 * palas de SU tienda y devolverlo como StoreListing[]; no sabe nada de
 * emparejar, normalizar ni guardar.
 */
export interface StoreAdapter {
  /** La tienda, tal como debe figurar en la tabla `stores` (se crea si no existe) */
  store: { slug: string; name: string; url: string };
  shipping: StoreShipping;
  fetchProducts(): Promise<StoreListing[]>;
}

/** Lo que el matcher necesita saber de cada pala del catálogo */
export interface CatalogRacket {
  id: string;
  brand: string;
  model: string;
  year: number;
  /** GTIN conocidos de la pala, normalizados a 14 dígitos */
  gtins: string[];
}

export interface MatchResult {
  status: MatchingStatus;
  racketId: string | null;
  method: MatchingMethod | null;
  /** Motivo, cuando no se empareja automáticamente */
  note: string | null;
}

/** Precio de un listado ya validado y con el envío de la tienda aplicado */
export interface NormalizedOffer {
  price: number;
  listPrice: number | null;
  shipping: number;
  /** Precio final con envío */
  total: number;
  available: boolean;
  checkedAt: string;
}

export interface StoreProduct {
  storeId: string;
  externalId: string;
  racketId: string | null;
  title: string;
  brand: string | null;
  gtin: string | null;
  url: string;
  matchingStatus: MatchingStatus;
  matchingMethod: MatchingMethod | null;
  matchingNote: string | null;
  listingStatus: ListingStatus;
  price: number | null;
  listPrice: number | null;
  pendingPrice: number | null;
  checkedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  missedRuns: number;
}

/** Precio publicado de una pala en una tienda (tabla `store_prices`) */
export interface PublishedPrice {
  racketId: string;
  storeId: string;
  price: number;
  /** Precio anterior según NUESTRO histórico, nunca el precio de lista de la tienda */
  previousPrice: number | null;
  shipping: number;
  availability: string;
  url: string;
  checkedAt: string;
}

export interface RunResult {
  status: Exclude<IngestionStatus, "running">;
  finishedAt: string;
  productsSeen: number;
  productsMatched: number;
  productsPending: number;
  pricesUpdated: number;
  errorMessage: string | null;
}

export interface RunSummary extends RunResult {
  runId: string;
  storeSlug: string;
  /** Listados descartados por datos no válidos (precio, moneda, fecha) */
  productsInvalid: number;
  /** Bajadas anómalas retenidas a la espera de confirmación */
  pricesHeld: number;
}
