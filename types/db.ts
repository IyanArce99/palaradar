// Filas de la base de datos, una interfaz por tabla o vista de db/schema.sql.
// Los nombres van en snake_case para coincidir con las columnas de PostgreSQL.
import type {
  EditorialStatus,
  FaqItem,
  PalaBalance,
  PalaShape,
  PlayerLevel,
  PlayStyle,
  ScoredAspect,
  Spec,
} from "./catalog";
import type { MediaRole, RightsStatus, VerificationStatus } from "@/lib/media";
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
  balance: PalaBalance | null;
  play_style: PlayStyle | null;
  levels: PlayerLevel[];
  weight_min: number | null;
  weight_max: number | null;
  description: string;
  editorial_summary: string;
  editorial_status: EditorialStatus;
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
  specs_source_url: string | null;
  /** Columnas del catálogo enriquecido; la semilla en memoria no las tiene */
  hardness?: string | null;
  player?: string | null;
  gender?: string | null;
  msrp?: number | null;
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
  /** Tienda de demostración: sus precios no cuentan salvo en desarrollo */
  is_demo: boolean;
}

/** Precio actual de una pala en una tienda */
export interface StorePriceRow {
  racket_id: string;
  store_id: string;
  current_price: number;
  previous_price: number | null;
  /** null si no se conoce la regla de envío de la tienda: el precio no lo incluye */
  shipping_cost: number | null;
  availability: string;
  product_url: string | null;
  /** Momento en que se comprobó el precio (ISO con hora) */
  checked_at: string;
}

/** Precio final (con envío) de una pala en una tienda un día concreto */
export interface PriceHistoryRow {
  racket_id: string;
  store_id: string;
  price: number;
  /** Día al que corresponde el precio (YYYY-MM-DD) */
  price_date: string;
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
  /** Media y mínimo de los últimos 30 días; nulos sin histórico suficiente */
  avg_30d: number | null;
  min_price: number | null;
  min_price_date: string | null;
  price_30d_ago: number | null;
  /** Primer día con precio registrado */
  tracked_since: string | null;
  price_status: PriceStatus;
  price_checked_at: string;
  computed_at: string;
}

// --- Ingestión de precios (db/migrations/002_price_ingestion.sql) ---------------

export type IdentifierType = "gtin" | "manufacturer_ref" | "padelzoom_model_id" | "padelzoom_slug";
export type MatchingStatus = "matched" | "pending_review" | "rejected";
export type MatchingMethod = "gtin" | "attributes" | "manual";
export type ListingStatus = "active" | "out_of_stock" | "missing";
export type IngestionStatus = "running" | "success" | "failed";

export interface RacketIdentifierRow {
  racket_id: string;
  type: IdentifierType;
  /** Los GTIN, normalizados a 14 dígitos */
  value: string;
  source: string;
  verified_at: string | null;
}

/** Un producto del catálogo de una tienda, esté o no emparejado con una pala nuestra */
export interface StoreProductRow {
  id: string;
  store_id: string;
  external_id: string;
  racket_id: string | null;
  title: string;
  brand: string | null;
  gtin: string | null;
  url: string;
  matching_status: MatchingStatus;
  matching_method: MatchingMethod | null;
  matching_note: string | null;
  listing_status: ListingStatus;
  /** Último precio aceptado, sin envío */
  price: number | null;
  /** Precio de lista que declara la tienda; no se usa como precio anterior */
  list_price: number | null;
  /** Bajada anómala a la espera de confirmarse */
  pending_price: number | null;
  checked_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  missed_runs: number;
}

export interface IngestionRunRow {
  id: string;
  store_id: string;
  started_at: string;
  finished_at: string | null;
  status: IngestionStatus;
  products_seen: number;
  products_matched: number;
  products_pending: number;
  prices_updated: number;
  error_message: string | null;
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
  balance: PalaBalance | null;
  play_style: PlayStyle | null;
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
  price_checked_at: string | null;
  /** Ruta en Storage de la foto publicada; la semilla en memoria no tiene fotos */
  photo_path?: string | null;
}

/** Imagen de una pala: origen, copia propia y estado de publicación */
export interface RacketMediaRow {
  racket_id: string;
  source: string;
  source_url: string;
  role: MediaRole;
  position: number;
  storage_path: string | null;
  width: number | null;
  height: number | null;
  file_hash: string | null;
  file_size: number | null;
  fetched_at: string | null;
  matching_method: string | null;
  matching_confidence: "high" | "medium" | "review" | null;
  verification_status: VerificationStatus;
  verification_note: string | null;
  rights_status: RightsStatus;
  rights_note: string | null;
}
