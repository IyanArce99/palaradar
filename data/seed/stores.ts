import type { StoreRow } from "@/types/db";

// Tiendas de ejemplo. Las URL son de marcador: no hay acuerdos ni enlaces reales.
export const stores: StoreRow[] = [
  { id: "st_padelnuestro", slug: "padelnuestro", name: "PadelNuestro", url: "https://example.com/padelnuestro" },
  { id: "st_padelproshop", slug: "padelproshop", name: "PadelProShop", url: "https://example.com/padelproshop" },
  { id: "st_padeltienda", slug: "padel-tienda", name: "Padel.tienda", url: "https://example.com/padel-tienda" },
  { id: "st_zonadepadel", slug: "zona-de-padel", name: "Zona de Padel", url: "https://example.com/zona-de-padel" },
  { id: "st_amazon", slug: "amazon", name: "Amazon", url: "https://example.com/amazon" },
  { id: "st_elcorteingles", slug: "el-corte-ingles", name: "El Corte Inglés", url: "https://example.com/el-corte-ingles" },
];
