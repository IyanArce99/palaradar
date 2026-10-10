// Sugerencias de emparejamiento para la cola de revisión: dado un producto de una
// tienda, qué palas del catálogo podrían ser y por qué. Es una ayuda para quien
// revisa, NO una decisión: aquí no se confirma nada ni se escribe nada. Las
// reglas que sí emparejan solas están en ingestion/matcher.ts y no cambian.
//
// La puntuación es una suma de señales con nombre, para que cada sugerencia se
// pueda leer: nombre parecido, mismo año, misma variante, EAN que coincide o que
// contradice.
import { normalizeGtin } from "@/ingestion/gtin";
import { isBundleOrUsed, isPack, normalizeBrand, normalizeText, parseTitle } from "@/ingestion/title";
import { SHAPE_LABELS } from "@/lib/labels";
import { attributesInTitle } from "@/lib/vocabulary";
import type { PalaShape } from "@/types/catalog";

export interface PendingProduct {
  title: string;
  /** Marca que declara la tienda, si la declara */
  brand: string | null;
  /** EAN tal y como lo publica la tienda */
  gtin: string | null;
}

export interface CatalogCandidate {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number;
  shape: PalaShape;
  /** EAN conocidos de la pala, normalizados a 14 dígitos */
  gtins: string[];
}

/** Puntos de cada señal. La suma se limita a 0–100. */
export const MATCH_WEIGHTS = {
  /** Todas las palabras del modelo coinciden (proporcional si coinciden solo algunas) */
  name: 55,
  sameYear: 20,
  sameVariant: 15,
  gtinMatch: 100,
  /** Penalizaciones: contradicen la sugerencia */
  otherYear: -35,
  otherVariant: -35,
  otherGtin: -50,
  otherShape: -15,
} as const;

export type MatchConfidence = "alta" | "media" | "baja";

export interface MatchSuggestion {
  candidate: CatalogCandidate;
  /** De 0 a 100 */
  score: number;
  /** Parecido de los nombres, de 0 a 1 (palabras en común sobre palabras totales) */
  nameSimilarity: number;
  confidence: MatchConfidence;
  /** Lo que apoya la sugerencia */
  reasons: string[];
  /** Lo que la contradice o no se ha podido comprobar */
  differences: string[];
  gtinMatches: boolean;
}

export interface MatchReview {
  suggestions: MatchSuggestion[];
  /** Por qué necesita a una persona: nunca se confirma solo */
  verdict: string;
  /** true si las dos primeras sugerencias quedan demasiado cerca para elegir sin mirar */
  ambiguous: boolean;
}

/** Diferencia de puntos por debajo de la cual dos sugerencias no se distinguen */
export const AMBIGUITY_MARGIN = 10;
const MIN_SCORE = 20;

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const shared = [...a].filter((item) => b.has(item)).length;
  return shared / (a.size + b.size - shared);
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((item) => b.has(item));
const listOf = (set: Set<string>) => [...set].sort((a, b) => a.localeCompare(b)).join(", ") || "ninguna";

/** Marca del producto: la que declara la tienda o, si falta, la que aparezca en el título. */
function resolveBrand(product: PendingProduct, catalog: CatalogCandidate[]): string | null {
  if (product.brand) return normalizeBrand(product.brand);
  const title = normalizeText(product.title).replace(/[^a-z0-9]+/g, "");
  const brands = [...new Set(catalog.map((racket) => normalizeBrand(racket.brand)))].sort((a, b) => b.length - a.length);
  return brands.find((brand) => brand !== "" && title.includes(brand)) ?? null;
}

function confidenceOf(suggestion: Omit<MatchSuggestion, "confidence">, exactName: boolean, sameYear: boolean, sameVariant: boolean): MatchConfidence {
  if (suggestion.differences.some((text) => text.startsWith("EAN distinto"))) return "baja";
  if (suggestion.gtinMatches) return "alta";
  // Una palabra que sobra o que falta («Youth», «Reserve», «Pro») puede ser otra edición:
  // sin EAN que lo aclare, un nombre que no coincide entero nunca pasa de confianza baja.
  if (!exactName) return "baja";
  if (sameYear && sameVariant) return "alta";
  return suggestion.score >= 60 && sameVariant ? "media" : "baja";
}

const quoted = (items: string[]) => items.map((item) => `«${item}»`).join(", ");

/**
 * Palas del catálogo que podrían corresponder a un producto de tienda, de más a
 * menos probable. Solo de la misma marca (o de la que coincide en EAN).
 */
export function suggestMatches(product: PendingProduct, catalog: CatalogCandidate[], limit = 3): MatchReview {
  const gtin = normalizeGtin(product.gtin);
  const brand = resolveBrand(product, catalog);
  const titleShape = attributesInTitle(product.title).shape;

  const pool = catalog.filter(
    (racket) => (brand !== null && normalizeBrand(racket.brand) === brand) || (gtin !== null && racket.gtins.includes(gtin)),
  );
  const spellings = [product.brand, ...new Set(pool.map((racket) => racket.brand))];
  const parsed = parseTitle(product.title, spellings);

  const ranked = pool
    .map((candidate): MatchSuggestion | null => {
      // El nombre del modelo no lleva año: un número suyo es parte del nombre.
      const model = parseTitle(candidate.model, spellings, { years: false });
      const nameSimilarity = jaccard(parsed.tokens, model.tokens);
      const gtinMatches = gtin !== null && candidate.gtins.includes(gtin);
      if (nameSimilarity === 0 && !gtinMatches) return null;

      const reasons: string[] = [];
      const differences: string[] = [];
      let score = Math.round(nameSimilarity * MATCH_WEIGHTS.name);
      reasons.push(
        nameSimilarity === 1
          ? "El nombre del modelo coincide palabra por palabra."
          : `Comparte ${Math.round(nameSimilarity * 100)} % de las palabras del nombre.`,
      );
      // Qué palabras no cuadran, en los dos sentidos: son las que pueden nombrar otra edición.
      const extra = [...parsed.tokens].filter((token) => !model.tokens.has(token)).sort((a, b) => a.localeCompare(b));
      const absent = [...model.tokens].filter((token) => !parsed.tokens.has(token)).sort((a, b) => a.localeCompare(b));
      if (extra.length > 0) {
        differences.push(`El título tiene palabras que el modelo no tiene (${quoted(extra)}): puede ser otra edición o variante.`);
      }
      if (absent.length > 0) {
        differences.push(`Al título le faltan palabras del modelo (${quoted(absent)}): puede ser otra edición o variante.`);
      }

      // La marca que declara la tienda frente a la de la pala: con el EAN se puede caer en otra marca.
      const otherBrand = product.brand !== null && normalizeBrand(product.brand) !== normalizeBrand(candidate.brand);
      if (otherBrand) {
        differences.push(`La tienda declara la marca «${product.brand}» y la pala es de ${candidate.brand}.`);
      }

      if (gtinMatches) {
        score += MATCH_WEIGHTS.gtinMatch;
        reasons.push("El EAN del producto es uno de los de esta pala.");
      } else if (gtin !== null && candidate.gtins.length > 0) {
        score += MATCH_WEIGHTS.otherGtin;
        differences.push("EAN distinto al de la pala del catálogo: puede ser otro color u otra edición.");
      } else if (gtin !== null) {
        differences.push("La pala del catálogo no tiene EAN guardado: el del producto no se puede contrastar.");
      } else {
        differences.push("La tienda no publica el EAN: no se puede confirmar por código de barras.");
      }

      const sameYear = parsed.year !== null && parsed.year === candidate.year;
      if (sameYear) {
        score += MATCH_WEIGHTS.sameYear;
        reasons.push(`Mismo año: ${candidate.year}.`);
      } else if (parsed.year === null) {
        differences.push(`El título no indica el año; la pala del catálogo es de ${candidate.year}.`);
      } else {
        score += MATCH_WEIGHTS.otherYear;
        differences.push(`Año distinto: el título dice ${parsed.year} y la pala es de ${candidate.year}.`);
      }

      const sameVariant = sameSet(parsed.variants, model.variants);
      if (sameVariant) {
        score += MATCH_WEIGHTS.sameVariant;
        if (parsed.variants.size > 0) reasons.push(`Misma variante: ${listOf(parsed.variants)}.`);
      } else {
        score += MATCH_WEIGHTS.otherVariant;
        differences.push(`Variante distinta: el título dice «${listOf(parsed.variants)}» y la pala «${listOf(model.variants)}».`);
      }

      if (titleShape !== null && titleShape !== candidate.shape) {
        score += MATCH_WEIGHTS.otherShape;
        differences.push(
          `El título habla de forma ${SHAPE_LABELS[titleShape].toLowerCase()} y la pala es ${SHAPE_LABELS[candidate.shape].toLowerCase()}.`,
        );
      }

      const base = { candidate, score: Math.max(0, Math.min(100, score)), nameSimilarity, reasons, differences, gtinMatches };
      const confidence = confidenceOf(base, nameSimilarity === 1, sameYear, sameVariant);
      // Una marca que no cuadra no se zanja sola, ni con EAN: como mucho, confianza media.
      return { ...base, confidence: otherBrand && confidence === "alta" ? "media" : confidence };
    })
    .filter((suggestion): suggestion is MatchSuggestion => suggestion !== null && suggestion.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.candidate.slug.localeCompare(b.candidate.slug));

  // El empate se mira antes de recortar la lista: con `limit` 1 también existe.
  const [first, second] = ranked;
  const ambiguous = Boolean(first && second && first.score - second.score < AMBIGUITY_MARGIN);

  // Un empate no tiene ganador: el orden de la lista no es una razón para preferir una
  // pala. Las que quedan igual de cerca pierden la confianza alta y dicen con cuál empatan.
  if (ambiguous) {
    const tied = ranked.filter((item) => first.score - item.score < AMBIGUITY_MARGIN);
    for (const item of tied) {
      const others = tied.filter((other) => other !== item).map((other) => other.candidate.slug);
      item.differences.push(`Otra pala del catálogo queda igual de cerca (${others.join(", ")}): no hay evidencia para elegir entre ellas.`);
      if (item.confidence === "alta") item.confidence = "media";
    }
  }
  const suggestions = ranked.slice(0, limit);

  let verdict = "Revisar: la sugerencia es una ayuda, no una confirmación.";
  if (isPack(product.title)) verdict = "Pack: no es una pala suelta comparable.";
  else if (isBundleOrUsed(product.title)) verdict = "Accesorio, pala de test, outlet o de segunda mano: no es una pala suelta comparable.";
  else if (brand === null && !first) verdict = "Sin marca reconocible: no hay con qué compararlo.";
  else if (!first) verdict = "Ninguna pala del catálogo se parece: probablemente falta su ficha.";
  else if (ambiguous) verdict = "Varias palas quedan igual de cerca: hay que distinguirlas a mano.";
  else if (first.confidence === "alta") verdict = "Coincidencia clara, pendiente de que alguien la confirme.";

  return { suggestions, verdict, ambiguous };
}
