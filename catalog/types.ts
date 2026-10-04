// Formato de intercambio del catálogo enriquecido. Un fichero con esta forma
// (generado fuera del repositorio a partir de las fuentes) es lo que carga
// `npm run catalog:import`. No presupone ninguna fuente concreta: cada
// observación dice de dónde viene.

export type FactKind = "fact" | "declared" | "rating";
export type Confidence = "high" | "medium" | "review";
export type SourceKind = "manufacturer" | "store" | "catalog" | "internal";

export interface ImportSource {
  slug: string;
  name: string;
  kind: SourceKind;
  url: string | null;
}

/** Lo que una fuente dice de un atributo de una pala. */
export interface ImportFact {
  attribute: string;
  /** Valor normalizado, comparable entre fuentes */
  value: string;
  /** Valor tal como lo publica la fuente */
  raw: string | null;
  unit: string | null;
  source: string;
  url: string | null;
  kind: FactKind;
  confidence: Confidence;
  /** Es el valor que se publica para ese atributo */
  selected: boolean;
}

export interface ImportIdentifier {
  type: "gtin" | "manufacturer_ref" | "padelzoom_model_id" | "padelzoom_slug";
  value: string;
  source: string;
}

export interface ImportStoreLink {
  store: string;
  externalId: string;
  confidence: Exclude<Confidence, "review">;
  reason: string;
}

export interface ImportRacket {
  /** Clave estable de la pala en el fichero, para poder repetir la carga */
  key: string;
  /** Slug de una pala que ya existe en PalaRadar y es esta misma; null si es nueva */
  existingSlug: string | null;
  brand: string;
  model: string;
  year: number;
  player: string | null;
  variants: string[];
  /** false: se carga, pero no se ofrece en la web */
  available: boolean;
  unavailableReason: string | null;
  facts: ImportFact[];
  identifiers: ImportIdentifier[];
  content: { source: string; kind: string; body: string; url: string | null; words: number }[];
  media: { source: string; url: string }[];
  legacyUrls: { source: string; path: string }[];
  storeLinks: ImportStoreLink[];
}

export interface CatalogImport {
  generatedAt: string;
  sources: ImportSource[];
  rackets: ImportRacket[];
}
