import { normalizeGtin } from "./gtin";
import { isBundleOrUsed, isPack, normalizeBrand, normalizeText, parseTitle } from "./title";
import type { CatalogRacket, MatchResult, StoreListing } from "./types";

// Reglas de emparejamiento (docs/price-ingestion.md):
//   1. Mismo EAN y misma marca                         → automático
//   2. Marca, modelo, variante y año iguales           → automático solo con un único candidato
//   3. Coincidencia ambigua                            → revisión manual
//   Vetos: EAN distinto, año distinto o variante distinta → nunca se empareja
//   Packs inequívocos («pack», «+ paletero», «x2») → rechazados con motivo «Pack»: nunca
//   serán una pala suelta y no deben ocupar la cola de revisión.
//   Nunca automático (revisión): accesorios, palas de prueba, outlet o de segunda mano.
//
// Lo que un emparejamiento automático NO hace:
//   · fiarse de un EAN que no supera el dígito de control (se avisa y se va por nombre);
//   · dar por buena, con un EAN que el catálogo no conoce, la pala sin EAN que queda
//     cuando las de su misma edición se han descartado por EAN: puede ser otro color;
//   · leer un número de dos cifras del nombre del modelo como si fuera el año.
//
// Colores y variantes: cada EAN es una pala distinta y nunca se fusionan aquí.
// Si algún día se agrupan (una «familia» de producto con varios colores), será
// un concepto por encima de `rackets` —p. ej. rackets.family_id—, sin cambiar
// estas reglas: el emparejamiento seguirá siendo producto de tienda → pala exacta.

type Listing = Pick<StoreListing, "title" | "brand" | "ean">;

export const PACK_NOTE = "Pack: agrupa una pala con otros productos (o varias palas) y no es comparable con una pala suelta.";
export const BUNDLE_NOTE = "Accesorio, pala de test, outlet o de segunda mano: no es una pala suelta comparable.";
export const INVALID_EAN_NOTE = "El EAN que publica la tienda no es válido (dígito de control): emparejado solo por nombre.";
export const UNKNOWN_EAN_NOTE =
  "El EAN del producto no es el de la edición conocida de este modelo: la pala sin EAN del catálogo puede ser otro color u otra edición.";
export const AMBIGUOUS_NOTE = "Varias palas del catálogo podrían coincidir.";
export const NO_YEAR_NOTE = "El título no indica el año.";

const matched = (racketId: string, method: "gtin" | "attributes", note: string | null = null): MatchResult => ({
  status: "matched",
  racketId,
  method,
  note,
});
const pending = (note: string, candidates: string[]): MatchResult => ({
  status: "pending_review",
  racketId: null,
  method: null,
  note,
  candidates,
});
const rejected = (note: string): MatchResult => ({
  status: "rejected",
  racketId: null,
  method: null,
  note,
});

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((item) => b.has(item));
}

/** Dos nombres se parecen si uno contiene todas las palabras del otro. */
function isRelated(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  return [...small].every((item) => large.has(item));
}

/** Parecido de dos nombres, de 0 a 1: palabras en común sobre palabras totales. */
function similarity(a: Set<string>, b: Set<string>): number {
  const shared = [...a].filter((item) => b.has(item)).length;
  const total = a.size + b.size - shared;
  return total === 0 ? 0 : shared / total;
}

/**
 * Marca del listado: la que declara la tienda o, si falta, la que aparezca en el
 * título. Se prueban primero las marcas más largas, para que «Black Crown» gane
 * a «Crown» y el resultado no dependa del orden en que llegue el catálogo.
 */
function resolveBrand(listing: Listing, catalog: CatalogRacket[]): string | null {
  if (listing.brand) return normalizeBrand(listing.brand);

  // Sin espacios, para encontrar la marca venga junta o separada en el título.
  const title = normalizeText(listing.title).replace(/[^a-z0-9]+/g, "");
  const brands = [...new Set(catalog.map((racket) => normalizeBrand(racket.brand)))]
    .filter((brand) => brand !== "")
    .sort((a, b) => b.length - a.length || a.localeCompare(b));
  return brands.find((brand) => title.includes(brand)) ?? null;
}

/** true si la tienda publica un EAN que no supera el dígito de control. */
export function hasInvalidEan(listing: Pick<Listing, "ean">): boolean {
  return listing.ean !== null && listing.ean.trim() !== "" && normalizeGtin(listing.ean) === null;
}

export function matchProduct(listing: Listing, catalog: CatalogRacket[]): MatchResult {
  // Un pack nunca es la pala suelta, diga lo que diga su EAN: se rechaza con su motivo
  // y no entra en la cola de revisión, que es para dudas de identidad.
  if (isPack(listing.title)) return rejected(PACK_NOTE);

  const gtin = normalizeGtin(listing.ean);
  const invalidEan = hasInvalidEan(listing);
  const brand = resolveBrand(listing, catalog);
  const neverAutomatic = isBundleOrUsed(listing.title);

  // 1. EAN
  if (gtin) {
    const owner = catalog.find((racket) => racket.gtins.includes(gtin));
    if (owner) {
      if (brand && brand !== normalizeBrand(owner.brand)) {
        return pending("El EAN pertenece a una pala de otra marca.", [owner.id]);
      }
      if (neverAutomatic) return pending(BUNDLE_NOTE, [owner.id]);
      return matched(owner.id, "gtin");
    }
  }

  // 2. Marca + modelo + variante + año
  if (!brand) return rejected("Sin marca reconocible.");

  const sameBrand = catalog.filter((racket) => normalizeBrand(racket.brand) === brand);
  // Todas las formas en que puede aparecer la marca en el título: la de la tienda y la nuestra.
  const brandSpellings = [listing.brand, ...new Set(sameBrand.map((racket) => racket.brand))];
  const parsed = parseTitle(listing.title, brandSpellings);
  const exact: CatalogRacket[] = [];
  const similar: CatalogRacket[] = [];
  const vetoes: { note: string; similarity: number }[] = [];
  let eanVetoes = 0;

  for (const racket of sameBrand) {
    // El nombre del modelo no lleva año: un número suyo («Vertex 23») es parte del nombre.
    const model = parseTitle(racket.model, brandSpellings, { years: false });
    if (!isRelated(parsed.tokens, model.tokens)) continue;
    const alike = similarity(parsed.tokens, model.tokens);

    // Vetos: prevalecen sobre cualquier parecido del nombre.
    if (gtin && racket.gtins.length > 0) {
      vetoes.push({ note: "EAN distinto al de la pala del catálogo.", similarity: alike });
      eanVetoes++;
    } else if (parsed.year !== null && parsed.year !== racket.year) {
      vetoes.push({ note: "Año distinto.", similarity: alike });
    } else if (!sameSet(parsed.variants, model.variants)) {
      vetoes.push({ note: "Variante distinta.", similarity: alike });
    } else if (parsed.year !== null && sameSet(parsed.tokens, model.tokens)) {
      exact.push(racket);
    } else {
      similar.push(racket);
    }
  }

  const candidates = [...exact, ...similar];
  const ids = candidates.map((racket) => racket.id);

  // Un accesorio o una pala usada de un modelo que está en el catálogo es trabajo
  // de revisión; si no hay nada parecido, no hay nada que revisar.
  if (neverAutomatic) {
    return ids.length > 0 || vetoes.length > 0 ? pending(BUNDLE_NOTE, ids) : rejected(`${BUNDLE_NOTE} Sin equivalente en el catálogo.`);
  }

  if (candidates.length === 0) {
    // El motivo es el veto de la pala más parecida, no el de la primera que llegó.
    const closest = [...vetoes].sort((a, b) => b.similarity - a.similarity)[0];
    return rejected(closest?.note ?? "Sin equivalente en el catálogo.");
  }

  if (exact.length === 1 && candidates.length === 1) {
    const [racket] = exact;
    // El EAN no es el de las ediciones conocidas y la única pala que queda no tiene EAN:
    // puede ser otro color de la misma edición, y eso no se decide por el nombre.
    if (gtin && racket.gtins.length === 0 && eanVetoes > 0) return pending(UNKNOWN_EAN_NOTE, ids);
    return matched(racket.id, "attributes", invalidEan ? INVALID_EAN_NOTE : null);
  }

  // 3. Ambigua
  if (candidates.length > 1) return pending(AMBIGUOUS_NOTE, ids);
  if (parsed.year === null) return pending(NO_YEAR_NOTE, ids);
  return pending("El nombre se parece al de una pala del catálogo, pero no coincide.", ids);
}
