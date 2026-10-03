import type { CatalogQuery } from "@/lib/catalog/query";
import type { Brand, Pala, PalaSummary } from "@/types/catalog";
import type { PriceHistory } from "@/types/pricing";

export interface CatalogSearchOptions {
  /** Resultados por página; por defecto, CATALOG_PAGE_SIZE */
  pageSize?: number;
}

export interface CatalogResult {
  /** Solo las palas de la página pedida */
  items: PalaSummary[];
  /** Total de palas que cumplen la consulta, en todas las páginas */
  total: number;
  page: number;
  pageCount: number;
}

export interface CatalogFacets {
  /** Marcas con al menos una pala */
  brands: Brand[];
  years: number[];
  /** Tope del filtro de precio, redondeado hacia arriba */
  priceCeiling: number;
}

export interface MonthlyDrop {
  pala: PalaSummary;
  from: number;
  to: number;
  percent: number;
}

/**
 * Contrato de acceso al catálogo. Las páginas solo dependen de esta interfaz:
 * hoy la cumple un repositorio en memoria sobre la semilla y mañana uno sobre
 * PostgreSQL/Supabase, sin tocar páginas ni componentes.
 *
 * Filtros, búsqueda, orden y paginación se resuelven DENTRO de `searchCatalog`
 * (en producción, en SQL sobre la vista `racket_catalog`): nunca se devuelve el
 * catálogo entero para filtrarlo después.
 */
export interface CatalogRepository {
  searchCatalog(query: CatalogQuery, options?: CatalogSearchOptions): Promise<CatalogResult>;
  countPalas(filters?: Partial<CatalogQuery>): Promise<number>;
  getCatalogFacets(): Promise<CatalogFacets>;
  getBrands(): Promise<Brand[]>;
  getBrandBySlug(slug: string): Promise<Brand | null>;
  getPalaBySlug(slug: string): Promise<Pala | null>;
  /**
   * Histórico de precios de una pala en sus dos lecturas: el mejor precio del
   * mercado por día y el precio de cada tienda por día. Solo tiendas activas
   * como fuente de precios. null si la pala no existe.
   */
  getPriceHistory(slug: string): Promise<PriceHistory | null>;
  getAllPalaSlugs(): Promise<string[]>;
  /** Mayores bajadas de precio de los últimos 30 días */
  getBiggestMonthlyDrops(limit: number): Promise<MonthlyDrop[]>;
}
