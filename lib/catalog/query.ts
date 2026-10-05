import { formatEuroCompact } from "@/lib/format";
import { BALANCE_LABELS, LEVEL_LABELS, SHAPE_LABELS, STYLE_LABELS } from "@/lib/labels";
import { routes } from "@/lib/routes";
import type { PalaBalance, PalaShape, PlayerLevel, PlayStyle } from "@/types/catalog";

// No hay datos de popularidad (visitas, ventas u opiniones): el orden por defecto
// es por disponibilidad, que sí se puede comprobar.
export const SORT_OPTIONS = [
  { id: "disponibilidad", label: "En más tiendas" },
  { id: "precio", label: "Precio" },
  { id: "descuento", label: "Descuento" },
  { id: "minimo", label: "Cerca de su mínimo (30 días)" },
  { id: "novedades", label: "Novedades" },
] as const;

export const COLLECTIONS = [
  { id: "todas", label: "Todas" },
  { id: "en-oferta", label: "Palas en oferta" },
  { id: "mejor-precio", label: "Mejor precio hoy" },
  { id: "grandes-descuentos", label: "Grandes descuentos" },
] as const;

/** Palas por página en catálogo y páginas de marca */
export const CATALOG_PAGE_SIZE = 24;

export type SortId = (typeof SORT_OPTIONS)[number]["id"];
export type CollectionId = (typeof COLLECTIONS)[number]["id"];

export interface CatalogQuery {
  q: string;
  collection: CollectionId;
  levels: PlayerLevel[];
  styles: PlayStyle[];
  /** Slugs de marca */
  brands: string[];
  shapes: PalaShape[];
  balances: PalaBalance[];
  years: number[];
  maxPrice: number | null;
  sort: SortId;
  page: number;
}

export const DEFAULT_QUERY: CatalogQuery = {
  q: "",
  collection: "todas",
  levels: [],
  styles: [],
  brands: [],
  shapes: [],
  balances: [],
  years: [],
  maxPrice: null,
  sort: "disponibilidad",
  page: 1,
};

/** Nombres de los parámetros en la URL */
export const PARAMS = {
  q: "q",
  collection: "coleccion",
  level: "nivel",
  style: "estilo",
  brand: "marca",
  shape: "forma",
  balance: "balance",
  year: "anio",
  maxPrice: "precio",
  sort: "orden",
  page: "pagina",
} as const;

export type RawSearchParams = Record<string, string | string[] | undefined>;

function toList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function pickKnown<T extends string>(values: string[], known: Record<T, string>): T[] {
  return values.filter((value): value is T => Object.hasOwn(known, value));
}

export function parseCatalogQuery(params: RawSearchParams): CatalogQuery {
  const first = (key: string) => toList(params[key])[0] ?? "";
  const maxPrice = Number(first(PARAMS.maxPrice));
  const page = Number(first(PARAMS.page));

  return {
    q: first(PARAMS.q).trim().slice(0, 80),
    collection:
      COLLECTIONS.find((c) => c.id === first(PARAMS.collection))?.id ?? DEFAULT_QUERY.collection,
    levels: pickKnown(toList(params[PARAMS.level]), LEVEL_LABELS),
    styles: pickKnown(toList(params[PARAMS.style]), STYLE_LABELS),
    brands: toList(params[PARAMS.brand]).slice(0, 30),
    shapes: pickKnown(toList(params[PARAMS.shape]), SHAPE_LABELS),
    balances: pickKnown(toList(params[PARAMS.balance]), BALANCE_LABELS),
    years: toList(params[PARAMS.year]).map(Number).filter(Number.isInteger),
    maxPrice: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : null,
    sort: SORT_OPTIONS.find((s) => s.id === first(PARAMS.sort))?.id ?? DEFAULT_QUERY.sort,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function catalogHref(query: Partial<CatalogQuery> = {}): string {
  const q = { ...DEFAULT_QUERY, ...query };
  const params = new URLSearchParams();

  if (q.q) params.set(PARAMS.q, q.q);
  if (q.collection !== DEFAULT_QUERY.collection) params.set(PARAMS.collection, q.collection);
  for (const level of q.levels) params.append(PARAMS.level, level);
  for (const style of q.styles) params.append(PARAMS.style, style);
  for (const brand of q.brands) params.append(PARAMS.brand, brand);
  for (const shape of q.shapes) params.append(PARAMS.shape, shape);
  for (const balance of q.balances) params.append(PARAMS.balance, balance);
  for (const year of q.years) params.append(PARAMS.year, String(year));
  if (q.maxPrice !== null) params.set(PARAMS.maxPrice, String(q.maxPrice));
  if (q.sort !== DEFAULT_QUERY.sort) params.set(PARAMS.sort, q.sort);
  if (q.page > 1) params.set(PARAMS.page, String(q.page));

  const qs = params.toString();
  return qs ? `${routes.catalog}?${qs}` : routes.catalog;
}

/** URL de la página `page` de un listado: la primera no lleva parámetro. */
export function pageHref(basePath: string, page: number): string {
  return page > 1 ? `${basePath}?${PARAMS.page}=${page}` : basePath;
}

/** true si la consulta filtra, busca u ordena: cualquier cosa que no sea paginar. */
export function hasCatalogFilters(query: CatalogQuery): boolean {
  return catalogHref({ ...query, page: 1 }) !== routes.catalog;
}

export interface ActiveFilter {
  key: string;
  label: string;
  /** URL del catálogo sin este filtro */
  href: string;
}

function without<T>(list: T[], item: T): T[] {
  return list.filter((value) => value !== item);
}

/** Filtros aplicados, cada uno con el enlace que lo quita. */
export function getActiveFilters(
  query: CatalogQuery,
  brandNames: Record<string, string>,
): ActiveFilter[] {
  const base = { ...query, page: 1 };
  const filters: ActiveFilter[] = [];

  if (query.q) {
    filters.push({ key: "q", label: `«${query.q}»`, href: catalogHref({ ...base, q: "" }) });
  }
  for (const level of query.levels) {
    filters.push({
      key: `nivel-${level}`,
      label: `Nivel ${LEVEL_LABELS[level].toLowerCase()}`,
      href: catalogHref({ ...base, levels: without(query.levels, level) }),
    });
  }
  for (const style of query.styles) {
    filters.push({
      key: `estilo-${style}`,
      label: STYLE_LABELS[style],
      href: catalogHref({ ...base, styles: without(query.styles, style) }),
    });
  }
  for (const brand of query.brands) {
    filters.push({
      key: `marca-${brand}`,
      label: brandNames[brand] ?? brand,
      href: catalogHref({ ...base, brands: without(query.brands, brand) }),
    });
  }
  for (const shape of query.shapes) {
    filters.push({
      key: `forma-${shape}`,
      label: SHAPE_LABELS[shape],
      href: catalogHref({ ...base, shapes: without(query.shapes, shape) }),
    });
  }
  for (const balance of query.balances) {
    filters.push({
      key: `balance-${balance}`,
      label: `Balance ${BALANCE_LABELS[balance].toLowerCase()}`,
      href: catalogHref({ ...base, balances: without(query.balances, balance) }),
    });
  }
  for (const year of query.years) {
    filters.push({
      key: `anio-${year}`,
      label: String(year),
      href: catalogHref({ ...base, years: without(query.years, year) }),
    });
  }
  if (query.maxPrice !== null) {
    filters.push({
      key: "precio",
      label: `Hasta ${formatEuroCompact(query.maxPrice)}`,
      href: catalogHref({ ...base, maxPrice: null }),
    });
  }

  return filters;
}
