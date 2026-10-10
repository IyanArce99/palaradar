// Palas guardadas como favoritas. Viven en el navegador (localStorage): no hay
// cuenta ni servidor detrás, y no se guarda nada que identifique a la persona.
// De cada pala se guarda lo justo para enseñarla y para saber si ha bajado
// desde que se guardó: el precio de ese día.

export interface FavoritePala {
  slug: string;
  /** Marca y modelo, para enseñarla aunque no haya conexión */
  name: string;
  /** Precio vigente cuando se guardó; null si entonces no tenía */
  savedPrice: number | null;
  /** Día en que se guardó (YYYY-MM-DD) */
  savedAt: string;
}

/** Tope de favoritas: es una lista de candidatas, no un catálogo paralelo. */
export const MAX_FAVORITES = 30;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const FAVORITES_STORAGE_KEY = "palaradar:favoritas";
/** Parámetro de /api/palas/ con el que se piden los datos de hoy de varias palas */
export const SLUGS_PARAM = "slugs";

/** Slugs válidos y sin repetir de una lista separada por comas, con el tope de favoritas. */
export function parseSlugList(raw: string | null): string[] {
  const slugs = (raw ?? "").split(",").map((slug) => slug.trim()).filter((slug) => SLUG.test(slug));
  return [...new Set(slugs)].slice(0, MAX_FAVORITES);
}

function isFavorite(item: unknown): item is FavoritePala {
  if (typeof item !== "object" || item === null) return false;
  const value = item as Record<string, unknown>;
  return (
    typeof value.slug === "string" &&
    SLUG.test(value.slug) &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    value.name.length <= 120 &&
    (value.savedPrice === null || (typeof value.savedPrice === "number" && Number.isFinite(value.savedPrice) && value.savedPrice > 0)) &&
    typeof value.savedAt === "string" &&
    DAY.test(value.savedAt)
  );
}

/** Lee las favoritas guardadas, descartando lo que no tenga la forma esperada y las repetidas. */
export function parseFavorites(raw: string | null): FavoritePala[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value
      .filter(isFavorite)
      .filter((item) => !seen.has(item.slug) && seen.add(item.slug))
      .map(({ slug, name, savedPrice, savedAt }) => ({ slug, name, savedPrice, savedAt }))
      .slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

/**
 * El día de una fecha en la hora local de quien guarda (YYYY-MM-DD). Con la
 * fecha UTC, una pala guardada pasada la medianoche aparecería como guardada ayer.
 */
export function localDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isFavoritePala(favorites: FavoritePala[], slug: string): boolean {
  return favorites.some((item) => item.slug === slug);
}

/**
 * Añade la pala o, si ya estaba, la quita. La última guardada va primero. Con la
 * lista llena no añade más: devuelve la misma lista.
 */
export function toggleFavorite(favorites: FavoritePala[], pala: FavoritePala): FavoritePala[] {
  if (isFavoritePala(favorites, pala.slug)) return favorites.filter((item) => item.slug !== pala.slug);
  return favorites.length >= MAX_FAVORITES ? favorites : [pala, ...favorites];
}

export interface FavoritePriceChange {
  /** Euros que ha bajado (negativo) o subido (positivo) desde que se guardó */
  difference: number;
  percent: number;
}

/** Cambio de precio desde que se guardó; null si falta alguno de los dos precios o no ha cambiado. */
export function favoritePriceChange(savedPrice: number | null, currentPrice: number | null): FavoritePriceChange | null {
  if (savedPrice === null || currentPrice === null || savedPrice <= 0) return null;
  const difference = Math.round((currentPrice - savedPrice) * 100) / 100;
  if (difference === 0) return null;
  return { difference, percent: Math.round((difference / savedPrice) * 100) };
}
