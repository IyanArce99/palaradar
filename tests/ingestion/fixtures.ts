import {
  GTIN_METALBONE_34_2025,
  GTIN_VERTEX_04_2025,
  MOCK_STORE_SLUG,
} from "@/ingestion/adapters/mock";
import { normalizeGtin } from "@/ingestion/gtin";
import { createMemoryIngestionRepository } from "@/ingestion/memory-repository";
import type { CatalogRacket, StoreListing } from "@/ingestion/types";

const gtin = (value: string) => normalizeGtin(value) as string;

/** Catálogo de prueba: palas reales, dos de ellas con GTIN conocido. */
export const catalog: CatalogRacket[] = [
  { id: "metalbone-34-2025", brand: "Adidas", model: "Metalbone 3.4", year: 2025, gtins: [gtin(GTIN_METALBONE_34_2025)] },
  { id: "metalbone-team-light-2026", brand: "Adidas", model: "Metalbone Team Light", year: 2026, gtins: [] },
  { id: "vertex-04-2025", brand: "Bullpadel", model: "Vertex 04", year: 2025, gtins: [gtin(GTIN_VERTEX_04_2025)] },
  { id: "neuron-2025", brand: "Bullpadel", model: "Neuron", year: 2025, gtins: [] },
  { id: "equation-hard-advanced-2027", brand: "Nox", model: "Equation Hard Advanced", year: 2027, gtins: [] },
  { id: "kyra-2027", brand: "StarVie", model: "Kyra", year: 2027, gtins: [] },
  { id: "drax-plus-2027", brand: "StarVie", model: "Drax +", year: 2027, gtins: [] },
  { id: "fenix-pro-2026", brand: "Siux", model: "Fenix Pro", year: 2026, gtins: [] },
];

export const STORE = { id: "store-1", slug: MOCK_STORE_SLUG, name: "Tienda de prueba" };

export function createRepository() {
  return createMemoryIngestionRepository([STORE], catalog);
}

export const DAY_1 = new Date("2026-10-05T06:00:00Z");
export const DAY_2 = new Date("2026-10-06T06:00:00Z");
export const DAY_3 = new Date("2026-10-07T06:00:00Z");

/** Un listado de tienda con valores por defecto razonables. */
export function listing(
  fields: Partial<StoreListing> & Pick<StoreListing, "title" | "price">,
  at: Date = DAY_1,
): StoreListing {
  return {
    externalId: "SKU-1",
    brand: null,
    ean: null,
    url: "https://example.com/producto",
    listPrice: null,
    available: true,
    checkedAt: at.toISOString(),
    ...fields,
  };
}
