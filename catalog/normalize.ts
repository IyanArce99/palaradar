// De las observaciones elegidas de una pala a los valores que se publican en
// `rackets`. Todo es traducción de vocabulario: si un valor no encaja en el
// nuestro, el campo queda vacío. Aquí no se deduce ni se completa nada.
import { createHash } from "node:crypto";
import { BALANCE_LABELS, formatLevels, SHAPE_LABELS } from "@/lib/labels";
import type { PalaBalance, PalaShape, PlayerLevel, PlayStyle, Spec } from "@/types/catalog";
import type { ImportFact } from "./types";

function plain(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

const SHAPES: Record<string, PalaShape> = {
  redonda: "redonda",
  round: "redonda",
  lagrima: "lagrima",
  teardrop: "lagrima",
  diamante: "diamante",
  diamond: "diamante",
  "diamond oversize": "diamante",
  hibrida: "hibrida",
  hibrido: "hibrida",
  hybrid: "hibrida",
  allround: "hibrida",
};

export function toShape(value: string | null | undefined): PalaShape | null {
  return value ? (SHAPES[plain(value)] ?? null) : null;
}

// Tres valores. «Ligeramente alto» se publica como alto; el original queda en el dato.
const BALANCES: Record<string, PalaBalance> = {
  alto: "alto",
  "head heavy": "alto",
  "cabeza pesada": "alto",
  "medio-alto": "alto",
  "slightly head heavy": "alto",
  medio: "medio",
  even: "medio",
  equilibrado: "medio",
  bajo: "bajo",
  "cabeza ligera": "bajo",
  "head light": "bajo",
};

export function toBalance(value: string | null | undefined): PalaBalance | null {
  return value ? (BALANCES[plain(value)] ?? null) : null;
}

const STYLES: Record<string, PlayStyle> = {
  control: "control",
  polivalente: "polivalente",
  potencia: "potencia",
  attack: "potencia",
  ataque: "potencia",
};

export function toPlayStyle(value: string | null | undefined): PlayStyle | null {
  return value ? (STYLES[plain(value)] ?? null) : null;
}

const LEVEL_ORDER: PlayerLevel[] = ["iniciacion", "intermedio", "avanzado", "competicion"];
const LEVEL_WORDS: [RegExp, PlayerLevel][] = [
  [/principiante|iniciacion|beginner/, "iniciacion"],
  [/intermedi/, "intermedio"],
  [/avanzad|advanced/, "avanzado"],
  [/competicion|profesional|\bpro\b/, "competicion"],
];

/**
 * Niveles que nombra la fuente. Un rango («intermedio a avanzado»,
 * «principiantes hasta avanzados») incluye los niveles intermedios.
 */
export function toLevels(value: string | null | undefined): PlayerLevel[] {
  if (!value) return [];
  const text = plain(value);
  const named = LEVEL_WORDS.filter(([pattern]) => pattern.test(text)).map(([, level]) => level);
  if (named.length === 0) return [];

  const indexes = named.map((level) => LEVEL_ORDER.indexOf(level));
  const isRange = /\b(a|hasta)\b/.test(text) && named.length === 2;
  return isRange
    ? LEVEL_ORDER.slice(Math.min(...indexes), Math.max(...indexes) + 1)
    : LEVEL_ORDER.filter((level) => named.includes(level));
}

/** «350-370» → [350, 370]; «365» → [365, 365] */
export function toWeightRange(value: string | null | undefined): [number, number] | null {
  const match = /^(\d{3})(?:-(\d{3}))?$/.exec(value?.trim() ?? "");
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2] ?? match[1]);
  return min <= max ? [min, max] : null;
}

export function slugify(text: string): string {
  return plain(text)
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** UUID determinista: la misma clave da siempre el mismo id, así repetir la carga no duplica. */
export function stableId(key: string): string {
  const hash = createHash("sha1").update(`palaradar:${key}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

const GENERIC_ART_PALETTES = 9;

/** Ilustración genérica de la forma (scripts/generate-art.ts): no es foto del producto. */
export function genericArtPath(shape: PalaShape, slug: string): string {
  const index = createHash("sha1").update(slug).digest()[0] % GENERIC_ART_PALETTES;
  return `/img/palas/generica-${shape}-${index}.svg`;
}

const STYLE_NOUN: Record<PlayStyle, string> = {
  control: "Pala de control",
  polivalente: "Pala polivalente",
  potencia: "Pala de potencia",
};
const STYLE_SEEKER: Record<PlayStyle, string> = {
  control: "Quienes buscan control",
  polivalente: "Quienes buscan una pala polivalente",
  potencia: "Quienes buscan potencia",
};

/** Valores publicados de una pala, tal como van a las columnas de `rackets`. */
export interface PublishedValues {
  shape: PalaShape | null;
  balance: PalaBalance | null;
  playStyle: PlayStyle | null;
  levels: PlayerLevel[];
  weightMin: number | null;
  weightMax: number | null;
  thicknessMm: number | null;
  surface: string | null;
  finish: string | null;
  hardness: string | null;
  gender: string | null;
  msrp: number | null;
  technicalSpecs: Spec[];
  description: string;
  idealFor: string[];
  /** Fuente del dato técnico principal, para la ficha */
  specsSourceUrl: string | null;
  enrichmentLevel: number;
}

/** Valores publicados a partir de las observaciones marcadas como elegidas. */
export function publishedValues(facts: ImportFact[]): PublishedValues {
  const selected = new Map(facts.filter((fact) => fact.selected).map((fact) => [fact.attribute, fact]));
  const value = (attribute: string) => selected.get(attribute)?.value ?? null;
  const shown = (attribute: string) => selected.get(attribute)?.raw ?? value(attribute);
  const number = (attribute: string) => {
    const parsed = Number(value(attribute));
    return value(attribute) !== null && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const shape = toShape(value("shape"));
  const balance = toBalance(value("balance"));
  const playStyle = toPlayStyle(value("play_style"));
  const levels = toLevels(value("level"));
  const weight = toWeightRange(value("weight"));
  const thicknessMm = number("thickness_mm");

  const specs: [string, string | null][] = [
    ["Núcleo", shown("core")],
    ["Caras", shown("face")],
    ["Marco", shown("frame")],
    ["Grosor", thicknessMm === null ? null : `${thicknessMm} mm`],
    ["Superficie", shown("surface")],
    ["Acabado", shown("finish")],
    ["Tacto", shown("touch")],
  ];

  const noun = playStyle ? STYLE_NOUN[playStyle] : "Pala";
  const shapeText = shape ? ` de forma ${SHAPE_LABELS[shape].toLowerCase()}` : "";
  const balanceText = balance ? `${shape ? " y" : " de"} balance ${BALANCE_LABELS[balance].toLowerCase()}` : "";

  const idealFor: string[] = [];
  if (levels.length > 0) {
    idealFor.push(`Jugadores de nivel ${formatLevels(levels).toLowerCase().replaceAll(" · ", ", ")}`);
  }
  if (playStyle) idealFor.push(STYLE_SEEKER[playStyle]);

  const hasBasics = shape !== null && weight !== null;
  const hasExtended = balance !== null && levels.length > 0 && playStyle !== null;

  return {
    shape,
    balance,
    playStyle,
    levels,
    weightMin: weight?.[0] ?? null,
    weightMax: weight?.[1] ?? null,
    thicknessMm,
    surface: shown("surface"),
    finish: shown("finish"),
    hardness: shown("hardness"),
    gender: shown("gender"),
    msrp: number("msrp"),
    technicalSpecs: specs.flatMap(([label, text]) => (text ? [{ label, value: text }] : [])),
    description: `${noun}${shapeText}${balanceText}.`,
    idealFor,
    specsSourceUrl: selected.get("shape")?.url ?? selected.get("weight")?.url ?? null,
    enrichmentLevel: hasBasics && hasExtended ? 2 : 1,
  };
}
