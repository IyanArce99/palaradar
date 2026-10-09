// Punto de entrada de la capa de datos: lo único que importan páginas y
// componentes. Aquí se decide de dónde salen los datos; el resto de la
// aplicación no lo sabe.
import { resolveAlertsAvailable } from "@/alerts/availability";
import { pricingConfig } from "@/config/pricing";
import { featuredPalaSlug, guides } from "@/content/guides";
import { DEFAULT_QUERY } from "@/lib/catalog/query";
import type { RecentActivity } from "@/lib/compare-insights";
import type { Guide, Pala, PalaSummary } from "@/types/catalog";
import { getDatabaseUrl } from "./db/client";
import { createMemoryRepository } from "./memory-repository";
import { createPostgresRepository } from "./postgres-repository";
import type { CatalogRepository } from "./repository";

export type { CatalogFacets, CatalogResult, MonthlyDrop, RatedPala } from "./repository";

export type DataSource = "database" | "mock";

/**
 * Origen de datos:
 * - DATA_SOURCE=mock      → semilla en memoria, aunque haya base de datos.
 * - DATA_SOURCE=database  → base de datos; falla si no está configurada.
 * - sin DATA_SOURCE       → base de datos si DATABASE_URL está configurada. Si no,
 *                           semilla en memoria en desarrollo y error en producción.
 */
export function resolveDataSource(
  env: Record<string, string | undefined>,
  hasDatabase: boolean,
): DataSource {
  const forced = env.DATA_SOURCE;
  if (forced === "mock") return "mock";
  if (hasDatabase) return "database";

  if (forced === "database") {
    throw new Error("DATA_SOURCE=database pero DATABASE_URL no está configurada (ver .env.example).");
  }
  // En producción no se cae en silencio a los datos de demostración.
  if (env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL no está configurada. En producción no se usan los datos de demostración salvo que se pida con DATA_SOURCE=mock.",
    );
  }
  return "mock";
}

export const dataSource: DataSource = resolveDataSource(process.env, getDatabaseUrl() !== null);

let repository: CatalogRepository | undefined;

function getRepository(): CatalogRepository {
  repository ??= dataSource === "database" ? createPostgresRepository() : createMemoryRepository();
  return repository;
}

/**
 * true si entre los precios que se muestran puede haber alguno de demostración:
 * siempre con la semilla en memoria, y con base de datos solo si se han incluido
 * las tiendas demo (desarrollo). La interfaz lo usa para avisar y el SEO para no
 * publicar esos precios como ofertas.
 */
export const hasTestPrices = dataSource === "mock" || pricingConfig.includeDemoStores;

/**
 * true si las alertas de precio funcionan de principio a fin y, por tanto, se
 * pueden ofrecer: ver alerts/availability.ts. Se evalúa en cada petición del
 * servidor, así que activarlas solo requiere configurar el envío de correo.
 */
export const alertsAvailable = () => resolveAlertsAvailable(dataSource);

export const searchCatalog: CatalogRepository["searchCatalog"] = (query, options) =>
  getRepository().searchCatalog(query, options);
export const countPalas: CatalogRepository["countPalas"] = (filters) =>
  getRepository().countPalas(filters);
export const getCatalogFacets = () => getRepository().getCatalogFacets();
export const getBrands = () => getRepository().getBrands();
export const getBrandBySlug = (slug: string) => getRepository().getBrandBySlug(slug);
export const getPalaBySlug = (slug: string) => getRepository().getPalaBySlug(slug);
/** Proyección de tarjeta de varias palas, en una sola consulta. */
export const getPalaSummaries = (slugs: string[]) => getRepository().getPalaSummaries(slugs);
/** Histórico global («mejor precio del mercado por día») y por tienda de una pala. */
export const getPriceHistory = (slug: string) => getRepository().getPriceHistory(slug);
export const getAllPalaSlugs = () => getRepository().getAllPalaSlugs();
/** Fichas aptas para indexarse, con su marca: de ellas sale el sitemap (lib/indexability.ts). */
export const getIndexablePalas = () => getRepository().getIndexablePalas();
export const getPricedPalaSlugs = () => getRepository().getPricedPalaSlugs();
export const getBiggestMonthlyDrops = (limit: number) =>
  getRepository().getBiggestMonthlyDrops(limit);
export const getAlternativePairs = () => getRepository().getAlternativePairs();
export const recommendPalas: CatalogRepository["recommendPalas"] = (prefs, limit) =>
  getRepository().recommendPalas(prefs, limit);
/** Palas a la venta mejor puntuadas por la fuente externa, con unos filtros: las selecciones de las guías. */
export const getTopRatedPalas: CatalogRepository["getTopRatedPalas"] = (filters, limit) =>
  getRepository().getTopRatedPalas(filters, limit);
/** Palas parecidas a una dada, entre las que están a la venta (lib/similar.ts). */
export const getSimilarPalas: CatalogRepository["getSimilarPalas"] = (target, limit) =>
  getRepository().getSimilarPalas(target, limit);

/** Palas rebajadas respecto a su precio anterior, de mayor a menor descuento. */
export async function getDeals(limit: number): Promise<PalaSummary[]> {
  const result = await getRepository().searchCatalog(
    { ...DEFAULT_QUERY, collection: "en-oferta", sort: "descuento" },
    { pageSize: limit },
  );
  return result.items;
}

/** Las primeras del orden por defecto: las que más tiendas tienen a la venta ahora. */
export async function getTopPalas(limit: number): Promise<PalaSummary[]> {
  const result = await getRepository().searchCatalog(DEFAULT_QUERY, { pageSize: limit });
  return result.items;
}

/** Modelos del catálogo que proponer cuando una búsqueda no da resultados. No son búsquedas de nadie. */
export async function getSearchSuggestions(limit: number): Promise<string[]> {
  return (await getTopPalas(limit)).map((pala) => pala.model);
}

/**
 * Pala destacada en la portada. Si la elegida no existe o ahora no tiene precio,
 * la primera del orden por defecto (que sí lo tiene mientras haya alguna a la venta).
 */
export async function getFeaturedPala(): Promise<Pala | null> {
  const featured = await getRepository().getPalaBySlug(featuredPalaSlug);
  if (featured?.price) return featured;

  const [first] = await getTopPalas(1);
  return first ? getRepository().getPalaBySlug(first.slug) : null;
}

/**
 * Actividad reciente del comparador. Hoy no se registra qué comparaciones se
 * abren, así que no hay nada que enseñar: devuelve la actividad vacía y el
 * bloque «Comparaciones recientes» no aparece. Cuando exista ese registro, este
 * es el único sitio que hay que cambiar; nunca se rellena con datos de ejemplo.
 */
export async function getRecentComparisons(): Promise<RecentActivity> {
  return { weekCount: 0, items: [] };
}

export async function getGuides(): Promise<Guide[]> {
  return guides;
}
