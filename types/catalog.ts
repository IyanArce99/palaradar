// Modelos de dominio: lo que consumen páginas y componentes. La capa de datos
// los construye a partir de las filas de la base de datos (types/db.ts).
import type { PriceSummary } from "./pricing";

export type PalaShape = "redonda" | "lagrima" | "diamante";
export type PalaBalance = "bajo" | "medio" | "alto";
export type PlayerLevel = "iniciacion" | "intermedio" | "avanzado" | "competicion";
export type PlayStyle = "control" | "polivalente" | "potencia";
/** draft: borrador a partir de los datos del fabricante, pendiente de revisión */
export type EditorialStatus = "draft" | "reviewed";

export interface Brand {
  id: string;
  slug: string;
  name: string;
  description: string;
  logo: string | null;
}

export interface Store {
  id: string;
  slug: string;
  name: string;
  url: string;
}

export interface StoreOffer {
  store: Store;
  price: number;
  shipping: number;
  /** Precio en esta tienda antes de su último cambio */
  previousPrice: number | null;
  availability: string;
  /** Enlace al producto. null mientras no haya una oferta real detrás. */
  url: string | null;
  /** Momento en que se comprobó el precio en la tienda (ISO con hora) */
  checkedAt: string;
}

export interface PricePoint {
  /** Fecha ISO (YYYY-MM-DD) */
  date: string;
  price: number;
}

export interface ScoredAspect {
  label: string;
  score: number;
}

export interface Review {
  id: string;
  /** 1–5 */
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  authorLevel: PlayerLevel;
  /** Contexto de juego: frecuencia, lado, tiempo de uso */
  authorContext: string | null;
  createdAt: string;
}

export interface Editorial {
  status: EditorialStatus;
  summary: string;
  pros: string[];
  cons: string[];
  idealFor: string[];
  notFor: string[];
  /** Sensaciones en pista, de 1 a 5 */
  feel: ScoredAspect[];
  feelSummary: string;
  updatedAt: string;
}

export interface Spec {
  label: string;
  value: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** Proyección de una pala para tarjetas y listados */
export interface PalaSummary {
  id: string;
  slug: string;
  brand: Pick<Brand, "slug" | "name">;
  model: string;
  year: number;
  image: string | null;
  shape: PalaShape;
  description: string;
  rating: number;
  reviewCount: number;
  price: number | null;
  previousPrice: number | null;
  dropPercent: number | null;
  storeCount: number;
  priceNote: string | null;
}

export interface Alternative {
  pala: PalaSummary;
  /** Por qué es alternativa: "Más control", "Más barata"… */
  reason: string;
}

/** Pala completa, tal y como la necesita la ficha */
export interface Pala {
  id: string;
  slug: string;
  brand: Brand;
  model: string;
  year: number;
  images: string[];
  shape: PalaShape;
  /** Gramos. null si el fabricante no lo declara */
  weight: { min: number; max: number } | null;
  balance: PalaBalance | null;
  levels: PlayerLevel[];
  playStyle: PlayStyle | null;
  /** Frase corta para tarjetas y listados */
  description: string;
  editorial: Editorial;
  rating: number;
  reviewCount: number;
  /** Valoración por aspecto, de 0 a 10 */
  reviewAspects: ScoredAspect[];
  /** Lo que más repiten los jugadores */
  reviewHighlights: string[];
  reviews: Review[];
  /** null si ninguna tienda la tiene a la venta */
  price: PriceSummary | null;
  /** Mejor precio de cada día entre todas las tiendas, en orden cronológico */
  priceHistory: PricePoint[];
  /** Características que no cubren los campos estructurados (núcleo, caras, marco…) */
  specs: Spec[];
  /** Página de la que se verificaron las especificaciones */
  specsSourceUrl: string | null;
  faq: FaqItem[];
  alternatives: Alternative[];
}

export interface Guide {
  slug: string;
  title: string;
  subtitle: string;
  image: string | null;
}
