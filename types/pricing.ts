import type { PricePoint, Store, StoreOffer } from "./catalog";

/** Valoración del precio actual frente a su histórico */
export type PriceStatus = "good" | "fair" | "wait";

/**
 * Antigüedad de la última comprobación del precio:
 * - current: comprobado dentro de las últimas PRICE_CURRENT_HOURS → «precio de hoy»
 * - recent: más antiguo, pero aún dentro de PRICE_STALE_AFTER_HOURS → «último precio conocido»
 * - stale: desactualizado → «precio sin confirmar», sin veredicto
 */
export type PriceFreshness = "current" | "recent" | "stale";

export interface RankedOffer extends StoreOffer {
  /** Precio final con envío */
  total: number;
}

/**
 * Agregados de precio de una pala (tabla `racket_price_stats`). Se recalculan
 * cada vez que se actualizan precios, para que el catálogo pueda filtrar y
 * ordenar por ellos sin recorrer el histórico.
 */
export interface PriceStats {
  bestPrice: number;
  bestStoreId: string;
  storeCount: number;
  previousPrice: number | null;
  dropPercent: number | null;
  average90: number | null;
  minPrice: number | null;
  minPriceDate: string | null;
  price30dAgo: number | null;
  status: PriceStatus;
  /** Última comprobación del mejor precio (ISO con hora) */
  priceCheckedAt: string;
  computedAt: string;
}

export interface PriceVerdict {
  /** `stale`: el precio lleva demasiado sin comprobarse y no se valora */
  status: PriceStatus | "stale";
  label: string;
  /** Una frase que justifica el veredicto */
  detail: string;
  /** Respuesta a «¿Está barata ahora?» */
  answer: string;
}

/** Un día del histórico global: el mejor precio entre las tiendas con registro ese día */
export interface MarketPricePoint extends PricePoint {
  /** La tienda que tenía ese mejor precio */
  store: Store;
  /** Cuántas tiendas tienen registro ese día: el mínimo solo es comparable entre días con las mismas */
  storeCount: number;
}

/** El histórico de una tienda: su precio final (con envío) cada día que se comprobó */
export interface StorePriceSeries {
  store: Store;
  points: PricePoint[];
}

/**
 * Las dos lecturas del histórico de una pala, sobre los mismos registros:
 * - market: «mejor precio del mercado por día»
 * - byStore: «precio de esta tienda por día»
 * Solo contienen días con un precio realmente observado; no se rellenan huecos.
 */
export interface PriceHistory {
  market: MarketPricePoint[];
  byStore: StorePriceSeries[];
}

/** Todo lo que la ficha necesita saber del precio de una pala */
export interface PriceSummary {
  current: number;
  bestOffer: RankedOffer;
  /** De más barata a más cara, por precio final */
  offers: RankedOffer[];
  storeCount: number;
  previous: number | null;
  dropPercent: number | null;
  average90: number | null;
  historicalMin: PricePoint | null;
  /** Momento en que se comprobó el mejor precio (ISO con hora) */
  checkedAt: string;
  /** Fecha actual respecto a la que se ha calculado todo (ISO con hora) */
  asOf: string;
  freshness: PriceFreshness;
  verdict: PriceVerdict;
}
