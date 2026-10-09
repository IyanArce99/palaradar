// Qué fichas de pala merecen indexarse cuando el sitio se abra a los buscadores.
//
// No todas: una ficha con el nombre de la pala, una ilustración y cuatro datos no
// aporta nada que no esté en cualquier otra web, y cientos de páginas así lastran
// al resto. Una ficha es apta si cumple DOS condiciones:
//
//   1. Requisitos (todos): se sabe qué pala es —marca, modelo y año— y tiene su
//      base técnica: peso, núcleo, caras y tacto (o dureza). Sin eso la página no
//      puede describir la pala.
//
//   2. Al menos dos de estos tres pilares, que son lo que la hace útil:
//        · precio  — precio vigente en alguna tienda (uno caducado no cuenta);
//        · foto    — foto real del producto, no una ilustración;
//        · perfil  — para quién es: al menos dos de balance, nivel y estilo de juego.
//
// Así, tener precio no basta (precio sin foto ni perfil no entra), y una pala sin
// precio pero con foto y perfil completos sí entra, como ficha de consulta.
//
// La descripción, «De un vistazo» y las preguntas frecuentes se generan con estos
// mismos datos, así que no se miden aparte: con la base técnica y dos pilares la
// página ya tiene contenido propio.
//
// Esto NO activa nada: mientras NEXT_PUBLIC_ALLOW_INDEXING no valga "true", todo
// el sitio sigue en noindex (ver lib/seo.ts). Solo decide qué fichas entrarán en
// el sitemap y cuáles seguirán en noindex cuando se active.
import { displayValue, isCuratedPair, uniquePairs } from "@/lib/compare";
import { isProductPhoto } from "@/lib/media";
import type { Pala, PalaBalance, PlayerLevel, PlayStyle, Spec } from "@/types/catalog";

/** Lo que se necesita saber de una pala para decidir. Sale igual de la ficha completa que de una fila del catálogo. */
export interface IndexabilitySource {
  brandName: string;
  model: string;
  year: number;
  /** Imagen principal que enseña la ficha: foto real o ilustración */
  image: string | null;
  /** Hay un precio vigente (comprobado y no caducado) en alguna tienda real */
  hasCurrentPrice: boolean;
  /** Hay peso declarado */
  hasWeight: boolean;
  specs: Spec[];
  hardness: string | null;
  balance: PalaBalance | null;
  levels: PlayerLevel[];
  playStyle: PlayStyle | null;
}

export type IndexabilityPillar = "precio" | "foto" | "perfil";

export interface IndexabilityVerdict {
  indexable: boolean;
  /** Pilares que la ficha cumple */
  pillars: IndexabilityPillar[];
  /** Requisitos que le faltan; vacío si los cumple todos */
  missing: string[];
  /** La decisión en una frase, para informes y depuración */
  summary: string;
}

/** Pilares que hacen falta, de los tres */
export const REQUIRED_PILLARS = 2;
/** De balance, nivel y estilo de juego, cuántos hacen falta para dar por completo el perfil */
export const PROFILE_MIN_TRAITS = 2;

function hasSpec(specs: Spec[], label: string): boolean {
  return specs.some((spec) => spec.label === label && displayValue(spec.value) !== null);
}

const hasText = (value: string | null | undefined) => Boolean(value?.trim());

/** Requisitos que le faltan a la ficha: identidad y base técnica. */
function missingRequirements(source: IndexabilitySource): string[] {
  const requirements: [string, boolean][] = [
    ["marca", hasText(source.brandName)],
    ["modelo", hasText(source.model)],
    ["año", Number.isInteger(source.year) && source.year > 0],
    ["peso", source.hasWeight],
    ["núcleo", hasSpec(source.specs, "Núcleo")],
    ["caras", hasSpec(source.specs, "Caras")],
    ["tacto o dureza", hasSpec(source.specs, "Tacto") || displayValue(source.hardness) !== null],
  ];
  return requirements.filter(([, met]) => !met).map(([name]) => name);
}

/** Pilares que la ficha cumple: precio vigente, foto real y perfil de juego. */
function pillarsOf(source: IndexabilitySource): IndexabilityPillar[] {
  const traits = [source.balance !== null, source.levels.length > 0, source.playStyle !== null].filter(Boolean).length;
  const pillars: [IndexabilityPillar, boolean][] = [
    ["precio", source.hasCurrentPrice],
    ["foto", source.image !== null && isProductPhoto(source.image)],
    ["perfil", traits >= PROFILE_MIN_TRAITS],
  ];
  return pillars.filter(([, met]) => met).map(([name]) => name);
}

/** Decide si una ficha es apta para indexarse y explica por qué. */
export function assessIndexability(source: IndexabilitySource): IndexabilityVerdict {
  const missing = missingRequirements(source);
  const pillars = pillarsOf(source);
  const have = pillars.length > 0 ? pillars.join(" y ") : "ninguno";

  if (missing.length > 0) {
    return { indexable: false, pillars, missing, summary: `No apta: le falta ${missing.join(", ")}.` };
  }
  if (pillars.length < REQUIRED_PILLARS) {
    const summary = `No apta: de precio, foto y perfil solo tiene ${have}; hacen falta ${REQUIRED_PILLARS}.`;
    return { indexable: false, pillars, missing, summary };
  }
  return { indexable: true, pillars, missing, summary: `Apta: tiene la base técnica y ${have}.` };
}

/** Los datos de la decisión, a partir de la pala completa de la ficha. */
export function palaIndexabilitySource(pala: Pala): IndexabilitySource {
  return {
    brandName: pala.brand.name,
    model: pala.model,
    year: pala.year,
    image: pala.images[0] ?? null,
    hasCurrentPrice: pala.price !== null && pala.price.freshness !== "stale",
    hasWeight: pala.weight !== null,
    specs: pala.specs,
    hardness: pala.hardness,
    balance: pala.balance,
    levels: pala.levels,
    playStyle: pala.playStyle,
  };
}

/** true si la ficha de esta pala debe indexarse cuando el sitio esté abierto a los buscadores. */
export function isIndexablePala(pala: Pala): boolean {
  return assessIndexability(palaIndexabilitySource(pala)).indexable;
}

// --- Lo que cuelga de las fichas ---------------------------------------------
// Una comparación o una página de marca no pueden valer más que las fichas que
// enseñan: si estas no son aptas, aquellas tampoco se anuncian a los buscadores.

/**
 * Una comparación se indexa solo si es curada (una pala tiene a la otra entre sus
 * «parecidas») y las DOS fichas son aptas: comparar dos fichas pobres da una
 * página igual de pobre.
 */
export function isIndexableComparison(a: Pala, b: Pala): boolean {
  return isCuratedPair(a, b) && isIndexablePala(a) && isIndexablePala(b);
}

/** Una ficha apta, con lo justo para decidir qué más entra en el sitemap */
export interface IndexablePala {
  slug: string;
  brandSlug: string;
}

export interface SitemapSelection {
  /** Fichas aptas */
  palaSlugs: string[];
  /** Marcas con al menos una ficha apta, en el orden recibido */
  brandSlugs: string[];
  /** Comparaciones curadas cuyas dos fichas son aptas, sin repetir y en orden canónico */
  pairs: [string, string][];
}

/**
 * Qué fichas, marcas y comparaciones entran en el sitemap, a partir de las
 * fichas aptas. Una marca entra si tiene al menos una ficha apta; una
 * comparación curada, si lo son sus dos fichas.
 */
export function selectForSitemap(
  indexable: IndexablePala[],
  brandSlugs: string[],
  curatedPairs: [string, string][],
): SitemapSelection {
  const palas = new Set(indexable.map((pala) => pala.slug));
  const brands = new Set(indexable.map((pala) => pala.brandSlug));

  return {
    palaSlugs: indexable.map((pala) => pala.slug),
    brandSlugs: brandSlugs.filter((slug) => brands.has(slug)),
    pairs: uniquePairs(curatedPairs).filter(([a, b]) => palas.has(a) && palas.has(b)),
  };
}
