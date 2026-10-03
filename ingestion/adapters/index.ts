import type { StoreAdapter } from "../types";
import { createPadelNuestroAdapter } from "./padelnuestro";
import { createPadelProShopAdapter } from "./padelproshop";

/**
 * Adaptadores de tiendas reales, por slug. Una tienda nueva se añade aquí con
 * `isDemo: false` en su adaptador; el adaptador de prueba (mock.ts) no se
 * registra, así que `prices:ingest` nunca puede escribir datos ficticios.
 */
const ADAPTERS: Record<string, () => StoreAdapter> = {
  padelproshop: () => createPadelProShopAdapter(),
  padelnuestro: () => createPadelNuestroAdapter(),
};

export const availableStores = Object.keys(ADAPTERS);

export function getAdapter(storeSlug: string): StoreAdapter {
  const create = ADAPTERS[storeSlug];
  if (!create) {
    throw new Error(
      `No hay adaptador para «${storeSlug}». Disponibles: ${availableStores.join(", ")}.`,
    );
  }
  return create();
}
