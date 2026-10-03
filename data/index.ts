// Punto de entrada de la capa de datos: lo único que importan páginas y
// componentes. Aquí se decide de dónde salen los datos; el resto de la
// aplicación no lo sabe.
import { featuredPalaSlug, guides } from "@/content/guides";
import { DEFAULT_QUERY } from "@/lib/catalog/query";
import type { Guide, Pala, PalaSummary } from "@/types/catalog";
import { getDatabaseUrl } from "./db/client";
import { createMemoryRepository } from "./memory-repository";
import { createPostgresRepository } from "./postgres-repository";
import type { CatalogRepository } from "./repository";

export type { CatalogFacets, CatalogResult, MonthlyDrop } from "./repository";

export type DataSource = "database" | "mock";

/**
 * Origen de datos:
 * - DATA_SOURCE=mock      → semilla en memoria, aunque haya base de datos.
 * - DATA_SOURCE=database  → base de datos; falla si no está configurada.
 * - sin DATA_SOURCE       → base de datos si DATABASE_URL está configurada;
 *                           si no, semilla en memoria (el proyecto siempre arranca).
 */
function resolveDataSource(): DataSource {
  const forced = process.env.DATA_SOURCE;
  if (forced === "mock") return "mock";

  const hasDatabase = getDatabaseUrl() !== null;
  if (forced === "database" && !hasDatabase) {
    throw new Error("DATA_SOURCE=database pero DATABASE_URL no está configurada (ver .env.example).");
  }
  return hasDatabase ? "database" : "mock";
}

export const dataSource: DataSource = resolveDataSource();

let repository: CatalogRepository | undefined;

function getRepository(): CatalogRepository {
  repository ??= dataSource === "database" ? createPostgresRepository() : createMemoryRepository();
  return repository;
}

/**
 * true mientras los precios sean de prueba: siempre con la semilla en memoria,
 * y con base de datos hasta que se declare PRICES_ARE_REAL=true. La interfaz lo
 * usa para avisar y el SEO para no publicar esos precios como ofertas.
 */
export const hasTestPrices = dataSource === "mock" || process.env.PRICES_ARE_REAL !== "true";

export const searchCatalog: CatalogRepository["searchCatalog"] = (query, options) =>
  getRepository().searchCatalog(query, options);
export const countPalas: CatalogRepository["countPalas"] = (filters) =>
  getRepository().countPalas(filters);
export const getCatalogFacets = () => getRepository().getCatalogFacets();
export const getBrands = () => getRepository().getBrands();
export const getBrandBySlug = (slug: string) => getRepository().getBrandBySlug(slug);
export const getPalaBySlug = (slug: string) => getRepository().getPalaBySlug(slug);
export const getAllPalaSlugs = () => getRepository().getAllPalaSlugs();
export const getBiggestMonthlyDrops = (limit: number) =>
  getRepository().getBiggestMonthlyDrops(limit);

/** Palas rebajadas respecto a su precio anterior, de mayor a menor descuento. */
export async function getDeals(limit: number): Promise<PalaSummary[]> {
  const result = await getRepository().searchCatalog(
    { ...DEFAULT_QUERY, collection: "en-oferta", sort: "descuento" },
    { pageSize: limit },
  );
  return result.items;
}

export async function getPopularPalas(limit: number): Promise<PalaSummary[]> {
  const result = await getRepository().searchCatalog(DEFAULT_QUERY, { pageSize: limit });
  return result.items;
}

export async function getPopularSearches(limit: number): Promise<string[]> {
  return (await getPopularPalas(limit)).map((pala) => pala.model);
}

/** Pala destacada en la portada; si la elegida no existe, la primera del catálogo. */
export async function getFeaturedPala(): Promise<Pala | null> {
  const featured = await getRepository().getPalaBySlug(featuredPalaSlug);
  if (featured) return featured;

  const [first] = await getPopularPalas(1);
  return first ? getRepository().getPalaBySlug(first.slug) : null;
}

export async function getGuides(): Promise<Guide[]> {
  return guides;
}
