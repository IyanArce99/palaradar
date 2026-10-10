// Repositorio en memoria sobre la semilla, para desarrollar sin base de datos.
// Reproduce lo que hace PostgreSQL: las "tablas" son las filas de la semilla,
// `racket_price_stats` y la vista `racket_catalog` se construyen una vez, y cada
// consulta equivale a un SELECT con WHERE, ORDER BY y LIMIT/OFFSET.
import { createHash } from "node:crypto";
import {
  CATALOG_PAGE_SIZE,
  COMPARABLE_STORES,
  DEFAULT_QUERY,
  type CatalogQuery,
  type SortId,
} from "@/lib/catalog/query";
import { isIndexablePala } from "@/lib/indexability";
import { buildPriceHistory, computePriceStats, priceFreshness, usableOffers } from "@/lib/pricing";
import { affinity, matchCriteria, rankRecommendations } from "@/lib/recommender";
import { sameModelSeasons, sharedTraits } from "@/lib/similar";
import type { PricePoint, StoreOffer } from "@/types/catalog";
import type { RacketCatalogRow } from "@/types/db";
import {
  currentPrice,
  toBrand,
  toMonthlyDrop,
  toPala,
  toPalaSummary,
  toPriceStatsRow,
  toStore,
  toStoreOffer,
} from "./mappers";
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

  /** Mejor precio de cada día entre todas las tiendas (aquí todas son de la semilla). */
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

  /** Precio que cuenta para filtrar y ordenar: nulo si la comprobación está desactualizada. */
  const priceOf = (row: RacketCatalogRow) => currentPrice(row, now());

  /** Equivalente al WHERE de la consulta del catálogo. */
  function matches(row: RacketCatalogRow, query: CatalogQuery): boolean {
    const anyOf = <T>(selected: T[], value: T | null) =>
      selected.length === 0 || (value !== null && selected.includes(value));
    const price = priceOf(row);
    const drop = price === null ? 0 : (row.drop_percent ?? 0);

    const inCollection =
      query.collection === "todas" ||
      (query.collection === "en-oferta" && drop > 0) ||
      (query.collection === "grandes-descuentos" && drop >= BIG_DISCOUNT_PERCENT) ||
      (query.collection === "mejor-precio" && row.price_status === "good" && price !== null);

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
      (query.maxPrice === null || (price !== null && price <= query.maxPrice)) &&
      (!query.coverage.includes("con-precio") || price !== null) &&
      (!query.coverage.includes("varias-tiendas") || (price !== null && (row.store_count ?? 0) >= COMPARABLE_STORES))
    );
  }

  const LAST = Number.POSITIVE_INFINITY;
  const bySlug = (a: RacketCatalogRow, b: RacketCatalogRow) => a.slug.localeCompare(b.slug);
  const dropOf = (row: RacketCatalogRow) => (priceOf(row) === null ? -1 : (row.drop_percent ?? -1));
  const distanceToMin = (row: RacketCatalogRow) => {
    const price = priceOf(row);
    return price !== null && row.min_price ? price / row.min_price : LAST;
  };

  /** Orden por defecto: más tiendas con precio actual y, a igualdad, las más recientes. */
  const storesOf = (row: RacketCatalogRow) => (priceOf(row) === null ? -1 : (row.store_count ?? -1));
  const photoOf = (row: RacketCatalogRow) => (row.photo_path ? 1 : 0);
  // Desempate fijo y sin significado, como el md5(slug) de PostgreSQL: mezcla las marcas.
  const hashOf = (row: RacketCatalogRow) => createHash("md5").update(row.slug).digest("hex");
  const byHash = (a: RacketCatalogRow, b: RacketCatalogRow) => {
    const [x, y] = [hashOf(a), hashOf(b)];
    if (x === y) return 0;
    return x < y ? -1 : 1;
  };
  // Datos de perfil declarados (balance, estilo, nivel), como en la consulta de PostgreSQL.
  const documented = (row: RacketCatalogRow) =>
    Number(row.balance !== null) + Number(row.play_style !== null) + Number(row.levels.length > 0);
  const byAvailability = (a: RacketCatalogRow, b: RacketCatalogRow) =>
    storesOf(b) - storesOf(a) ||
    photoOf(b) - photoOf(a) ||
    documented(b) - documented(a) ||
    b.year - a.year ||
    byHash(a, b) ||
    bySlug(a, b);

  /** Equivalente al ORDER BY; las palas sin precio actual van al final (NULLS LAST). */
  const orderBy: Record<SortId, (a: RacketCatalogRow, b: RacketCatalogRow) => number> = {
    disponibilidad: byAvailability,
    precio: (a, b) => (priceOf(a) ?? LAST) - (priceOf(b) ?? LAST) || bySlug(a, b),
    descuento: (a, b) => dropOf(b) - dropOf(a) || bySlug(a, b),
    minimo: (a, b) => distanceToMin(a) - distanceToMin(b) || bySlug(a, b),
    novedades: (a, b) => b.year - a.year || storesOf(b) - storesOf(a) || bySlug(a, b),
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
      const maxPrice = Math.max(0, ...catalogRows.map((row) => priceOf(row) ?? 0));
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

    async getPalaSummaries(slugs) {
      const wanted = new Set(slugs);
      return catalogRows
        .filter((row) => wanted.has(row.slug))
        .sort(bySlug)
        .map((row) => toPalaSummary(row, now()));
    },

    async getPriceHistory(slug) {
      const racket = tables.rackets.find((row) => row.slug === slug);
      if (!racket) return null;

      return buildPriceHistory(
        tables.priceHistory.flatMap((row) => {
          const store = storesById.get(row.store_id);
          return row.racket_id === racket.id && store
            ? [{ store: toStore(store), date: row.price_date, price: row.price }]
            : [];
        }),
      );
    },

    async getAllPalaSlugs() {
      return catalogRows.map((row) => row.slug).sort();
    },

    async getIndexablePalas() {
      const palas = await Promise.all(catalogRows.map((row) => repository.getPalaBySlug(row.slug)));
      return palas
        .flatMap((pala) => (pala && isIndexablePala(pala) ? [{ slug: pala.slug, brandSlug: pala.brand.slug }] : []))
        .sort((a, b) => a.slug.localeCompare(b.slug));
    },

    async getPricedPalaSlugs() {
      return catalogRows
        .filter((row) => row.best_price !== null)
        .map((row) => row.slug)
        .sort();
    },

    async getBiggestMonthlyDrops(limit) {
      return catalogRows
        .flatMap((row) => toMonthlyDrop(row, now()) ?? [])
        .sort((a, b) => b.percent - a.percent)
        .slice(0, limit);
    },

    async getAlternativePairs() {
      return tables.racketAlternatives.flatMap((row): [string, string][] => {
        const a = catalogById.get(row.racket_id);
        const b = catalogById.get(row.alternative_id);
        return a && b ? [[a.slug, b.slug]] : [];
      });
    },

    async getTopRatedPalas(filters, limit) {
      // La semilla no tiene puntuaciones externas: se devuelve el orden del catálogo, sin nota.
      const query = { ...DEFAULT_QUERY, ...filters };
      return catalogRows
        .filter((row) => matches(row, query) && priceOf(row) !== null)
        .sort(byAvailability)
        .slice(0, limit)
        .map((row) => ({ pala: toPalaSummary(row, now()), score: null }));
    },

    async getSimilarPalas(target, limit) {
      const hasPhoto = (row: RacketCatalogRow) => (row.photo_path ? 1 : 0);
      const distance = (row: RacketCatalogRow) =>
        target.price === null ? 0 : Math.abs((priceOf(row) ?? 0) - target.price);

      return catalogRows
        .filter((row) => row.id !== target.id && row.shape === target.shape && priceOf(row) !== null)
        .map((row) => ({
          row,
          shared: sharedTraits(target, { balance: row.balance, levels: row.levels, playStyle: row.play_style }),
        }))
        .sort(
          (a, b) =>
            b.shared.length - a.shared.length ||
            hasPhoto(b.row) - hasPhoto(a.row) ||
            distance(a.row) - distance(b.row) ||
            byAvailability(a.row, b.row),
        )
        .slice(0, limit)
        .map(({ row, shared }) => ({ pala: toPalaSummary(row, now()), shared }));
    },

    async getMultiStoreOffers() {
      return catalogRows
        .filter((row) => priceOf(row) !== null)
        .sort(bySlug)
        .flatMap((row) => {
          const offers = usableOffers(offersFor(row.id), now()).filter(
            (offer) => priceFreshness(offer.checkedAt, now()) !== "stale",
          );
          return offers.length >= COMPARABLE_STORES ? [{ pala: toPalaSummary(row, now()), offers }] : [];
        });
    },

    async getSeasonGroups() {
      const groups = new Map<string, RacketCatalogRow[]>();
      for (const row of catalogRows.filter((item) => priceOf(item) !== null)) {
        const key = `${row.brand_slug}|${row.model.trim().toLowerCase()}`;
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }
      return [...groups.values()]
        .filter((rows) => new Set(rows.map((row) => row.year)).size >= 2)
        .map((rows) => [...rows].sort((a, b) => b.year - a.year || bySlug(a, b)).map((row) => toPalaSummary(row, now())));
    },

    async getPriceSources() {
      return tables.stores
        .map((store) => {
          const prices = tables.storePrices.filter((row) => row.store_id === store.id);
          const fresh = prices.filter((row) => priceFreshness(row.checked_at, now()) !== "stale");
          const days = tables.priceHistory.filter((row) => row.store_id === store.id).map((row) => row.price_date);
          return {
            name: store.name,
            prices: fresh.length,
            since: [...days].sort((a, b) => a.localeCompare(b))[0] ?? null,
            lastCheckedAt: prices.map((row) => row.checked_at).sort((a, b) => b.localeCompare(a))[0] ?? null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async getBrandCoverage() {
      const byBrand = new Map<string, { brand: { slug: string; name: string }; total: number; priced: number; multiStore: number; withPhoto: number }>();
      for (const row of catalogRows) {
        const entry = byBrand.get(row.brand_slug) ?? {
          brand: { slug: row.brand_slug, name: row.brand_name },
          total: 0,
          priced: 0,
          multiStore: 0,
          withPhoto: 0,
        };
        const price = priceOf(row);
        entry.total += 1;
        if (price !== null) entry.priced += 1;
        if (price !== null && (row.store_count ?? 0) >= COMPARABLE_STORES) entry.multiStore += 1;
        if (row.photo_path) entry.withPhoto += 1;
        byBrand.set(row.brand_slug, entry);
      }
      return [...byBrand.values()].sort((a, b) => a.brand.name.localeCompare(b.brand.name));
    },

    async getModelSeasons(pala, limit) {
      const candidates = catalogRows
        .filter((row) => row.brand_slug === pala.brandSlug)
        .map((row) => toPalaSummary(row, now()));
      return sameModelSeasons({ ...pala, brand: { slug: pala.brandSlug } }, candidates).slice(0, limit);
    },

    async getAlternativeCandidates() {
      const racketsById = new Map(tables.rackets.map((racket) => [racket.id, racket]));
      return catalogRows
        .filter((row) => priceOf(row) !== null)
        .sort(bySlug)
        .flatMap((row) => {
          const racket = racketsById.get(row.id);
          if (!racket) return [];
          const touch = racket.technical_specs.find((spec) => spec.label === "Tacto")?.value;
          return [
            {
              pala: toPalaSummary(row, now()),
              shape: row.shape,
              balance: row.balance,
              playStyle: row.play_style,
              levels: row.levels,
              weight:
                racket.weight_min !== null && racket.weight_max !== null
                  ? { min: racket.weight_min, max: racket.weight_max }
                  : null,
              touch: touch?.trim() || racket.hardness?.trim() || null,
            },
          ];
        });
    },

    async recommendPalas(prefs, limit) {
      const racketsById = new Map(tables.rackets.map((racket) => [racket.id, racket]));

      const ordered = catalogRows
        .flatMap((row) => {
          const racket = racketsById.get(row.id);
          if (!racket) return [];

          const traits = {
            levels: row.levels,
            playStyle: row.play_style,
            shape: row.shape,
            balance: row.balance,
            touch: racket.technical_specs.find((spec) => spec.label === "Tacto")?.value ?? null,
            hardness: racket.hardness ?? null,
            price: priceOf(row),
          };
          const matched = matchCriteria(prefs, traits);
          return matched ? [{ row, matched, affinity: affinity(prefs, traits), price: traits.price }] : [];
        })
        .sort((a, b) => b.matched.length - a.matched.length || byAvailability(a.row, b.row));

      return rankRecommendations(ordered)
        .slice(0, limit)
        .map(({ row, matched, affinity: score }) => ({ pala: toPalaSummary(row, now()), matched, affinity: score }));
    },
  };

  return repository;
}
