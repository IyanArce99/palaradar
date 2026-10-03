// Filas de la base de datos, una interfaz por tabla o vista de db/schema.sql.
// Los nombres van en snake_case para coincidir con las columnas de PostgreSQL.
import type {
  FaqItem,
  PalaBalance,
  PalaShape,
  PlayerLevel,
  PlayStyle,
  ScoredAspect,
  Spec,
} from "./catalog";
import type { PriceStatus } from "./pricing";

export interface BrandRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  logo_url: string | null;
}

export interface RacketRow {
  id: string;
  slug: string;
  brand_id: string;
  model: string;
  year: number;
  images: string[];
  shape: PalaShape;
  balance: PalaBalance;
  play_style: PlayStyle;
  levels: PlayerLevel[];
  weight_min: number;
  weight_max: number;
  description: string;
  editorial_summary: string;
  pros: string[];
  cons: string[];
  ideal_for: string[];
  not_for: string[];
  feel: ScoredAspect[];
  feel_summary: string;
  editorial_updated_at: string;
  /** Agregados de `reviews`, desnormalizados para ordenar el catálogo */
  rating: number;
  review_count: number;
  review_aspects: ScoredAspect[];
  review_highlights: string[];
  technical_specs: Spec[];
  faq: FaqItem[];
}

export interface RacketAlternativeRow {
  racket_id: string;
  alternative_id: string;
  reason: string;
  position: number;
}

export interface StoreRow {
  id: string;
  slug: string;
  name: string;
  url: string;
}

/** Precio actual de una pala en una tienda */
export interface StorePriceRow {
  racket_id: string;
  store_id: string;
  current_price: number;
  previous_price: number | null;
  shipping_cost: number;
  availability: string;
  product_url: string | null;
  last_updated: string;
}

/** Precio final (con envío) de una pala en una tienda un día concreto */
export interface PriceHistoryRow {
  racket_id: string;
  store_id: string;
  price: number;
  date: string;
}

export interface ReviewRow {
  id: string;
  racket_id: string;
  rating: number;
  title: string | null;
  text: string;
  author: string;
  level: PlayerLevel;
  author_context: string | null;
  created_at: string;
}

export interface RacketPriceStatsRow {
  racket_id: string;
  best_price: number;
  best_store_id: string;
  store_count: number;
  previous_price: number | null;
  drop_percent: number | null;
  avg_90d: number | null;
  min_price: number | null;
  min_price_date: string | null;
  price_30d_ago: number | null;
  price_status: PriceStatus;
  price_updated_at: string;
  computed_at: string;
}

/**
 * Vista `racket_catalog`: pala + marca + agregados de precio. Es lo único que
 * consulta el catálogo, con filtros, orden y paginación en SQL.
 */
export interface RacketCatalogRow {
  id: string;
  slug: string;
  model: string;
  year: number;
  images: string[];
  shape: PalaShape;
  balance: PalaBalance;
  play_style: PlayStyle;
  levels: PlayerLevel[];
  description: string;
  rating: number;
  review_count: number;
  brand_slug: string;
  brand_name: string;
  /** Marca, modelo y año en minúsculas y sin acentos, para la búsqueda */
  search_text: string;
  // Nulos si la pala no tiene ninguna oferta
  best_price: number | null;
  store_count: number | null;
  previous_price: number | null;
  drop_percent: number | null;
  min_price: number | null;
  price_30d_ago: number | null;
  price_status: PriceStatus | null;
  price_updated_at: string | null;
}
