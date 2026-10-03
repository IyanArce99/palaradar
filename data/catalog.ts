import type { CatalogQuery, CollectionId, SortId } from "@/lib/catalog/query";
import { DEFAULT_QUERY } from "@/lib/catalog/query";
import { getPriceSummary, priceDaysAgo, type PriceSummary } from "@/lib/pricing";
import { brands as allBrands, featuredPalaSlug, guides, palas } from "@/mock";
import type { Brand, Guide, Pala, PalaSummary } from "@/types/catalog";

// Capa de acceso a datos. Las páginas y componentes solo conocen estas
// funciones; hoy leen de `mock/` y mañana de la base de datos, sin cambiar su firma.

const PAGE_SIZE = 12;
const BIG_DISCOUNT_PERCENT = 20;
const PRICE_STEP = 50;

interface CatalogEntry {
  pala: Pala;
  price: PriceSummary | null;
  summary: PalaSummary;
}

function toSummary(pala: Pala, price: PriceSummary | null): PalaSummary {
  return {
    id: pala.id,
    slug: pala.slug,
    brand: { slug: pala.brand.slug, name: pala.brand.name },
    model: pala.model,
    year: pala.year,
    image: pala.images[0] ?? null,
    shape: pala.shape,
    description: pala.description,
    rating: pala.rating,
    reviewCount: pala.reviewCount,
    price: price?.current ?? null,
    previousPrice: price?.previous ?? null,
    dropPercent: price?.dropPercent ?? null,
    storeCount: price?.storeCount ?? 0,
    priceNote: price?.verdict.cardNote ?? null,
  };
}

function loadEntries(): CatalogEntry[] {
  return palas.map((pala) => {
    const price = getPriceSummary(pala);
    return { pala, price, summary: toSummary(pala, price) };
  });
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function matchesSearch(pala: Pala, q: string): boolean {
  const haystack = normalizeText(`${pala.brand.name} ${pala.model} ${pala.year}`);
  return normalizeText(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function inCollection({ price }: CatalogEntry, collection: CollectionId): boolean {
  switch (collection) {
    case "en-oferta":
      return (price?.dropPercent ?? 0) > 0;
    case "mejor-precio":
      return price?.verdict.status === "good";
    case "grandes-descuentos":
      return (price?.dropPercent ?? 0) >= BIG_DISCOUNT_PERCENT;
    default:
      return true;
  }
}

function matchesQuery(entry: CatalogEntry, query: CatalogQuery): boolean {
  const { pala, price } = entry;
  const anyOf = <T>(selected: T[], value: T) => selected.length === 0 || selected.includes(value);

  return (
    (!query.q || matchesSearch(pala, query.q)) &&
    inCollection(entry, query.collection) &&
    (query.levels.length === 0 || query.levels.some((level) => pala.levels.includes(level))) &&
    anyOf(query.styles, pala.playStyle) &&
    anyOf(query.brands, pala.brand.slug) &&
    anyOf(query.shapes, pala.shape) &&
    anyOf(query.balances, pala.balance) &&
    anyOf(query.years, pala.year) &&
    (query.maxPrice === null || (price !== null && price.current <= query.maxPrice))
  );
}

/** Distancia relativa al mínimo histórico: 0 = está en su mínimo. */
function distanceToMin(price: PriceSummary | null): number {
  if (!price?.historicalMin) return Number.POSITIVE_INFINITY;
  return price.current / price.historicalMin.price - 1;
}

const comparators: Record<SortId, (a: CatalogEntry, b: CatalogEntry) => number> = {
  popularidad: (a, b) => b.pala.reviewCount - a.pala.reviewCount,
  precio: (a, b) =>
    (a.price?.current ?? Number.POSITIVE_INFINITY) - (b.price?.current ?? Number.POSITIVE_INFINITY),
  descuento: (a, b) => (b.price?.dropPercent ?? 0) - (a.price?.dropPercent ?? 0),
  minimo: (a, b) => distanceToMin(a.price) - distanceToMin(b.price),
  novedades: (a, b) => b.pala.year - a.pala.year || b.pala.reviewCount - a.pala.reviewCount,
};

export interface CatalogResult {
  items: PalaSummary[];
  total: number;
  page: number;
  pageCount: number;
}

export async function searchCatalog(query: CatalogQuery): Promise<CatalogResult> {
  const matches = loadEntries()
    .filter((entry) => matchesQuery(entry, query))
    .sort(comparators[query.sort]);

  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = Math.min(query.page, pageCount);

  return {
    items: matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((entry) => entry.summary),
    total: matches.length,
    page,
    pageCount,
  };
}

export async function countPalas(query: Partial<CatalogQuery> = {}): Promise<number> {
  const full = { ...DEFAULT_QUERY, ...query };
  return loadEntries().filter((entry) => matchesQuery(entry, full)).length;
}

export interface CatalogFacets {
  brands: Brand[];
  years: number[];
  /** Tope del filtro de precio, redondeado hacia arriba */
  priceCeiling: number;
}

export async function getCatalogFacets(): Promise<CatalogFacets> {
  const entries = loadEntries();
  const maxPrice = Math.max(0, ...entries.map((entry) => entry.price?.current ?? 0));

  return {
    brands: await getBrands(),
    years: [...new Set(entries.map((entry) => entry.pala.year))].sort((a, b) => b - a),
    priceCeiling: Math.ceil(maxPrice / PRICE_STEP) * PRICE_STEP,
  };
}

/** Marcas con al menos una pala en el catálogo. */
export async function getBrands(): Promise<Brand[]> {
  const withPalas = new Set(palas.map((pala) => pala.brand.slug));
  return allBrands.filter((brand) => withPalas.has(brand.slug));
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  return (await getBrands()).find((brand) => brand.slug === slug) ?? null;
}

export async function getPalasByBrand(brandSlug: string): Promise<PalaSummary[]> {
  return loadEntries()
    .filter((entry) => entry.pala.brand.slug === brandSlug)
    .sort(comparators.popularidad)
    .map((entry) => entry.summary);
}

export async function getPalaBySlug(slug: string): Promise<Pala | null> {
  return palas.find((pala) => pala.slug === slug) ?? null;
}

export async function getAllPalaSlugs(): Promise<string[]> {
  return palas.map((pala) => pala.slug);
}

export interface Alternative {
  pala: PalaSummary;
  reason: string;
}

export async function getAlternatives(pala: Pala): Promise<Alternative[]> {
  const bySlug = new Map(loadEntries().map((entry) => [entry.pala.slug, entry.summary]));
  return pala.alternatives.flatMap(({ slug, reason }) => {
    const summary = bySlug.get(slug);
    return summary ? [{ pala: summary, reason }] : [];
  });
}

/** Palas rebajadas respecto a su precio anterior, de mayor a menor descuento. */
export async function getDeals(limit?: number): Promise<PalaSummary[]> {
  return loadEntries()
    .filter((entry) => inCollection(entry, "en-oferta"))
    .sort(comparators.descuento)
    .slice(0, limit)
    .map((entry) => entry.summary);
}

export async function getPopularPalas(limit: number): Promise<PalaSummary[]> {
  return loadEntries()
    .sort(comparators.popularidad)
    .slice(0, limit)
    .map((entry) => entry.summary);
}

export interface MonthlyDrop {
  pala: PalaSummary;
  from: number;
  to: number;
  percent: number;
}

/** Mayores bajadas de precio de los últimos 30 días. */
export async function getBiggestMonthlyDrops(limit: number): Promise<MonthlyDrop[]> {
  return loadEntries()
    .flatMap(({ pala, price, summary }) => {
      const from = priceDaysAgo(pala.priceHistory, 30);
      if (!price || from === null || from <= price.current) return [];
      const percent = Math.round(((from - price.current) / from) * 100);
      return percent > 0 ? [{ pala: summary, from, to: price.current, percent }] : [];
    })
    .sort((a, b) => b.percent - a.percent)
    .slice(0, limit);
}

export async function getFeaturedPala(): Promise<Pala | null> {
  return getPalaBySlug(featuredPalaSlug);
}

export async function getPopularSearches(limit: number): Promise<string[]> {
  return (await getPopularPalas(limit)).map((pala) => pala.model);
}

export async function getGuides(): Promise<Guide[]> {
  return guides;
}
