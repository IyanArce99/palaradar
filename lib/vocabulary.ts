// Vocabulario común de las características de una pala: cómo se llama cada valor
// en las tiendas, en las fuentes y en lo que escribe la gente, llevado a los
// valores del catálogo. Lo usan el buscador (lib/catalog/search-intent.ts), las
// alternativas (lib/alternatives.ts) y las sugerencias de emparejamiento
// (quality/matching.ts), para que todos entiendan lo mismo por «redonda»,
// «tacto medio» o «365 g».
//
// Reglas:
//   · solo se normaliza la forma de escribir un valor declarado; nunca se
//     deduce un valor que la fuente no da;
//   · un texto que no se reconoce queda como desconocido (null), no en una
//     categoría por defecto;
//   · una descripción comercial («gran potencia») no es un atributo.
import type { PalaBalance, PalaShape, PlayerLevel, PlayStyle } from "@/types/catalog";

/** Minúsculas, sin acentos y con espacios simples: la forma en que se comparan los textos. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type Dictionary<T extends string> = Record<T, string[]>;

/** Formas de escribir cada valor, ya sin acentos ni mayúsculas */
export const SHAPE_WORDS: Dictionary<PalaShape> = {
  redonda: ["redonda", "redondas", "redondo", "round"],
  lagrima: ["lagrima", "lagrimas", "gota", "teardrop"],
  diamante: ["diamante", "diamantes", "diamond"],
  hibrida: ["hibrida", "hibridas", "hibrido", "hybrid"],
};

export const STYLE_WORDS: Dictionary<PlayStyle> = {
  control: ["control"],
  polivalente: ["polivalente", "polivalentes", "versatil", "versatiles", "equilibrada", "equilibradas", "equilibrio"],
  potencia: ["potencia", "potente", "potentes"],
};

export const BALANCE_WORDS: Dictionary<PalaBalance> = {
  bajo: ["bajo", "baja"],
  medio: ["medio", "media"],
  alto: ["alto", "alta"],
};

export const LEVEL_WORDS: Dictionary<PlayerLevel> = {
  iniciacion: ["iniciacion", "principiante", "principiantes", "empezar", "iniciarse"],
  intermedio: ["intermedio", "intermedia", "intermedios"],
  avanzado: ["avanzado", "avanzada", "avanzados"],
  competicion: ["competicion", "profesional", "profesionales"],
};

function lookup<T extends string>(dictionary: Dictionary<T>, text: string | null | undefined): T | null {
  const value = fold(text ?? "");
  if (value === "") return null;
  for (const key of Object.keys(dictionary) as T[]) {
    if (dictionary[key].includes(value)) return key;
  }
  return null;
}

/** Valor del catálogo para una forma escrita de cualquier manera; null si no se reconoce. */
export const normalizeShape = (text: string | null | undefined) => lookup(SHAPE_WORDS, text);
export const normalizeStyle = (text: string | null | undefined) => lookup(STYLE_WORDS, text);
export const normalizeBalance = (text: string | null | undefined) => lookup(BALANCE_WORDS, text);
export const normalizeLevel = (text: string | null | undefined) => lookup(LEVEL_WORDS, text);

/**
 * El tacto («blando», «medio», «duro») y la dureza («blanda», «media», «dura») son
 * el mismo dato con dos vocabularios: se llevan a uno solo para compararlos, como
 * hace el recomendador (TOUCH_MATCHES). Los valores múltiples se ordenan, para que
 * «Dura, Media» y «Media, Dura» sean iguales. Vacío si no hay dato.
 */
const HARDNESS_AS_TOUCH: Record<string, string> = { blanda: "blando", media: "medio", dura: "duro" };

export function canonicalTouch(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .split(/[,/]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => HARDNESS_AS_TOUCH[part] ?? part)
    .sort((a, b) => a.localeCompare(b, "es"))
    .join(", ");
}

export interface WeightRange {
  /** Gramos */
  min: number;
  max: number;
}

/** Pesos fuera de este intervalo no son de una pala de pádel: se tratan como dato no válido */
export const MIN_RACKET_GRAMS = 250;
export const MAX_RACKET_GRAMS = 450;

/**
 * Peso declarado en gramos: «365 g», «360-375 gr», «355 – 365 gramos», «0,37 kg».
 * null si el texto no es un peso o si el resultado no es el de una pala: una
 * unidad equivocada («365 kg», «36 g») no se corrige, se descarta.
 */
export function parseWeight(text: string | null | undefined): WeightRange | null {
  const value = fold(text ?? "").replace(/,/g, ".");
  const match = /^(\d+(?:\.\d+)?)(?:\s*(?:-|–|—|a|\/)\s*(\d+(?:\.\d+)?))?\s*(kg|kilos?|g|gr|grs|gramos?)?$/.exec(value);
  if (!match) return null;

  const factor = match[3]?.startsWith("k") ? 1000 : 1;
  const first = Number(match[1]) * factor;
  const second = match[2] === undefined ? first : Number(match[2]) * factor;
  const [min, max] = [Math.round(Math.min(first, second)), Math.round(Math.max(first, second))];
  return min >= MIN_RACKET_GRAMS && max <= MAX_RACKET_GRAMS ? { min, max } : null;
}

/**
 * Atributos que se reconocen en el título de un producto de tienda. Solo palabras
 * inequívocas: sirven de pista para revisar un emparejamiento, no para decidirlo.
 */
export function attributesInTitle(title: string): { shape: PalaShape | null } {
  const words = fold(title).split(/[^a-z0-9]+/);
  const shapes = (Object.keys(SHAPE_WORDS) as PalaShape[]).filter(
    // «hybrid» es también una variante de modelo (Vertex Hybrid): no dice la forma.
    (shape) => SHAPE_WORDS[shape].some((word) => word !== "hybrid" && words.includes(word)),
  );
  return { shape: shapes.length === 1 ? shapes[0] : null };
}
