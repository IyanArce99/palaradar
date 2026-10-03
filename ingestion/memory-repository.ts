import type { PriceHistoryRow } from "@/types/db";
import type { IngestionRepository, IngestionStore } from "./repository";
import type { CatalogRacket, PublishedPrice, RunResult, StoreProduct } from "./types";

interface MemoryRun extends Partial<RunResult> {
  id: string;
  storeId: string;
  startedAt: string;
}

/** Estado completo del repositorio en memoria, expuesto para poder inspeccionarlo. */
export interface MemoryIngestionState {
  stores: IngestionStore[];
  catalog: CatalogRacket[];
  storeProducts: StoreProduct[];
  publishedPrices: PublishedPrice[];
  priceHistory: PriceHistoryRow[];
  runs: MemoryRun[];
  statsRefreshes: number;
}

export interface MemoryIngestionRepository extends IngestionRepository {
  state: MemoryIngestionState;
}

/** Repositorio de ingestión en memoria: para tests y para probar adaptadores sin base de datos. */
export function createMemoryIngestionRepository(
  stores: IngestionStore[],
  catalog: CatalogRacket[],
  /** Productos de tienda ya conocidos, para simular una ejecución sobre datos existentes */
  storeProducts: StoreProduct[] = [],
): MemoryIngestionRepository {
  const state: MemoryIngestionState = {
    stores,
    catalog,
    storeProducts: [...storeProducts],
    publishedPrices: [],
    priceHistory: [],
    runs: [],
    statsRefreshes: 0,
  };

  const samePrice = (price: PublishedPrice, racketId: string, storeId: string) =>
    price.racketId === racketId && price.storeId === storeId;

  const repository: MemoryIngestionRepository = {
    state,

    async getStore(slug) {
      return state.stores.find((store) => store.slug === slug) ?? null;
    },

    async ensureStore({ slug, name }) {
      const existing = state.stores.find((store) => store.slug === slug);
      if (existing) return existing;

      const created = { id: `store-${slug}`, slug, name };
      state.stores.push(created);
      return created;
    },

    async transaction(work) {
      // Copia de lo que una transacción real desharía si algo falla.
      const snapshot = structuredClone({
        storeProducts: state.storeProducts,
        publishedPrices: state.publishedPrices,
        priceHistory: state.priceHistory,
        statsRefreshes: state.statsRefreshes,
      });
      try {
        return await work(repository);
      } catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    },

    async loadCatalog() {
      return state.catalog;
    },

    async startRun(storeId, startedAt) {
      const id = `run-${state.runs.length + 1}`;
      state.runs.push({ id, storeId, startedAt });
      return id;
    },

    async finishRun(runId, result) {
      const run = state.runs.find((item) => item.id === runId);
      if (run) Object.assign(run, result);
    },

    async listStoreProducts(storeId) {
      return state.storeProducts.filter((product) => product.storeId === storeId);
    },

    async saveStoreProducts(products) {
      for (const product of products) {
        const index = state.storeProducts.findIndex(
          (item) => item.storeId === product.storeId && item.externalId === product.externalId,
        );
        if (index >= 0) state.storeProducts[index] = product;
        else state.storeProducts.push(product);
      }
    },

    async listPublishedPrices(storeId) {
      return state.publishedPrices.filter((price) => price.storeId === storeId);
    },

    async publishPrices(prices) {
      for (const price of prices) {
        state.publishedPrices = [
          ...state.publishedPrices.filter((item) => !samePrice(item, price.racketId, price.storeId)),
          price,
        ];
      }
    },

    async unpublishPrices(storeId, racketIds) {
      state.publishedPrices = state.publishedPrices.filter(
        (price) => !(price.storeId === storeId && racketIds.includes(price.racketId)),
      );
    },

    async recordHistory(entries) {
      for (const { racketId, storeId, priceDate, total } of entries) {
        state.priceHistory = [
          ...state.priceHistory.filter(
            (row) =>
              !(row.racket_id === racketId && row.store_id === storeId && row.price_date === priceDate),
          ),
          { racket_id: racketId, store_id: storeId, price_date: priceDate, price: total },
        ];
      }
    },

    async refreshStats() {
      state.statsRefreshes++;
    },
  };

  return repository;
}
