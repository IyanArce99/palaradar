// Comparador de dos palas: URLs, filas enfrentadas y diferencias. Todo sale de
// atributos declarados de cada pala y de sus precios actuales; aquí no hay
// puntuaciones ni juicios («más potente», «mejor»).
import { formatWeight } from "@/lib/format";
import {
  BALANCE_LABELS,
  formatLevels,
  LEVEL_LABELS,
  SHAPE_LABELS,
  STYLE_LABELS,
} from "@/lib/labels";
import { routes } from "@/lib/routes";
import type { Pala } from "@/types/catalog";
import type { PriceSummary } from "@/types/pricing";

const SEPARATOR = "-vs-";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Días de histórico que debe tener cada pala para enseñar su evolución */
export const MIN_HISTORY_DAYS = 14;

/** Parámetros de la pantalla de selección */
export const COMPARE_PARAMS = { a: "a", b: "b", searchA: "qa", searchB: "qb" } as const;

export type CompareSlotId = "a" | "b";

/** El par en su orden canónico: alfabético por slug. */
export function canonicalPair(a: string, b: string): [string, string] {
  return a.localeCompare(b, "en") <= 0 ? [a, b] : [b, a];
}

/** URL de la comparación, siempre en orden canónico. */
export function comparePath(a: string, b: string): string {
  const [first, second] = canonicalPair(a, b);
  return `${routes.compare}${first}${SEPARATOR}${second}/`;
}

/** URL de la pantalla de selección con las palas ya elegidas. */
export function compareSelectPath(selection: { a?: string | null; b?: string | null } = {}): string {
  const params = new URLSearchParams();
  if (selection.a) params.set(COMPARE_PARAMS.a, selection.a);
  if (selection.b) params.set(COMPARE_PARAMS.b, selection.b);
  const qs = params.toString();
  return qs ? `${routes.compare}?${qs}` : routes.compare;
}

export type PairResolution =
  /** No es «slug-vs-slug» */
  | { type: "invalid" }
  /** La misma pala dos veces: no hay nada que comparar */
  | { type: "same"; slug: string }
  /** Par válido en orden no canónico */
  | { type: "reorder"; path: string }
  | { type: "ok"; a: string; b: string };

/**
 * Lee el segmento «a-vs-b» de la URL. Ningún slug del catálogo contiene «-vs-»,
 * así que el separador solo puede aparecer una vez.
 */
export function resolvePair(segment: string): PairResolution {
  const parts = segment.split(SEPARATOR);
  if (parts.length !== 2) return { type: "invalid" };

  const [a, b] = parts;
  if (!SLUG.test(a) || !SLUG.test(b)) return { type: "invalid" };
  if (a === b) return { type: "same", slug: a };

  const [first] = canonicalPair(a, b);
  return first === a ? { type: "ok", a, b } : { type: "reorder", path: comparePath(a, b) };
}

/** Clave de un par sin orden, para buscarlo entre los curados. */
function pairKey(a: string, b: string): string {
  return canonicalPair(a, b).join(SEPARATOR);
}

/** Pares curados sin repetir, cada uno en orden canónico. */
export function uniquePairs(pairs: [string, string][]): [string, string][] {
  const byKey = new Map(pairs.map(([a, b]) => [pairKey(a, b), canonicalPair(a, b)]));
  return [...byKey.values()].sort((x, y) => pairKey(...x).localeCompare(pairKey(...y), "en"));
}

/**
 * Comparación curada: una de las dos palas tiene a la otra entre sus «parecidas».
 * Solo estas comparaciones son indexables y entran en el sitemap.
 */
export function isCuratedPair(a: Pala, b: Pala): boolean {
  return (
    a.alternatives.some(({ pala }) => pala.slug === b.slug) ||
    b.alternatives.some(({ pala }) => pala.slug === a.slug)
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Presentación de un valor declarado: «arenosa» → «Arenosa», «Dura, Media» →
 * «Dura / Media». Solo cambia cómo se muestra; el dato guardado no se toca.
 */
export function displayValue(raw: string | null | undefined): string | null {
  const parts = (raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(capitalize);
  return parts.length > 0 ? parts.join(" / ") : null;
}

export interface CompareRow {
  label: string;
  /** null: esa pala no declara el atributo («Sin datos») */
  a: string | null;
  b: string | null;
}

function specValue(pala: Pala, label: string): string | null {
  return displayValue(pala.specs.find((spec) => spec.label === label)?.value);
}

/** Atributos de una pala, en el orden en que se enfrentan. */
function attributes(pala: Pala): [string, string | null][] {
  return [
    ["Forma", SHAPE_LABELS[pala.shape]],
    ["Balance", pala.balance ? BALANCE_LABELS[pala.balance] : null],
    ["Peso", pala.weight ? formatWeight(pala.weight) : null],
    ["Nivel", pala.levels.length > 0 ? formatLevels(pala.levels) : null],
    ["Estilo de juego", pala.playStyle ? STYLE_LABELS[pala.playStyle] : null],
    ["Superficie", specValue(pala, "Superficie")],
    ["Dureza", displayValue(pala.hardness)],
    ["Acabado", specValue(pala, "Acabado")],
    ["Grosor", specValue(pala, "Grosor")],
    ["Caras", specValue(pala, "Caras")],
    ["Núcleo", specValue(pala, "Núcleo")],
    ["Marco", specValue(pala, "Marco")],
    ["Tacto", specValue(pala, "Tacto")],
    ["Jugador", displayValue(pala.player)],
    ["Año", String(pala.year)],
  ];
}

/** Filas enfrentadas: se omite la que ninguna de las dos palas declara. */
export function buildCompareRows(a: Pala, b: Pala): CompareRow[] {
  const right = attributes(b);
  return attributes(a)
    .map(([label, value], i) => ({ label, a: value, b: right[i][1] }))
    .filter((row) => row.a !== null || row.b !== null);
}

/** Rótulo del precio, con la misma lectura de frescura que la ficha. */
export function priceHeading(price: PriceSummary | null): string {
  if (!price) return "Sin precio ahora mismo";
  return price.freshness === "current" ? "Mejor precio hoy" : "Último precio conocido";
}

export interface PriceDifference {
  /** null si cuestan lo mismo */
  cheaper: CompareSlotId | null;
  amount: number;
}

/**
 * Diferencia entre los mejores precios, solo si los dos están vigentes. Un
 * precio caducado no se compara como si fuera actual.
 */
export function priceDifference(a: Pala, b: Pala): PriceDifference | null {
  if (!a.price || !b.price) return null;
  if (a.price.freshness === "stale" || b.price.freshness === "stale") return null;

  const amount = Math.round(Math.abs(a.price.current - b.price.current) * 100) / 100;
  if (amount === 0) return { cheaper: null, amount: 0 };
  return { cheaper: a.price.current < b.price.current ? "a" : "b", amount };
}

/** true si la pala tiene días de histórico suficientes para enseñar su evolución. */
export function hasEnoughHistory(pala: Pala): boolean {
  return pala.price !== null && pala.priceHistory.length >= MIN_HISTORY_DAYS;
}

/** Filas de materiales y construcción que entran en «En qué se diferencian» */
const CONSTRUCTION_LABELS = ["Superficie", "Dureza", "Acabado", "Grosor", "Caras", "Núcleo", "Marco", "Tacto"];

function shapeAndBalance(pala: Pala): string {
  const shape = `forma ${SHAPE_LABELS[pala.shape].toLowerCase()}`;
  return pala.balance ? `${shape} y balance ${BALANCE_LABELS[pala.balance].toLowerCase()}` : shape;
}

/**
 * Diferencia mínima de peso que se menciona (gramos): por debajo, la separación
 * entre los puntos medios de dos rangos no dice nada.
 */
const MIN_WEIGHT_DIFFERENCE = 5;

/** «avanzado y competición» */
function levelList(pala: Pala): string {
  return pala.levels.map((level) => LEVEL_LABELS[level].toLowerCase()).join(" y ");
}

function weightMiddle(pala: Pala): number | null {
  return pala.weight ? (pala.weight.min + pala.weight.max) / 2 : null;
}

/**
 * «En qué se diferencian», en frases: solo forma, balance, peso, estilo y nivel
 * declarados. Describe; no valora ni recomienda.
 */
export function describeDifferences(a: Pala, b: Pala): string[] {
  const sentences: string[] = [];

  const weightA = weightMiddle(a);
  const weightB = weightMiddle(b);
  const grams = weightA !== null && weightB !== null ? Math.round(Math.abs(weightA - weightB)) : 0;
  // El peso se declara a menudo como rango: se compara su punto medio.
  const exact = a.weight?.min === a.weight?.max && b.weight?.min === b.weight?.max;
  const weightNote =
    grams >= MIN_WEIGHT_DIFFERENCE && weightA !== null && weightB !== null
      ? ` y pesa ${exact ? "" : "de media "}${grams} g ${weightB < weightA ? "menos" : "más"}`
      : "";

  if (a.shape === b.shape && a.balance === b.balance) {
    sentences.push(`Las dos tienen ${shapeAndBalance(a)}.`);
    if (weightNote) sentences.push(`La ${b.model}${weightNote.replace(" y pesa", " pesa")}.`);
  } else {
    sentences.push(`La ${a.model} tiene ${shapeAndBalance(a)}.`);
    sentences.push(`La ${b.model} tiene ${shapeAndBalance(b)}${weightNote}.`);
  }

  if (a.playStyle && b.playStyle && a.playStyle !== b.playStyle) {
    sentences.push(
      `El estilo de juego declarado de la ${a.model} es ${STYLE_LABELS[a.playStyle].toLowerCase()}; el de la ${b.model}, ${STYLE_LABELS[b.playStyle].toLowerCase()}.`,
    );
  }

  const levelsA = levelList(a);
  const levelsB = levelList(b);
  if (levelsA && levelsB && levelsA !== levelsB) {
    sentences.push(
      `El nivel declarado de la ${a.model} es ${levelsA}; el de la ${b.model}, ${levelsB}.`,
    );
  }

  // Materiales y construcción: solo los que las dos declaran y no coinciden.
  const construction = buildCompareRows(a, b)
    .filter((row) => CONSTRUCTION_LABELS.includes(row.label))
    .filter((row) => row.a !== null && row.b !== null && row.a !== row.b)
    .map((row) => `${row.label.toLowerCase()} (${row.a} en la ${a.model}, ${row.b} en la ${b.model})`);
  if (construction.length > 0) {
    sentences.push(`También cambian: ${construction.join("; ")}.`);
  }

  return sentences;
}

/** Forma, balance y peso de una pala en una frase corta, para la descripción SEO. */
export function summarize(pala: Pala): string {
  const weight = pala.weight ? `, ${formatWeight(pala.weight)}` : "";
  return `${pala.brand.name} ${pala.model}: ${shapeAndBalance(pala)}${weight}`;
}
