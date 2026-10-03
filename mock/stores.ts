import type { Store, StoreOffer } from "@/types/catalog";

export const stores = {
  padelNuestro: { id: "store-padelnuestro", name: "PadelNuestro" },
  padelProShop: { id: "store-padelproshop", name: "PadelProShop" },
  padelTienda: { id: "store-padeltienda", name: "Padel.tienda" },
  zonaDePadel: { id: "store-zonadepadel", name: "Zona de Padel" },
  amazon: { id: "store-amazon", name: "Amazon" },
  elCorteIngles: { id: "store-elcorteingles", name: "El Corte Inglés" },
} satisfies Record<string, Store>;

/** Oferta de ejemplo: sin enlace real a la tienda. */
export function mockOffer(
  store: Store,
  price: number,
  shipping: number,
  availability: string,
): StoreOffer {
  return { store, price, shipping, availability, url: null };
}
