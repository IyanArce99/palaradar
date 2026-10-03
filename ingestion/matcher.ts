import { normalizeGtin } from "./gtin";
import { isBundleOrUsed, normalizeBrand, normalizeText, parseTitle } from "./title";
import type { CatalogRacket, MatchResult, StoreListing } from "./types";

// Reglas de emparejamiento (docs/price-ingestion.md):
//   1. Mismo EAN y misma marca                         → automático
//   2. Marca, modelo, variante y año iguales           → automático solo con un único candidato
//   3. Coincidencia ambigua                            → revisión manual
//   Vetos: EAN distinto, año distinto o variante distinta → nunca se empareja

type Listing = Pick<StoreListing, "title" | "brand" | "ean">;

const matched = (racketId: string, method: "gtin" | "attributes"): MatchResult => ({
  status: "matched",
  racketId,
  method,
  note: null,
});
const pending = (note: string): MatchResult => ({
  status: "pending_review",
  racketId: null,
  method: null,
  note,
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

/** Marca del listado: la que declara la tienda o, si falta, la que aparezca en el título. */
function resolveBrand(listing: Listing, catalog: CatalogRacket[]): string | null {
  if (listing.brand) return normalizeBrand(listing.brand);

  // Sin espacios, para encontrar la marca venga junta o separada en el título.
  const title = normalizeText(listing.title).replace(/[^a-z0-9]+/g, "");
  const brands = new Set(catalog.map((racket) => normalizeBrand(racket.brand)));
  return [...brands].find((brand) => title.includes(brand)) ?? null;
}

export function matchProduct(listing: Listing, catalog: CatalogRacket[]): MatchResult {
  const gtin = normalizeGtin(listing.ean);
  const brand = resolveBrand(listing, catalog);
  const neverAutomatic = isBundleOrUsed(listing.title);

  // 1. EAN
  if (gtin) {
    const owner = catalog.find((racket) => racket.gtins.includes(gtin));
    if (owner) {
      if (brand && brand !== normalizeBrand(owner.brand)) {
        return pending("El EAN pertenece a una pala de otra marca.");
      }
      if (neverAutomatic) return pending("Pack, pala de test o de segunda mano.");
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
  const vetoes: string[] = [];

  for (const racket of sameBrand) {
    const model = parseTitle(racket.model, brandSpellings);
    if (!isRelated(parsed.tokens, model.tokens)) continue;

    // Vetos: prevalecen sobre cualquier parecido del nombre.
    if (gtin && racket.gtins.length > 0) {
      vetoes.push("EAN distinto al de la pala del catálogo.");
    } else if (parsed.year !== null && parsed.year !== racket.year) {
      vetoes.push("Año distinto.");
    } else if (!sameSet(parsed.variants, model.variants)) {
      vetoes.push("Variante distinta.");
    } else if (parsed.year !== null && sameSet(parsed.tokens, model.tokens)) {
      exact.push(racket);
    } else {
      similar.push(racket);
    }
  }

  const candidates = exact.length + similar.length;

  if (candidates === 0) return rejected(vetoes[0] ?? "Sin equivalente en el catálogo.");
  if (neverAutomatic) return pending("Pack, pala de test o de segunda mano.");
  if (exact.length === 1 && candidates === 1) return matched(exact[0].id, "attributes");

  // 3. Ambigua
  if (candidates > 1) return pending("Varias palas del catálogo podrían coincidir.");
  if (parsed.year === null) return pending("El título no indica el año.");
  return pending("El nombre se parece al de una pala del catálogo, pero no coincide.");
}
