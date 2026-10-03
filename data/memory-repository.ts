// Repositorio en memoria sobre la semilla. Reproduce lo que hará PostgreSQL:
// las "tablas" son los arrays de data/seed, `racket_price_stats` y la vista
// `racket_catalog` se construyen una vez al cargar, y cada consulta equivale a
// un SELECT con WHERE, ORDER BY y LIMIT/OFFSET sobre esa vista.
import { CATALOG_PAGE_SIZE, DEFAULT_QUERY, type CatalogQuery, type SortId } from "@/lib/catalog/query";
import { computePriceStats, isPriceStale } from "@/lib/pricing";
import type { PricePoint, StoreOffer } from "@/types/catalog";
import type { RacketCatalogRow, RacketPriceStatsRow } from "@/types/db";
import { toBrand, toPala, toPalaSummary, toPriceStatsRow, toStoreOffer } from "./mappers";
import type { CatalogRepository } from "./repository";
import {
  brands,
  priceHistory,
  racketAlternatives,
  rackets,
  reviews,
  SEED_SNAPSHOT_AT,
  storePrices,
  stores,
} from "./seed";

const BIG_DISCOUNT_PERCENT = 20;
const PRICE_CEILING_STEP = 50;

/** Reloj de la capa de datos. Con la semilla se fija en su instantánea; con datos reales será `new Date()`. */
function now(): Date {
  return new Date(SEED_SNAPSHOT_AT);
}

const brandsById = new Map(brands.map((brand) => [brand.id, brand]));
const storesById = new Map(stores.map((store) => [store.id, store]));

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function offersFor(racketId: string): StoreOffer[] {
  return storePrices.flatMap((row) => {
    const store = storesById.get(row.store_id);
    return row.racket_id === racketId && store ? [toStoreOffer(row, store)] : [];
  });
}

/** Vista `racket_price_daily`: mejor precio de cada día entre todas las tiendas. */
function dailyBestPrices(racketId: string): PricePoint[] {
  const byDate = new Map<string, number>();
  for (const row of priceHistory) {
    if (row.racket_id !== racketId) continue;
    byDate.set(row.date, Math.min(byDate.get(row.date) ?? Number.POSITIVE_INFINITY, row.price));
  }
  return [...byDate]
    .map(([date, price]) => ({ date, price }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Tabla `racket_price_stats`: en producción la rellena el proceso que actualiza precios. */
const priceStats = new Map<string, RacketPriceStatsRow>(
  rackets.flatMap((racket) => {
    const stats = computePriceStats(offersFor(racket.id), dailyBestPrices(racket.id), now());
    return stats ? [[racket.id, toPriceStatsRow(racket.id, stats)] as const] : [];
  }),
);

/** Vista `racket_catalog`: pala + marca + agregados de precio. */
const catalogRows: RacketCatalogRow[] = rackets.flatMap((racket) => {
  const brand = brandsById.get(racket.brand_id);
  if (!brand) return [];
  const stats = priceStats.get(racket.id);

  return [
    {
      id: racket.id,
      slug: racket.slug,
      model: racket.model,
      year: racket.year,
      images: racket.images,
      shape: racket.shape,
      balance: racket.balance,
      play_style: racket.play_style,
      levels: racket.levels,
      description: racket.description,
      rating: racket.rating,
      review_count: racket.review_count,
      brand_slug: brand.slug,
      brand_name: brand.name,
      search_text: normalizeText(`${brand.name} ${racket.model} ${racket.year}`),
      best_price: stats?.best_price ?? null,
      store_count: stats?.store_count ?? null,
      previous_price: stats?.previous_price ?? null,
      drop_percent: stats?.drop_percent ?? null,
      min_price: stats?.min_price ?? null,
      price_30d_ago: stats?.price_30d_ago ?? null,
      price_status: stats?.price_status ?? null,
      price_updated_at: stats?.price_updated_at ?? null,
    },
  ];
});

const catalogBySlug = new Map(catalogRows.map((row) => [row.slug, row]));
const catalogById = new Map(catalogRows.map((row) => [row.id, row]));

function hasFreshPrice(row: RacketCatalogRow): boolean {
  return row.price_updated_at !== null && !isPriceStale(row.price_updated_at, now());
}

/** Equivalente al WHERE de la consulta del catálogo. */
function matches(row: RacketCatalogRow, query: CatalogQuery): boolean {
  const anyOf = <T>(selected: T[], value: T) => selected.length === 0 || selected.includes(value);
  const drop = row.drop_percent ?? 0;

  const inCollection =
    query.collection === "todas" ||
    (query.collection === "en-oferta" && drop > 0) ||
    (query.collection === "grandes-descuentos" && drop >= BIG_DISCOUNT_PERCENT) ||
    (query.collection === "mejor-precio" && row.price_status === "good" && hasFreshPrice(row));

  const matchesSearch = normalizeText(query.q)
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => row.search_text.includes(token));

  return (
    inCollection &&
    matchesSearch &&
    (query.levels.length === 0 || query.levels.some((level) => row.levels.includes(level))) &&
    anyOf(query.styles, row.play_style) &&
    anyOf(query.brands, row.brand_slug) &&
    anyOf(query.shapes, row.shape) &&
    anyOf(query.balances, row.balance) &&
    anyOf(query.years, row.year) &&
    (query.maxPrice === null || (row.best_price !== null && row.best_price <= query.maxPrice))
  );
}

const LAST = Number.POSITIVE_INFINITY;

/** Distancia relativa al mínimo histórico: 0 = está en su mínimo. */
function distanceToMin(row: RacketCatalogRow): number {
  return row.best_price !== null && row.min_price ? row.best_price / row.min_price - 1 : LAST;
}

/** Equivalente al ORDER BY; las palas sin precio van al final (NULLS LAST). */
const orderBy: Record<SortId, (a: RacketCatalogRow, b: RacketCatalogRow) => number> = {
  popularidad: (a, b) => b.review_count - a.review_count,
  precio: (a, b) => (a.best_price ?? LAST) - (b.best_price ?? LAST),
  descuento: (a, b) => (b.drop_percent ?? -1) - (a.drop_percent ?? -1),
  minimo: (a, b) => distanceToMin(a) - distanceToMin(b),
  novedades: (a, b) => b.year - a.year || b.review_count - a.review_count,
};

export const memoryRepository: CatalogRepository = {
  async searchCatalog(query, { pageSize = CATALOG_PAGE_SIZE } = {}) {
    const rows = catalogRows.filter((row) => matches(row, query)).sort(orderBy[query.sort]);
    const offset = (query.page - 1) * pageSize;

    return {
      items: rows.slice(offset, offset + pageSize).map((row) => toPalaSummary(row, now())),
      total: rows.length,
      page: query.page,
      pageCount: Math.max(1, Math.ceil(rows.length / pageSize)),
    };
  },

  async countPalas(filters = {}) {
    const query = { ...DEFAULT_QUERY, ...filters };
    return catalogRows.filter((row) => matches(row, query)).length;
  },

  async getCatalogFacets() {
    const brandSlugs = new Set(catalogRows.map((row) => row.brand_slug));
    const maxPrice = Math.max(0, ...catalogRows.map((row) => row.best_price ?? 0));

    return {
      brands: brands.filter((brand) => brandSlugs.has(brand.slug)).map(toBrand),
      years: [...new Set(catalogRows.map((row) => row.year))].sort((a, b) => b - a),
      priceCeiling: Math.ceil(maxPrice / PRICE_CEILING_STEP) * PRICE_CEILING_STEP,
    };
  },

  async getBrands() {
    return (await memoryRepository.getCatalogFacets()).brands;
  },

  async getBrandBySlug(slug) {
    return (await memoryRepository.getBrands()).find((brand) => brand.slug === slug) ?? null;
  },

  async getPalaBySlug(slug) {
    const racket = rackets.find((row) => row.slug === slug);
    const brand = racket && brandsById.get(racket.brand_id);
    if (!racket || !brand) return null;

    const alternatives = racketAlternatives
      .filter((row) => row.racket_id === racket.id)
      .sort((a, b) => a.position - b.position)
      .flatMap(({ alternative_id, reason }) => {
        const row = catalogById.get(alternative_id);
        return row ? [{ pala: toPalaSummary(row, now()), reason }] : [];
      });

    return toPala(
      {
        racket,
        brand,
        offers: offersFor(racket.id),
        priceHistory: dailyBestPrices(racket.id),
        stats: priceStats.get(racket.id) ?? null,
        reviews: reviews
          .filter((row) => row.racket_id === racket.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at)),
        alternatives,
      },
      now(),
    );
  },

  async getAllPalaSlugs() {
    return [...catalogBySlug.keys()];
  },

  async getBiggestMonthlyDrops(limit) {
    return catalogRows
      .flatMap((row) => {
        const { best_price: to, price_30d_ago: from } = row;
        if (to === null || from === null || from <= to || !hasFreshPrice(row)) return [];
        const percent = Math.round(((from - to) / from) * 100);
        return percent > 0 ? [{ pala: toPalaSummary(row, now()), from, to, percent }] : [];
      })
      .sort((a, b) => b.percent - a.percent)
      .slice(0, limit);
  },
};
