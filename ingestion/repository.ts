import type { CatalogRacket, PublishedPrice, RunResult, StoreAdapter, StoreProduct } from "./types";

export type Locked<T> = { acquired: true; value: T } | { acquired: false };

export const INTERRUPTED_RUN_MESSAGE = "Ejecución interrumpida: el proceso terminó sin registrar el resultado.";

export interface IngestionStore {
  id: string;
  slug: string;
  name: string;
}

/** Un registro del histórico: precio final (con envío) de una pala en una tienda un día. */
export interface HistoryEntry {
  racketId: string;
  storeId: string;
  /** Día al que corresponde el precio (AAAA-MM-DD) */
  priceDate: string;
  total: number;
}

/**
 * Persistencia de la ingestión. La implementación en memoria sirve para los
 * tests y la de PostgreSQL para producción; `runIngestion` no distingue.
 */
export interface IngestionRepository {
  getStore(slug: string): Promise<IngestionStore | null>;
  /** Devuelve la tienda, creándola si todavía no existe */
  ensureStore(store: StoreAdapter["store"]): Promise<IngestionStore>;
  /**
   * Ejecuta `work` de forma atómica sobre un repositorio transaccional: si
   * falla, no queda escrito nada de lo que hizo.
   */
  transaction<T>(work: (repository: IngestionRepository) => Promise<T>): Promise<T>;
  /**
   * Ejecuta `work` con el bloqueo global de ingestión tomado. Si otra ingestión
   * lo tiene, no espera ni ejecuta nada y devuelve `{ acquired: false }`. El
   * bloqueo se suelta siempre al terminar `work`, también si falla.
   */
  withIngestionLock<T>(work: () => Promise<T>): Promise<Locked<T>>;
  /**
   * Da por fallidas las ejecuciones que quedaron «en marcha» porque su proceso
   * murió. Solo se llama con el bloqueo tomado, así que ninguna está viva.
   */
  failInterruptedRuns(finishedAt: string): Promise<number>;
  /** Palas del catálogo con sus GTIN conocidos, para el matcher */
  loadCatalog(): Promise<CatalogRacket[]>;

  startRun(storeId: string, startedAt: string): Promise<string>;
  finishRun(runId: string, result: RunResult): Promise<void>;

  // Las lecturas y escrituras de una ejecución van por lotes: una consulta por
  // tabla (o por bloque de filas), no una por producto. Con cientos de productos
  // y la base de datos en red, la diferencia es de minutos a segundos.

  listStoreProducts(storeId: string): Promise<StoreProduct[]>;
  /**
   * Crea los productos de tienda o los actualiza (clave: tienda + identificador
   * externo). Cada producto aparece una sola vez en la lista.
   */
  saveStoreProducts(products: StoreProduct[]): Promise<void>;

  /** Todos los precios publicados de la tienda en `store_prices` */
  listPublishedPrices(storeId: string): Promise<PublishedPrice[]>;
  /** Crea o actualiza las filas de `store_prices` (clave: pala + tienda) */
  publishPrices(prices: PublishedPrice[]): Promise<void>;
  /** Retira de `store_prices` los precios de esas palas en la tienda. No toca el histórico */
  unpublishPrices(storeId: string, racketIds: string[]): Promise<void>;

  /** Una fila por pala, tienda y día: el último precio final observado ese día */
  recordHistory(entries: HistoryEntry[]): Promise<void>;

  /** Recalcula `racket_price_stats` para que el catálogo refleje los precios nuevos */
  refreshStats(now: Date): Promise<void>;
}
