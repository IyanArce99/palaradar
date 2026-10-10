// Alternativas a una pala: «¿buscas algo parecido, pero más barato o con otras
// características?». Es una puntuación determinista sobre datos declarados y el
// precio vigente; no hay valoración detrás ni se rellenan datos que faltan:
//   · cada modo descarta primero las palas que no cumplen su requisito;
//   · el parecido suma por cada atributo que las dos palas declaran y coincide;
//   · un atributo que la candidata no declara resta: no se supone que coincide;
//   · de cada alternativa se dice en qué coincide, en qué cambia y qué no se sabe.
// La usan la ficha y cualquier otra pantalla que proponga alternativas.
import { formatEuroCompact, formatWeight } from "@/lib/format";
import { BALANCE_LABELS, SHAPE_LABELS, STYLE_LABELS } from "@/lib/labels";
import { canonicalTouch } from "@/lib/vocabulary";
import type { Pala, PalaBalance, PalaShape, PalaSummary, PlayerLevel, PlayStyle } from "@/types/catalog";

/** Lo que se compara de una pala, además de su precio */
export interface AlternativeTraits {
  shape: PalaShape;
  balance: PalaBalance | null;
  playStyle: PlayStyle | null;
  levels: PlayerLevel[];
  /** Gramos declarados */
  weight: { min: number; max: number } | null;
  /** Tacto declarado o, si no lo hay, dureza declarada */
  touch: string | null;
}

/** Pala a la venta que puede proponerse como alternativa */
export interface AlternativeCandidate extends AlternativeTraits {
  pala: PalaSummary;
}

/** La pala de la ficha */
export interface AlternativeTarget extends AlternativeTraits {
  id: string;
  brandSlug: string;
  year: number;
  /** Precio vigente; null si ahora no tiene */
  price: number | null;
}

/**
 * Tacto con el que se compara una pala: el que declara o, si no declara ninguno,
 * su dureza; siempre el dato en bruto. La pala de la ficha y las candidatas deben
 * pasar por aquí para que el mismo dato no salga como diferencia.
 */
export function rawTouch(pala: { specs: { label: string; value: string }[]; hardness: string | null }): string | null {
  const touch = pala.specs.find((spec) => spec.label === "Tacto")?.value;
  return touch?.trim() || pala.hardness?.trim() || null;
}

export type AlternativeTrait ="shape" | "balance" | "style" | "level" | "touch" | "weight";

/** Peso de cada coincidencia en el parecido. La forma es lo que más define una pala. */
export const TRAIT_WEIGHTS: Record<AlternativeTrait, number> = {
  shape: 3,
  balance: 2,
  style: 2,
  level: 2,
  touch: 1,
  weight: 1,
};

/** Lo que resta un atributo que la candidata no declara */
export const UNKNOWN_PENALTY = 0.5;
/** Dos pesos se consideran iguales si sus puntos medios distan esto o menos (gramos) */
export const WEIGHT_TOLERANCE = 7;
/** «Más barata»: al menos este ahorro sobre el precio de la pala de la ficha */
export const MIN_SAVING_RATIO = 0.05;
/** Presupuestos que se ofrecen como modo, en euros */
export const BUDGETS = [100, 150, 200] as const;

export interface Similarity {
  score: number;
  shared: AlternativeTrait[];
  different: AlternativeTrait[];
  /** Atributos que la pala de la ficha declara y la candidata no */
  unknown: AlternativeTrait[];
}

// El tacto y la dureza se comparan con el vocabulario común (lib/vocabulary.ts).
export { canonicalTouch };
const clean = canonicalTouch;
const middle = (weight: { min: number; max: number }) => (weight.min + weight.max) / 2;

/** Estado de cada atributo: null si la pala de la ficha no lo declara (no se compara). */
function traitState(
  trait: AlternativeTrait,
  target: AlternativeTraits,
  candidate: AlternativeTraits,
): "shared" | "different" | "unknown" | null {
  const state = (declared: boolean, known: boolean, equal: () => boolean) => {
    if (!declared) return null;
    if (!known) return "unknown";
    return equal() ? "shared" : "different";
  };

  switch (trait) {
    case "shape":
      return state(true, true, () => candidate.shape === target.shape);
    case "balance":
      return state(target.balance !== null, candidate.balance !== null, () => candidate.balance === target.balance);
    case "style":
      return state(target.playStyle !== null, candidate.playStyle !== null, () => candidate.playStyle === target.playStyle);
    case "level":
      return state(target.levels.length > 0, candidate.levels.length > 0, () =>
        candidate.levels.some((level) => target.levels.includes(level)),
      );
    case "touch":
      return state(Boolean(clean(target.touch)), Boolean(clean(candidate.touch)), () => clean(candidate.touch) === clean(target.touch));
    case "weight": {
      const [a, b] = [target.weight, candidate.weight];
      return state(a !== null, b !== null, () => a !== null && b !== null && Math.abs(middle(b) - middle(a)) <= WEIGHT_TOLERANCE);
    }
  }
}

const TRAITS = Object.keys(TRAIT_WEIGHTS) as AlternativeTrait[];

/** Parecido entre dos palas. `ignore`: atributos que el modo ya fija y no deben contar. */
export function similarity(
  target: AlternativeTraits,
  candidate: AlternativeTraits,
  ignore: AlternativeTrait[] = [],
): Similarity {
  const result: Similarity = { score: 0, shared: [], different: [], unknown: [] };
  for (const trait of TRAITS) {
    const state = traitState(trait, target, candidate);
    if (state === null) continue;
    result[state].push(trait);
    if (ignore.includes(trait)) continue;
    if (state === "shared") result.score += TRAIT_WEIGHTS[trait];
    if (state === "unknown") result.score -= UNKNOWN_PENALTY;
  }
  return result;
}

export type AlternativeModeId =
  | "mas-barata"
  | "control"
  | "potencia"
  | "polivalente"
  | "manejable"
  | "otra-marca"
  | "temporada-anterior"
  | `hasta-${(typeof BUDGETS)[number]}`;

interface Mode {
  id: AlternativeModeId;
  label: string;
  /** Qué se ha exigido, para explicarlo junto a la lista */
  criterion: string;
  /** Requisito obligatorio; quien no lo cumple no aparece */
  accepts: (target: AlternativeTarget, candidate: AlternativeCandidate) => boolean;
  /** Atributos que el requisito ya fija */
  ignore?: AlternativeTrait[];
  /** El modo necesita que la pala de la ficha tenga precio vigente */
  needsTargetPrice?: boolean;
  /** A igualdad de parecido, primero la más barata (y no la de precio más cercano) */
  cheapestFirst?: boolean;
}

const priceOf = (candidate: AlternativeCandidate) => candidate.pala.price;
/** Se parecen en lo esencial: misma forma o mismo estilo de juego declarado. */
const sameFamily = (target: AlternativeTarget, candidate: AlternativeCandidate) =>
  candidate.shape === target.shape || (target.playStyle !== null && candidate.playStyle === target.playStyle);

function styleMode(style: PlayStyle, id: AlternativeModeId, label: string): Mode {
  return {
    id,
    label,
    criterion: `Palas a la venta cuyo estilo de juego declarado es ${STYLE_LABELS[style].toLowerCase()}, ordenadas por lo que comparten con esta.`,
    accepts: (_, candidate) => candidate.playStyle === style,
    ignore: ["style"],
  };
}

function budgetMode(max: (typeof BUDGETS)[number]): Mode {
  return {
    id: `hasta-${max}`,
    label: `Hasta ${max} €`,
    criterion: `Palas de la misma forma o el mismo estilo de juego que hoy cuestan ${max} € o menos.`,
    accepts: (target, candidate) => {
      const price = priceOf(candidate);
      // Un presupuesto que no baja del precio de esta pala no es una alternativa de presupuesto.
      if (price === null || price > max || (target.price !== null && target.price <= max)) return false;
      return sameFamily(target, candidate);
    },
    cheapestFirst: false,
  };
}

export const ALTERNATIVE_MODES: Mode[] = [
  {
    id: "mas-barata",
    label: "Más barata",
    criterion: "Palas de la misma forma o el mismo estilo de juego que hoy cuestan al menos un 5 % menos.",
    needsTargetPrice: true,
    cheapestFirst: true,
    accepts: (target, candidate) => {
      const price = priceOf(candidate);
      return (
        price !== null &&
        target.price !== null &&
        price <= target.price * (1 - MIN_SAVING_RATIO) &&
        sameFamily(target, candidate)
      );
    },
  },
  // «Priorizar», no «más»: el modo exige ese estilo o ese balance declarado, pero
  // no mide si la candidata tiene más control o potencia que la pala de la ficha.
  styleMode("control", "control", "Priorizar control"),
  styleMode("potencia", "potencia", "Priorizar potencia"),
  styleMode("polivalente", "polivalente", "Polivalente"),
  {
    id: "manejable",
    label: "Priorizar manejabilidad",
    criterion: "Palas a la venta que declaran balance bajo, ordenadas por lo que comparten con esta.",
    accepts: (_, candidate) => candidate.balance === "bajo",
    ignore: ["balance"],
  },
  {
    id: "otra-marca",
    label: "Otra marca",
    criterion: "Palas de otras marcas con la misma forma, ordenadas por lo que comparten con esta.",
    accepts: (target, candidate) =>
      candidate.pala.brand.slug !== target.brandSlug && candidate.shape === target.shape,
  },
  {
    id: "temporada-anterior",
    // No son ediciones anteriores de este modelo (esas van en «Otras temporadas»): son otras palas.
    label: "De temporadas anteriores",
    criterion: "Otras palas de temporadas anteriores, de cualquier marca, con la misma forma y a la venta.",
    accepts: (target, candidate) => candidate.pala.year < target.year && candidate.shape === target.shape,
  },
  ...BUDGETS.map(budgetMode),
];

export interface AlternativeItem {
  pala: PalaSummary;
  /** Por qué aparece y qué cambia, en frases cortas */
  reasons: string[];
  /** Parecido con la pala de la ficha (lib/alternatives.ts) */
  score: number;
}

export interface AlternativeGroup {
  id: AlternativeModeId;
  label: string;
  criterion: string;
  items: AlternativeItem[];
}

const TRAIT_NAMES: Record<AlternativeTrait, string> = {
  shape: "forma",
  balance: "balance",
  style: "estilo de juego",
  level: "nivel",
  touch: "tacto",
  weight: "peso",
};

/** Atributos cuyo nombre es femenino: «forma distinta», pero «balance distinto». */
const FEMININE_TRAITS: ReadonlySet<AlternativeTrait> = new Set<AlternativeTrait>(["shape"]);

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;
}

/** Valor declarado de un atributo que cambia, para decirlo: «Balance distinto: medio». */
function differentValue(trait: AlternativeTrait, candidate: AlternativeTraits): string | null {
  if (trait === "shape") return SHAPE_LABELS[candidate.shape].toLowerCase();
  if (trait === "balance" && candidate.balance) return BALANCE_LABELS[candidate.balance].toLowerCase();
  if (trait === "style" && candidate.playStyle) return STYLE_LABELS[candidate.playStyle].toLowerCase();
  if (trait === "touch" && candidate.touch) return canonicalTouch(candidate.touch);
  if (trait === "weight" && candidate.weight) return formatWeight(candidate.weight);
  return null;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Diferencia de precio en una frase; null si alguna de las dos no tiene precio vigente. */
export function priceReason(targetPrice: number | null, price: number | null): string | null {
  if (targetPrice === null || price === null) return null;
  // En euros enteros: los céntimos no cambian la decisión y ensucian la frase.
  const difference = Math.round(price - targetPrice);
  if (difference === 0) return "Cuesta prácticamente lo mismo";
  return `Cuesta ${formatEuroCompact(Math.abs(difference))} ${difference < 0 ? "menos" : "más"}`;
}

/** Máximo de diferencias y de datos sin verificar que se nombran por alternativa */
const MAX_NOTES = 2;

/** Las frases que explican una alternativa: precio, coincidencias, diferencias y datos que faltan. */
export function alternativeReasons(
  target: AlternativeTarget,
  candidate: AlternativeCandidate,
  found: Similarity = similarity(target, candidate),
): string[] {
  const reasons: string[] = [];
  const price = priceReason(target.price, priceOf(candidate));
  if (price) reasons.push(price);

  if (found.shared.length > 0) {
    const names = found.shared.map((trait) => TRAIT_NAMES[trait]);
    reasons.push(`Comparte ${list(names)} ${names.length === 1 ? "declarado" : "declarados"}`);
  }
  for (const trait of found.different.slice(0, MAX_NOTES)) {
    const value = differentValue(trait, candidate);
    if (value) reasons.push(`${capitalize(TRAIT_NAMES[trait])} ${FEMININE_TRAITS.has(trait) ? "distinta" : "distinto"}: ${value}`);
  }
  if (found.unknown.length > 0) {
    reasons.push(`No se ha podido verificar su ${list(found.unknown.slice(0, MAX_NOTES).map((trait) => TRAIT_NAMES[trait]))}`);
  }
  return reasons;
}

/** Alternativas de un modo, de más a menos parecidas. */
export function findAlternatives(
  target: AlternativeTarget,
  candidates: AlternativeCandidate[],
  mode: Mode,
  limit: number,
): AlternativeItem[] {
  if (mode.needsTargetPrice && target.price === null) return [];

  const distance = (candidate: AlternativeCandidate) =>
    target.price === null || mode.cheapestFirst ? (priceOf(candidate) ?? 0) : Math.abs((priceOf(candidate) ?? 0) - target.price);

  return candidates
    .filter((candidate) => candidate.pala.id !== target.id && priceOf(candidate) !== null && mode.accepts(target, candidate))
    .map((candidate) => ({ candidate, found: similarity(target, candidate, mode.ignore) }))
    // Sin nada en común no es una alternativa: sería una pala cualquiera que cumple el filtro.
    .filter(({ found }) => found.score > 0)
    .sort(
      (a, b) =>
        b.found.score - a.found.score ||
        Number(b.candidate.pala.image !== null) - Number(a.candidate.pala.image !== null) ||
        distance(a.candidate) - distance(b.candidate) ||
        a.candidate.pala.slug.localeCompare(b.candidate.pala.slug),
    )
    .slice(0, limit)
    .map(({ candidate, found }) => ({
      pala: candidate.pala,
      reasons: alternativeReasons(target, candidate, similarity(target, candidate)),
      score: found.score,
    }));
}

/** La pala de una ficha como punto de partida de la búsqueda de alternativas. Solo cuenta un precio vigente. */
export function alternativeTarget(pala: Pala): AlternativeTarget {
  return {
    id: pala.id,
    brandSlug: pala.brand.slug,
    year: pala.year,
    shape: pala.shape,
    balance: pala.balance,
    playStyle: pala.playStyle,
    levels: pala.levels,
    weight: pala.weight,
    touch: rawTouch(pala),
    price: pala.price && pala.price.freshness !== "stale" ? pala.price.current : null,
  };
}

// --- «Tengo esta pala y quiero cambiar…» ---------------------------------------------
//
// El recomendador a partir de la pala actual usa este mismo motor: lo que la
// persona quiere cambiar son modos (más barata, priorizar control…) y lo que
// quiere conservar son atributos que la candidata debe compartir.

/** Lo que se puede pedir que cambie: los modos que no dependen de un tope fijo */
export const UPGRADE_WANTS = ["mas-barata", "control", "potencia", "polivalente", "manejable", "otra-marca"] as const;
export type UpgradeWant = (typeof UPGRADE_WANTS)[number];

/** Lo que se puede pedir que se conserve */
export const UPGRADE_KEEPS = ["shape", "balance", "touch", "weight"] as const;
export type UpgradeKeep = (typeof UPGRADE_KEEPS)[number];

export const KEEP_LABELS: Record<UpgradeKeep, string> = {
  shape: "La forma",
  balance: "El balance",
  touch: "El tacto",
  weight: "El peso",
};

export interface UpgradeRequest {
  wants: UpgradeWant[];
  keeps: UpgradeKeep[];
  /** Precio máximo de hoy, en euros; null sin tope */
  maxPrice: number | null;
}

export interface UpgradeItem extends AlternativeItem {
  /** Cambios pedidos que esta pala cumple y que no cumple */
  satisfied: string[];
  unmet: string[];
}

export interface UpgradeResult {
  items: UpgradeItem[];
  /** Atributos que se pidió conservar y la pala actual no declara: no se han podido exigir */
  unknownKeeps: UpgradeKeep[];
}

const modeOf = (id: AlternativeModeId) => ALTERNATIVE_MODES.find((mode) => mode.id === id) as Mode;

/**
 * Palas que conservan lo que se quiere conservar y cumplen lo que se quiere
 * cambiar. Lo que se conserva y el presupuesto son requisitos: quien no los
 * cumple no aparece. De los cambios pedidos basta con cumplir alguno, y cada
 * resultado dice cuáles cumple y cuáles no; primero van las que cumplen más.
 */
export function findUpgrades(
  target: AlternativeTarget,
  candidates: AlternativeCandidate[],
  request: UpgradeRequest,
  limit = 5,
): UpgradeResult {
  // Un cambio o un atributo repetido en la petición (la URL puede traerlo dos veces) cuenta una sola vez.
  const wants = [...new Set(request.wants)].map(modeOf).filter((mode) => !(mode.needsTargetPrice && target.price === null));
  // Lo que la pala actual no declara no se puede exigir a otra: se avisa en vez de ignorarlo en silencio.
  const declared = (keep: UpgradeKeep) => traitState(keep, target, target) !== null;
  const uniqueKeeps = [...new Set(request.keeps)];
  const keeps = uniqueKeeps.filter(declared);
  const ignore = [...new Set(wants.flatMap((mode) => mode.ignore ?? []))];

  const items = candidates
    .filter((candidate) => candidate.pala.id !== target.id && priceOf(candidate) !== null)
    .filter((candidate) => request.maxPrice === null || (priceOf(candidate) as number) <= request.maxPrice)
    .filter((candidate) => keeps.every((keep) => traitState(keep, target, candidate) === "shared"))
    .map((candidate) => ({
      candidate,
      found: similarity(target, candidate, ignore),
      satisfied: wants.filter((mode) => mode.accepts(target, candidate)),
    }))
    .filter(({ satisfied, found }) => (wants.length === 0 ? found.score > 0 : satisfied.length > 0))
    .sort(
      (a, b) =>
        b.satisfied.length - a.satisfied.length ||
        b.found.score - a.found.score ||
        Number(b.candidate.pala.image !== null) - Number(a.candidate.pala.image !== null) ||
        (priceOf(a.candidate) ?? 0) - (priceOf(b.candidate) ?? 0) ||
        a.candidate.pala.slug.localeCompare(b.candidate.pala.slug),
    )
    .slice(0, limit)
    .map(({ candidate, found, satisfied }) => ({
      pala: candidate.pala,
      reasons: alternativeReasons(target, candidate),
      score: found.score,
      satisfied: satisfied.map((mode) => mode.label),
      unmet: wants.filter((mode) => !satisfied.includes(mode)).map((mode) => mode.label),
    }));

  return { items, unknownKeeps: uniqueKeeps.filter((keep) => !declared(keep)) };
}

/** Todos los modos que tienen alguna alternativa para esta pala, en su orden. */
export function buildAlternativeGroups(
  target: AlternativeTarget,
  candidates: AlternativeCandidate[],
  limit = 3,
): AlternativeGroup[] {
  return ALTERNATIVE_MODES.flatMap((mode) => {
    const items = findAlternatives(target, candidates, mode, limit);
    return items.length > 0 ? [{ id: mode.id, label: mode.label, criterion: mode.criterion, items }] : [];
  });
}
