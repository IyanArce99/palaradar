// Punto de entrada de la capa de datos: lo único que importan páginas y componentes.
import { featuredPalaSlug, guides } from "@/content/guides";
import { DEFAULT_QUERY } from "@/lib/catalog/query";
import type { Guide, Pala, PalaSummary } from "@/types/catalog";
import { memoryRepository } from "./memory-repository";
import type { CatalogRepository } from "./repository";

export type { CatalogFacets, CatalogResult, MonthlyDrop } from "./repository";

// Para pasar a PostgreSQL/Supabase: implementar CatalogRepository y asignarlo aquí.
const repository: CatalogRepository = memoryRepository;

/**
 * true mientras el catálogo se sirva desde la semilla de ejemplo. La interfaz lo
 * usa para avisar de que opiniones, precios y tiendas son ficticios, y el SEO
 * para no publicar valoraciones ni ofertas inventadas como datos estructurados.
 */
export const isDemoData = repository === memoryRepository;

export const searchCatalog: CatalogRepository["searchCatalog"] = (query, options) =>
  repository.searchCatalog(query, options);
export const countPalas: CatalogRepository["countPalas"] = (filters) =>
  repository.countPalas(filters);
export const getCatalogFacets = () => repository.getCatalogFacets();
export const getBrands = () => repository.getBrands();
export const getBrandBySlug = (slug: string) => repository.getBrandBySlug(slug);
export const getPalaBySlug = (slug: string) => repository.getPalaBySlug(slug);
export const getAllPalaSlugs = () => repository.getAllPalaSlugs();
export const getBiggestMonthlyDrops = (limit: number) => repository.getBiggestMonthlyDrops(limit);

/** Palas rebajadas respecto a su precio anterior, de mayor a menor descuento. */
export async function getDeals(limit: number): Promise<PalaSummary[]> {
  const result = await repository.searchCatalog(
    { ...DEFAULT_QUERY, collection: "en-oferta", sort: "descuento" },
    { pageSize: limit },
  );
  return result.items;
}

export async function getPopularPalas(limit: number): Promise<PalaSummary[]> {
  const result = await repository.searchCatalog(DEFAULT_QUERY, { pageSize: limit });
  return result.items;
}

export async function getPopularSearches(limit: number): Promise<string[]> {
  return (await getPopularPalas(limit)).map((pala) => pala.model);
}

export function getFeaturedPala(): Promise<Pala | null> {
  return repository.getPalaBySlug(featuredPalaSlug);
}

export async function getGuides(): Promise<Guide[]> {
  return guides;
}
