import type { CatalogQuery } from "@/lib/catalog/query";
import type { IndexablePala } from "@/lib/indexability";
import type { Recommendation, RecommenderPrefs } from "@/lib/recommender";
import type { SimilarityTarget, SimilarPala } from "@/lib/similar";
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

export interface RatedPala {
  pala: PalaSummary;
  /** Puntuación técnica total de la fuente externa, de 0 a 10; null si el origen de datos no tiene puntuaciones */
  score: number | null;
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
   * Proyección de tarjeta de varias palas a la vez, en una sola consulta: para
   * bloques que enseñan muchas (comparaciones destacadas). Las que no existen o
   * no están disponibles no se devuelven.
   */
  getPalaSummaries(slugs: string[]): Promise<PalaSummary[]>;
  /**
   * Histórico de precios de una pala en sus dos lecturas: el mejor precio del
   * mercado por día y el precio de cada tienda por día. Solo tiendas activas
   * como fuente de precios. null si la pala no existe.
   */
  getPriceHistory(slug: string): Promise<PriceHistory | null>;
  getAllPalaSlugs(): Promise<string[]>;
  /**
   * Fichas aptas para indexarse (lib/indexability.ts), con su marca: de ellas
   * sale lo que entra en el sitemap. Mismo criterio que aplica la ficha a sus
   * metadatos.
   */
  getIndexablePalas(): Promise<IndexablePala[]>;
  /** Palas con algún precio publicado: las que merece la pena generar por adelantado */
  getPricedPalaSlugs(): Promise<string[]>;
  /** Mayores bajadas de precio de los últimos 30 días */
  getBiggestMonthlyDrops(limit: number): Promise<MonthlyDrop[]>;
  /**
   * Palas con precio actual que mejor encajan con las respuestas del recomendador.
   * Presupuesto, forma elegida y tacto blando exigido son filtros; el orden lo da
   * cuántas de las demás respuestas cumple cada pala y, a igualdad, el orden por
   * defecto del catálogo (más tiendas con precio y más recientes).
   */
  recommendPalas(prefs: RecommenderPrefs, limit: number): Promise<Recommendation[]>;
  /**
   * Palas a la venta que cumplen unos filtros del catálogo, ordenadas por la
   * puntuación técnica total de la fuente externa (PadelZoom), de mayor a menor.
   * Solo entran las que tienen precio vigente, foto real y puntuación: de aquí
   * salen las selecciones de las guías. A igualdad, las que están en más tiendas.
   */
  getTopRatedPalas(filters: Partial<CatalogQuery>, limit: number): Promise<RatedPala[]>;
  /**
   * Palas parecidas a una dada, entre las que tienen precio actual: misma forma
   * y, por orden, las que más coinciden en balance, estilo y nivel; a igualdad,
   * las que tienen foto y un precio más cercano (lib/similar.ts).
   */
  getSimilarPalas(target: SimilarityTarget, limit: number): Promise<SimilarPala[]>;
  /**
   * Pares de palas «parecidas» (slugs), ambas disponibles: las comparaciones
   * curadas, que son las únicas indexables. Puede repetir un par en los dos sentidos.
   */
  getAlternativePairs(): Promise<[string, string][]>;
}
