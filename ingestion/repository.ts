import type { CatalogRacket, PublishedPrice, RunResult, StoreProduct } from "./types";

export interface IngestionStore {
  id: string;
  slug: string;
  name: string;
}

/**
 * Persistencia de la ingestión. La implementación en memoria sirve para los
 * tests y la de PostgreSQL para producción; `runIngestion` no distingue.
 */
export interface IngestionRepository {
  getStore(slug: string): Promise<IngestionStore | null>;
  /** Devuelve la tienda, creándola si todavía no existe */
  ensureStore(store: { slug: string; name: string; url: string }): Promise<IngestionStore>;
  /**
   * Ejecuta `work` de forma atómica sobre un repositorio transaccional: si
   * falla, no queda escrito nada de lo que hizo.
   */
  transaction<T>(work: (repository: IngestionRepository) => Promise<T>): Promise<T>;
  /** Palas del catálogo con sus GTIN conocidos, para el matcher */
  loadCatalog(): Promise<CatalogRacket[]>;

  startRun(storeId: string, startedAt: string): Promise<string>;
  finishRun(runId: string, result: RunResult): Promise<void>;

  listStoreProducts(storeId: string): Promise<StoreProduct[]>;
  /** Crea el producto de tienda o lo actualiza (clave: tienda + identificador externo) */
  saveStoreProduct(product: StoreProduct): Promise<void>;

  getPublishedPrice(racketId: string, storeId: string): Promise<PublishedPrice | null>;
  /** Crea o actualiza la fila de `store_prices` de esa pala en esa tienda */
  publishPrice(price: PublishedPrice): Promise<void>;
  unpublishPrice(racketId: string, storeId: string): Promise<void>;

  /** Una fila por pala, tienda y día: el último precio final observado ese día */
  recordHistory(racketId: string, storeId: string, priceDate: string, total: number): Promise<void>;

  /** Recalcula `racket_price_stats` para que el catálogo refleje los precios nuevos */
  refreshStats(now: Date): Promise<void>;
}
