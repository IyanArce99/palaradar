// Conversión de filas de base de datos a modelos de dominio. Cualquier
// implementación del repositorio (memoria, Supabase) reutiliza estas funciones.
import { buildPriceSummary, isPriceStale, priceCardNote } from "@/lib/pricing";
import type {
  Alternative,
  Brand,
  Pala,
  PalaSummary,
  PricePoint,
  Review,
  Store,
  StoreOffer,
} from "@/types/catalog";
import type {
  BrandRow,
  RacketCatalogRow,
  RacketPriceStatsRow,
  RacketRow,
  ReviewRow,
  StorePriceRow,
  StoreRow,
} from "@/types/db";
import type { PriceStats } from "@/types/pricing";

export function toBrand(row: BrandRow): Brand {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    logo: row.logo_url,
  };
}

export function toStore(row: StoreRow): Store {
  return { id: row.id, slug: row.slug, name: row.name, url: row.url };
}

export function toStoreOffer(row: StorePriceRow, store: StoreRow): StoreOffer {
  return {
    store: toStore(store),
    price: row.current_price,
    shipping: row.shipping_cost,
    previousPrice: row.previous_price,
    availability: row.availability,
    url: row.product_url,
    updatedAt: row.last_updated,
  };
}

export function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.text,
    authorName: row.author,
    authorLevel: row.level,
    authorContext: row.author_context,
    createdAt: row.created_at,
  };
}

export function toPriceStats(row: RacketPriceStatsRow): PriceStats {
  return {
    bestPrice: row.best_price,
    bestStoreId: row.best_store_id,
    storeCount: row.store_count,
    previousPrice: row.previous_price,
    dropPercent: row.drop_percent,
    average90: row.avg_90d,
    minPrice: row.min_price,
    minPriceDate: row.min_price_date,
    price30dAgo: row.price_30d_ago,
    status: row.price_status,
    priceUpdatedAt: row.price_updated_at,
    computedAt: row.computed_at,
  };
}

export function toPriceStatsRow(racketId: string, stats: PriceStats): RacketPriceStatsRow {
  return {
    racket_id: racketId,
    best_price: stats.bestPrice,
    best_store_id: stats.bestStoreId,
    store_count: stats.storeCount,
    previous_price: stats.previousPrice,
    drop_percent: stats.dropPercent,
    avg_90d: stats.average90,
    min_price: stats.minPrice,
    min_price_date: stats.minPriceDate,
    price_30d_ago: stats.price30dAgo,
    price_status: stats.status,
    price_updated_at: stats.priceUpdatedAt,
    computed_at: stats.computedAt,
  };
}

export function toPalaSummary(row: RacketCatalogRow, now: Date): PalaSummary {
  const isStale = row.price_updated_at !== null && isPriceStale(row.price_updated_at, now);

  return {
    id: row.id,
    slug: row.slug,
    brand: { slug: row.brand_slug, name: row.brand_name },
    model: row.model,
    year: row.year,
    image: row.images[0] ?? null,
    shape: row.shape,
    description: row.description,
    rating: row.rating,
    reviewCount: row.review_count,
    price: row.best_price,
    previousPrice: row.previous_price,
    dropPercent: row.drop_percent,
    storeCount: row.store_count ?? 0,
    priceNote:
      row.best_price !== null && row.price_status !== null
        ? priceCardNote(
            { status: row.price_status, bestPrice: row.best_price, minPrice: row.min_price },
            isStale,
          )
        : null,
  };
}

interface PalaParts {
  racket: RacketRow;
  brand: BrandRow;
  offers: StoreOffer[];
  /** Mejor precio de cada día (vista racket_price_daily), en orden cronológico */
  priceHistory: PricePoint[];
  stats: RacketPriceStatsRow | null;
  reviews: ReviewRow[];
  alternatives: Alternative[];
}

export function toPala(parts: PalaParts, now: Date): Pala {
  const { racket, brand, offers, priceHistory, stats, reviews, alternatives } = parts;

  return {
    id: racket.id,
    slug: racket.slug,
    brand: toBrand(brand),
    model: racket.model,
    year: racket.year,
    images: racket.images,
    shape: racket.shape,
    weight: { min: racket.weight_min, max: racket.weight_max },
    balance: racket.balance,
    levels: racket.levels,
    playStyle: racket.play_style,
    description: racket.description,
    editorial: {
      summary: racket.editorial_summary,
      pros: racket.pros,
      cons: racket.cons,
      idealFor: racket.ideal_for,
      notFor: racket.not_for,
      feel: racket.feel,
      feelSummary: racket.feel_summary,
      updatedAt: racket.editorial_updated_at,
    },
    rating: racket.rating,
    reviewCount: racket.review_count,
    reviewAspects: racket.review_aspects,
    reviewHighlights: racket.review_highlights,
    reviews: reviews.map(toReview),
    price: stats ? buildPriceSummary(toPriceStats(stats), offers, now) : null,
    priceHistory,
    specs: racket.technical_specs,
    faq: racket.faq,
    alternatives,
  };
}
