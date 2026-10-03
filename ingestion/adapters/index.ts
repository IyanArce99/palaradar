import type { StoreAdapter } from "../types";
import { createPadelProShopAdapter } from "./padelproshop";

/** Adaptadores de tiendas reales, por slug. */
const ADAPTERS: Record<string, () => StoreAdapter> = {
  padelproshop: () => createPadelProShopAdapter(),
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
