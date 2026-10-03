// Repositorio en memoria sobre la semilla, para desarrollar sin base de datos.
// Reproduce lo que hace PostgreSQL: las "tablas" son las filas de la semilla,
// `racket_price_stats` y la vista `racket_catalog` se construyen una vez, y cada
// consulta equivale a un SELECT con WHERE, ORDER BY y LIMIT/OFFSET.
import { CATALOG_PAGE_SIZE, DEFAULT_QUERY, type CatalogQuery, type SortId } from "@/lib/catalog/query";
import { computePriceStats, priceFreshness } from "@/lib/pricing";
import type { PricePoint, StoreOffer } from "@/types/catalog";
import type { RacketCatalogRow } from "@/types/db";
import { toBrand, toMonthlyDrop, toPala, toPalaSummary, toPriceStatsRow, toStoreOffer } from "./mappers";
import type { CatalogRepository } from "./repository";
import { buildSeed } from "./seed/build";

const BIG_DISCOUNT_PERCENT = 20;
const PRICE_CEILING_STEP = 50;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function createMemoryRepository(): CatalogRepository {
  // La semilla se genera al arrancar: sus precios de prueba se dan por
  // comprobados en ese momento y envejecen con el reloj real.
  const tables = buildSeed(new Date());
  const now = () => new Date();

  const brandsById = new Map(tables.brands.map((brand) => [brand.id, brand]));
  const storesById = new Map(tables.stores.map((store) => [store.id, store]));

  function offersFor(racketId: string): StoreOffer[] {
    return tables.storePrices.flatMap((row) => {
      const store = storesById.get(row.store_id);
      return row.racket_id === racketId && store ? [toStoreOffer(row, store)] : [];
    });
  }

  /** Vista `racket_price_daily`: mejor precio de cada día entre todas las tiendas. */
  function dailyBestPrices(racketId: string): PricePoint[] {
    const byDate = new Map<string, number>();
    for (const row of tables.priceHistory) {
      if (row.racket_id !== racketId) continue;
      byDate.set(
        row.price_date,
        Math.min(byDate.get(row.price_date) ?? Number.POSITIVE_INFINITY, row.price),
      );
    }
    return [...byDate]
      .map(([date, price]) => ({ date, price }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Vista `racket_catalog`: pala + marca + agregados de precio (`racket_price_stats`). */
  const catalogRows: RacketCatalogRow[] = tables.rackets.flatMap((racket) => {
    const brand = brandsById.get(racket.brand_id);
    if (!brand) return [];
    const computed = computePriceStats(offersFor(racket.id), dailyBestPrices(racket.id), now());
    const stats = computed ? toPriceStatsRow(racket.id, computed) : null;

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
        price_checked_at: stats?.price_checked_at ?? null,
      },
    ];
  });

  const catalogById = new Map(catalogRows.map((row) => [row.id, row]));

  function isStale(row: RacketCatalogRow): boolean {
    return row.price_checked_at === null || priceFreshness(row.price_checked_at, now()) === "stale";
  }

  /** Equivalente al WHERE de la consulta del catálogo. */
  function matches(row: RacketCatalogRow, query: CatalogQuery): boolean {
    const anyOf = <T>(selected: T[], value: T | null) =>
      selected.length === 0 || (value !== null && selected.includes(value));
    const drop = row.drop_percent ?? 0;

    const inCollection =
      query.collection === "todas" ||
      (query.collection === "en-oferta" && drop > 0) ||
      (query.collection === "grandes-descuentos" && drop >= BIG_DISCOUNT_PERCENT) ||
      (query.collection === "mejor-precio" && row.price_status === "good" && !isStale(row));

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
  const bySlug = (a: RacketCatalogRow, b: RacketCatalogRow) => a.slug.localeCompare(b.slug);
  const distanceToMin = (row: RacketCatalogRow) =>
    row.best_price !== null && row.min_price ? row.best_price / row.min_price : LAST;

  /** Equivalente al ORDER BY; las palas sin precio van al final (NULLS LAST). */
  const orderBy: Record<SortId, (a: RacketCatalogRow, b: RacketCatalogRow) => number> = {
    popularidad: (a, b) => b.review_count - a.review_count || b.year - a.year || bySlug(a, b),
    precio: (a, b) => (a.best_price ?? LAST) - (b.best_price ?? LAST) || bySlug(a, b),
    descuento: (a, b) => (b.drop_percent ?? -1) - (a.drop_percent ?? -1) || bySlug(a, b),
    minimo: (a, b) => distanceToMin(a) - distanceToMin(b) || bySlug(a, b),
    novedades: (a, b) => b.year - a.year || b.review_count - a.review_count || bySlug(a, b),
  };

  const repository: CatalogRepository = {
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
      const maxPrice = Math.max(0, ...catalogRows.map((row) => row.best_price ?? 0));
      return {
        brands: await repository.getBrands(),
        years: [...new Set(catalogRows.map((row) => row.year))].sort((a, b) => b - a),
        priceCeiling: Math.ceil(maxPrice / PRICE_CEILING_STEP) * PRICE_CEILING_STEP,
      };
    },

    async getBrands() {
      const withRackets = new Set(catalogRows.map((row) => row.brand_slug));
      return tables.brands
        .filter((brand) => withRackets.has(brand.slug))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(toBrand);
    },

    async getBrandBySlug(slug) {
      return (await repository.getBrands()).find((brand) => brand.slug === slug) ?? null;
    },

    async getPalaBySlug(slug) {
      const racket = tables.rackets.find((row) => row.slug === slug);
      const brand = racket && brandsById.get(racket.brand_id);
      if (!racket || !brand) return null;

      const alternatives = tables.racketAlternatives
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
          reviews: tables.reviews
            .filter((row) => row.racket_id === racket.id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at)),
          alternatives,
        },
        now(),
      );
    },

    async getAllPalaSlugs() {
      return catalogRows.map((row) => row.slug).sort();
    },

    async getBiggestMonthlyDrops(limit) {
      return catalogRows
        .flatMap((row) => toMonthlyDrop(row, now()) ?? [])
        .sort((a, b) => b.percent - a.percent)
        .slice(0, limit);
    },
  };

  return repository;
}
