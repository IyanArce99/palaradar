export type PalaShape = "redonda" | "lagrima" | "diamante";
export type PalaBalance = "bajo" | "medio" | "alto";
export type PlayerLevel = "iniciacion" | "intermedio" | "avanzado" | "competicion";
export type PlayStyle = "control" | "polivalente" | "potencia";

export interface Brand {
  id: string;
  slug: string;
  name: string;
  description: string;
}

export interface Store {
  id: string;
  name: string;
}

export interface StoreOffer {
  store: Store;
  price: number;
  shipping: number;
  availability: string;
  /** Enlace a la tienda. null mientras no haya una oferta real detrás. */
  url: string | null;
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
  body: string;
  authorName: string;
  authorLevel: PlayerLevel;
  /** Contexto de juego: frecuencia, lado, tiempo de uso */
  authorContext: string;
  createdAt: string;
}

export interface Editorial {
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

export interface AlternativeRef {
  slug: string;
  /** Por qué es alternativa: "Más control", "Más barata"… */
  reason: string;
}

export interface Pala {
  id: string;
  slug: string;
  brand: Brand;
  model: string;
  year: number;
  images: string[];
  shape: PalaShape;
  /** Gramos */
  weight: { min: number; max: number };
  balance: PalaBalance;
  levels: PlayerLevel[];
  playStyle: PlayStyle;
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
  offers: StoreOffer[];
  previousPrice: number | null;
  priceHistory: PricePoint[];
  /** Características que no cubren los campos estructurados (núcleo, caras, marco…) */
  specs: Spec[];
  faq: FaqItem[];
  alternatives: AlternativeRef[];
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

export interface Guide {
  slug: string;
  title: string;
  subtitle: string;
  image: string | null;
}
