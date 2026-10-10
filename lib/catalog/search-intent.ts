// Buscador en lenguaje natural: convierte lo que alguien escribe («pala redonda
// por menos de 120 euros») en los filtros del catálogo que ya existen. No hay IA
// ni adivinación: son diccionarios (lib/vocabulary.ts) y unas pocas reglas, y
// cada criterio detectado se enseña para poder quitarlo.
//
// Reglas:
//   · solo se convierte en filtro lo que se reconoce sin duda; lo demás se busca
//     como texto, igual que antes;
//   · un número solo es un presupuesto si lo dice el contexto («menos de», «hasta»,
//     «€»): «vertex 04» o «2025» no son precios;
//   · el catálogo solo filtra por precio máximo y no sabe excluir: un mínimo, un
//     rango, varios importes o un criterio negado («no diamante», «sin oferta»)
//     no se aplican, se quitan del texto que se busca y se explican en una nota;
//   · una palabra que también aparece en nombres de modelo («control», «potencia»)
//     solo es un criterio si la frase lo pide («de control») o si no queda nada
//     más que buscar;
//   · un criterio nunca se aplica en silencio: va en `detected`.
import {
  BALANCE_LABELS,
  LEVEL_LABELS,
  SHAPE_LABELS,
  STYLE_LABELS,
} from "@/lib/labels";
import { formatEuroCompact } from "@/lib/format";
import { fold, LEVEL_WORDS, SHAPE_WORDS, STYLE_WORDS } from "@/lib/vocabulary";
import type { PalaBalance, PalaShape, PlayerLevel, PlayStyle } from "@/types/catalog";
import { COVERAGE_LABELS, DEFAULT_QUERY, type CatalogQuery, type CoverageId } from "./query";

export interface SearchContext {
  /** Marcas del catálogo */
  brands: { slug: string; name: string }[];
  /** Temporadas que hay en el catálogo */
  years: number[];
  /** Año en curso: lo anterior son «temporadas anteriores» */
  currentYear: number;
}

/** Filtros que el buscador sabe deducir de un texto */
export type IntentFilters = Pick<
  CatalogQuery,
  "levels" | "styles" | "brands" | "shapes" | "balances" | "years" | "maxPrice" | "coverage" | "collection" | "sort"
>;

export interface DetectedCriterion {
  /** Filtro del catálogo al que corresponde */
  key: keyof IntentFilters;
  /** Cómo se enseña: «Hasta 120 €», «Forma redonda» */
  label: string;
  /** Las palabras del texto que lo han activado */
  from: string;
}

export interface SearchIntent {
  /** Filtros deducidos; vacío si no se ha reconocido ninguno */
  filters: Partial<IntentFilters>;
  detected: DetectedCriterion[];
  /** Lo que queda por buscar como texto (marca y modelo, normalmente) */
  text: string;
  /**
   * La consulta pide alternativas a un modelo («alternativa más barata a la
   * vertex 04»): el texto del modelo de referencia. null si no es el caso.
   */
  reference: string | null;
  /** Avisos sobre lo que no se ha interpretado, para no dar a entender que sí */
  notes: string[];
}

const EMPTY: SearchIntent = { filters: {}, detected: [], text: "", reference: null, notes: [] };

/** Presupuestos fuera de este intervalo no son el precio de una pala */
const MIN_BUDGET = 20;
const MAX_BUDGET = 2000;

/** Palabras que no aportan nada a la búsqueda cuando ya se ha reconocido algún criterio */
const NOISE = new Set([
  "pala", "palas", "padel", "raqueta", "raquetas", "de", "del", "la", "las", "el", "los", "un", "una", "unas", "unos",
  "por", "para", "con", "que", "y", "o", "en", "a", "al", "mi", "me", "quiero", "busco", "buscar", "necesito",
  "modelo", "modelos", "tipo", "forma", "juego", "estilo", "nivel", "jugador", "jugadores", "mas", "muy", "esta", "este",
  "euro", "euros", "eur", "precio", "precios", "tienda", "tiendas", "marca", "otra", "otro", "otras",
  // Restos que dejan las frases interpretadas a medias: «entre 2024 y 2025», «150 euros o menos», «de la temporada 2025»
  "entre", "menos", "hay", "temporada", "temporadas", "ano", "anos", "edicion", "ediciones",
]);

/** Palabras que, delante de «control» o «potencia», dejan claro que se pide un tipo de pala */
const STYLE_CUES = new Set(["de", "para", "mas", "priorizar", "prioriza", "tipo", "estilo", "juego", "busco", "quiero"]);

/** Palabras que, delante de un criterio, lo niegan: «no diamante», «sin oferta», «todas menos redonda» */
const NEGATORS = new Set(["no", "sin", "excepto", "salvo", "ni", "nunca", "tampoco", "menos"]);

/** Palabras que pueden ir entre la negación y el criterio: «que no esté en oferta», «sin la forma redonda» */
const NEGATION_FILLERS = new Set([
  "es", "son", "sea", "sean", "este", "esten", "esta", "estan", "hay", "que", "de", "en", "con", "la", "las", "el", "los",
  "un", "una", "tipo", "forma", "muy", "tan", "quiero", "busco", "tenga", "tengan", "haya", "para", "nivel", "juego",
  "estilo",
]);
const MAX_NEGATION_FILLERS = 2;

interface Rule {
  pattern: RegExp;
  /** Devuelve false si al final no ha reconocido nada: entonces el texto no se toca. */
  apply: (match: RegExpExecArray, intent: Draft, context: SearchContext) => boolean;
}

interface Draft {
  filters: Partial<IntentFilters>;
  detected: DetectedCriterion[];
  notes: string[];
}

function add<K extends keyof IntentFilters>(draft: Draft, key: K, value: IntentFilters[K], label: string, from: string) {
  const current = draft.filters[key];
  if (Array.isArray(value) && Array.isArray(current)) {
    const merged = [...new Set([...current, ...value])];
    if (merged.length === current.length) return;
    draft.filters[key] = merged as IntentFilters[K];
  } else {
    draft.filters[key] = value;
  }
  draft.detected.push({ key, label, from: from.trim() });
}

const NUMBER_WORDS: Record<string, number> = { dos: 2, tres: 3, varias: 2 };

// Reglas de frase: se aplican sobre el texto sin acentos y consumen lo que reconocen.
// Van entre límites de palabra: «ofertas» no se reconoce dentro de otra palabra.
const PHRASE_RULES: Rule[] = [
  {
    pattern: /\b(?:(?:(?:en|de)\s+)?(dos|tres|varias|2|3)\s+tiendas|comparables? entre tiendas|en mas de una tienda)\b/,
    apply: (match, draft) => {
      const stores = match[1] ? (NUMBER_WORDS[match[1]] ?? Number(match[1])) : 2;
      // El catálogo sabe filtrar «dos o más»: pedir tres no se convierte en un filtro que no existe.
      if (stores > 2) draft.notes.push("Solo podemos filtrar por «dos tiendas o más»; lo hemos aplicado así.");
      add(draft, "coverage", ["varias-tiendas"], COVERAGE_LABELS["varias-tiendas"], match[0]);
      return true;
    },
  },
  {
    pattern: /\b(?:(?:con )?precio (?:confirmado|verificado|actual|de hoy|hoy|disponible)|con precio|a la venta|disponibles?(?: ahora| hoy)?)\b/,
    apply: (match, draft) => {
      add(draft, "coverage", ["con-precio"], COVERAGE_LABELS["con-precio"], match[0]);
      return true;
    },
  },
  {
    // «Del año pasado» es una sola temporada: la anterior a la actual.
    pattern: /\b(?:del? |la |de la )?(?:ano|temporada) pasad[ao]\b/,
    apply: (match, draft, context) => {
      const year = context.currentYear - 1;
      if (!context.years.includes(year)) return false;
      add(draft, "years", [year], `Temporada ${year}`, match[0]);
      return true;
    },
  },
  {
    pattern: /\b(?:temporadas? anterior(?:es)?|anos? anterior(?:es)?|ediciones? anterior(?:es)?|temporadas pasadas)\b/,
    apply: (match, draft, context) => {
      const years = context.years.filter((year) => year < context.currentYear).sort((a, b) => b - a);
      if (years.length === 0) return false;
      add(draft, "years", years, `Temporadas anteriores a ${context.currentYear}`, match[0]);
      return true;
    },
  },
  {
    pattern: /\b(?:en oferta|ofertas?|rebajad[ao]s?|con descuento)\b/,
    apply: (match, draft) => {
      add(draft, "collection", "en-oferta", "En oferta", match[0]);
      return true;
    },
  },
  {
    pattern: /\bbalance (bajo|medio|alto)\b/,
    apply: (match, draft) => {
      const balance = match[1] as PalaBalance;
      add(draft, "balances", [balance], `Balance ${BALANCE_LABELS[balance].toLowerCase()}`, match[0]);
      return true;
    },
  },
  {
    // «Manejable» es lo que define la colección del mismo nombre: forma redonda y balance bajo declarados.
    pattern: /\b(?:manejables?|manejabilidad|facil(?:es)? de mover)\b/,
    apply: (match, draft) => {
      add(draft, "shapes", ["redonda"], "Manejable: forma redonda", match[0]);
      add(draft, "balances", ["bajo"], "Manejable: balance bajo", match[0]);
      return true;
    },
  },
  {
    // «Otra marca» solo significa algo respecto a una pala concreta: no se convierte en filtro.
    pattern: /\b(?:de |en )?otras? marcas?\b/,
    apply: (_, draft) => {
      draft.notes.push(
        "«Otra marca» depende de una pala concreta: abre su ficha y elige «Otra marca» en sus alternativas.",
      );
      return true;
    },
  },
  {
    pattern: /\b(?:baratas?|economicas?|mas barat[ao]s?)\b/,
    apply: (match, draft) => {
      add(draft, "sort", "precio", "Ordenadas por precio", match[0]);
      return true;
    },
  },
];

// --- Precios ---------------------------------------------------------------------
// El catálogo solo sabe filtrar por un precio máximo. Un mínimo («más de 200 €»),
// un rango («entre 100 y 150 €») o varios importes no se convierten en ese máximo:
// se dejan sin aplicar y se dice.

/**
 * Un importe: hasta cuatro cifras, con decimales o punto de millar («99,95», «1.200»).
 * No es un trozo de otro número («12000») ni va seguido de una unidad de peso o
 * medida («365 gramos», «370 g», «12k»): eso no es un precio.
 */
const AMOUNT = String.raw`(?<![\d.,])\d{1,4}(?:[.,]\d{1,3})?(?!\d)(?!\s*(?:g|gr|grs|gramos?|kg|mm|cm|k)\b)`;
const AMOUNT_VALUE = /(?<![\d.,])(\d{1,4})(?:[.,](\d{1,3}))?(?!\d)/g;
const CURRENCY = String.raw`(?:€|(?:euros?|eur)\b)`;

/** «99,95» → 100 (un tope de 99,95 € incluye la pala de 99,95 €); «1.200» → 1200. */
function parseAmount(whole: string, fraction: string | undefined): number {
  if (fraction === undefined) return Number(whole);
  if (fraction.length === 3) return Number(whole) * 1000 + Number(fraction);
  return Math.ceil(Number(`${whole}.${fraction}`));
}

/** Los importes que hay en un tramo de texto, en orden. */
function amountsIn(text: string): number[] {
  return [...text.matchAll(AMOUNT_VALUE)].map((match) => parseAmount(match[1], match[2]));
}

/** «entre 100 y 150 euros», «de 100 a 150 €», «200€ - 300€» */
const PRICE_RANGES = [
  new RegExp(String.raw`\bentre\s+${AMOUNT}\s*${CURRENCY}?\s*(?:y|e|a|-)\s*${AMOUNT}\s*${CURRENCY}?`, "g"),
  new RegExp(String.raw`\bde\s+${AMOUNT}\s*${CURRENCY}?\s*a\s+${AMOUNT}\s*${CURRENCY}`, "g"),
  new RegExp(String.raw`${AMOUNT}\s*${CURRENCY}?\s*[-–—]\s*${AMOUNT}\s*${CURRENCY}`, "g"),
];

/** «más de 200 euros», «desde 150», «a partir de 200 €», «> 100» («no más de» es un máximo) */
const PRICE_FLOOR = new RegExp(
  String.raw`(?:\bno menos de|(?<!\bno )\bmas de|\bdesde|\ba partir de|\bpor encima de|\bsuperior(?:es)? a|\bcomo minimo|\bminimo de|\bminimo|>)\s*${AMOUNT}\s*${CURRENCY}?`,
  "g",
);

/**
 * «menos de 120», «hasta 150 euros», «máximo 100», «< 120»; «max 100 €» y «150 €» solo
 * con la moneda: «max» y los números sueltos también están en nombres de modelo
 * («Extreme Max 2025», «Vertex 04»).
 */
const PRICE_CEILING = new RegExp(
  String.raw`(?:\b(?:por menos de|menos de|hasta|por debajo de|maximo de|maximo|no mas de)|<)\s*${AMOUNT}\s*(?:€|euros?|eur)?|\bmax\.?\s*${AMOUNT}\s*${CURRENCY}|${AMOUNT}\s*${CURRENCY}`,
  "g",
);

const isBudget = (amount: number) => amount >= MIN_BUDGET && amount <= MAX_BUDGET;

/** Sustituye un tramo por espacios: lo reconocido deja de buscarse sin mover el resto del texto. */
function mask(text: string, start: number, end: number): string {
  return `${text.slice(0, start)}${" ".repeat(end - start)}${text.slice(end)}`;
}

interface Span {
  start: number;
  end: number;
}

/**
 * Interpreta los importes del texto y devuelve el texto sin ellos. Solo se aplica
 * un presupuesto cuando hay un único precio máximo y nada más; en cualquier otro
 * caso no se filtra por precio y una nota dice qué se ha dejado sin aplicar.
 */
function interpretPrices(text: string, draft: Draft, quote: (span: Span) => string): string {
  let rest = text;
  const take = (pattern: RegExp): (Span & { amount: number })[] => {
    const found = [...rest.matchAll(pattern)]
      .map((match) => ({ start: match.index, end: match.index + match[0].length, amounts: amountsIn(match[0]) }))
      // Un importe fuera de lo que cuesta una pala no es un precio: se queda en el texto.
      .filter((item) => item.amounts.length > 0 && item.amounts.every(isBudget))
      .map((item) => ({ start: item.start, end: item.end, amount: item.amounts[0] }));
    for (const item of found) rest = mask(rest, item.start, item.end);
    return found;
  };

  const ranges = PRICE_RANGES.flatMap((pattern) => take(pattern));
  const floors = take(PRICE_FLOOR);
  const ceilings = take(PRICE_CEILING);

  const all = [...ranges, ...floors, ...ceilings].sort((a, b) => a.start - b.start);
  if (all.length === 0) return text;

  const single = ranges.length === 0 && floors.length === 0 && new Set(ceilings.map((item) => item.amount)).size === 1;
  if (single) {
    const [ceiling] = ceilings;
    add(draft, "maxPrice", ceiling.amount, `Hasta ${formatEuroCompact(ceiling.amount)}`, text.slice(ceiling.start, ceiling.end));
    return rest;
  }

  const quoted = all.map((item) => `«${quote(item)}»`).join(", ");
  if (all.length > 1) {
    draft.notes.push(`Hay varios importes (${quoted}) y no sabemos combinarlos: no hemos aplicado ningún filtro de precio.`);
  } else if (ranges.length === 1) {
    draft.notes.push(`No filtramos por rango de precios: ${quoted} no se ha aplicado. Puedes fijar un precio máximo en los filtros.`);
  } else {
    draft.notes.push(`No filtramos por precio mínimo: ${quoted} no se ha aplicado.`);
  }
  return rest;
}

/**
 * «alternativa (más barata) a …», «parecida a …», «similar a …», «como la …». Cada
 * palabra opcional va entera: «como elegir» no es «como el» + «egir». «Como» solo
 * apunta a un modelo si le sigue un artículo («como la vertex»).
 */
const REFERENCE =
  /\b(?:(?:alternativas?(?:\s+mas\s+barat[ao]s?)?|parecid[ao]s?|similar(?:es)?)\s+(?:(?:a|al|que|de)\s+)?(?:(?:la|el|las|los|esta|este)\s+)?|como\s+(?:la|el|las|los|esta|este)\s+)(?:pala\s+)?(.+)$/;

interface Token extends Span {
  word: string;
}

function tokenize(text: string): Token[] {
  return [...text.matchAll(/[a-z0-9.+]+/g)].map((match) => ({
    word: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function words(text: string): string[] {
  return tokenize(text).map((token) => token.word);
}

/** Dónde empieza la negación que precede a `index` («sin», «que no esté en»), o null si no la hay. */
function negationStart(text: string, index: number): number | null {
  const before = tokenize(text.slice(0, index));
  for (let i = before.length - 1, fillers = 0; i >= 0; i--) {
    if (NEGATORS.has(before[i].word)) return before[i].start;
    if (!NEGATION_FILLERS.has(before[i].word) || ++fillers > MAX_NEGATION_FILLERS) return null;
  }
  return null;
}

const notExcluded = (phrase: string) => `No sabemos excluir un criterio: «${phrase}» no se ha aplicado.`;

/** Interpreta lo escrito en el buscador. Con un texto que no reconoce devuelve solo el texto. */
export function interpretSearch(raw: string, context: SearchContext): SearchIntent {
  const original = raw.trim();
  if (original === "") return EMPTY;

  const draft: Draft = { filters: {}, detected: [], notes: [] };
  let text = fold(original);
  let reference: string | null = null;

  // Lo reconocido se tapa con espacios en vez de cortarse: las posiciones no se mueven y
  // las notas pueden citar lo que se escribió, con sus acentos.
  const typed = original.normalize("NFC").replace(/\s+/g, " ");
  const source = typed.length === text.length ? typed : text;
  const quote = (span: Span) => source.slice(span.start, span.end).trim();

  // 1. ¿Pide alternativas a un modelo? Lo que va detrás es el modelo, no criterios.
  const referenceMatch = REFERENCE.exec(text);
  if (referenceMatch && words(referenceMatch[1]).some((word) => !NOISE.has(word))) {
    reference = words(referenceMatch[1]).filter((word) => !NOISE.has(word)).join(" ");
    if (/mas barat/.test(referenceMatch[0])) draft.notes.push("Buscas una alternativa más barata: en la ficha del modelo está la pestaña «Más barata».");
    text = text.slice(0, referenceMatch.index);
  }

  // 2. Precios: un único máximo se aplica; mínimos, rangos y varios importes, no.
  text = interpretPrices(text, draft, quote);

  // 3. Frases: cobertura, temporadas, ofertas, balance, manejable. Una frase negada
  //    («sin oferta», «no disponible») no se convierte en el criterio contrario.
  for (const rule of PHRASE_RULES) {
    const match = rule.pattern.exec(text);
    if (!match) continue;
    const end = match.index + match[0].length;
    const negation = negationStart(text, match.index);
    if (negation !== null) {
      draft.notes.push(notExcluded(quote({ start: negation, end })));
      text = mask(text, negation, end);
      continue;
    }
    // Solo se quita del texto lo que de verdad se ha reconocido.
    if (rule.apply(match, draft, context)) text = mask(text, match.index, end);
  }

  // 4. Marcas (pueden tener varias palabras: «black crown», «drop shot»).
  for (const brand of [...context.brands].sort((a, b) => b.name.length - a.name.length)) {
    const name = fold(brand.name);
    const pattern = new RegExp(`(^|[^a-z0-9])${name.replace(/[^a-z0-9]+/g, "\\s*")}([^a-z0-9]|$)`);
    const match = pattern.exec(text);
    if (!match) continue;
    // La marca empieza tras el separador capturado y acaba antes del siguiente.
    const start = match.index + match[1].length;
    const end = match.index + match[0].length - match[2].length;
    // «Sin Nox», «que no sea de Bullpadel»: el catálogo no sabe excluir una marca.
    const negation = negationStart(text, start);
    if (negation !== null) {
      draft.notes.push(notExcluded(quote({ start: negation, end })));
      text = mask(text, negation, end);
      continue;
    }
    add(draft, "brands", [brand.slug], brand.name, brand.name);
    text = mask(text, start, end);
  }

  // 5. Palabra a palabra: forma, nivel, año y, con cuidado, estilo de juego.
  const tokens = tokenize(text);
  const rest: string[] = [];
  const styleCandidates: { style: PlayStyle; word: string; cued: boolean }[] = [];
  const criterionOf = (word: string) => ({
    shape: find(SHAPE_WORDS, word),
    level: find(LEVEL_WORDS, word),
    style: find(STYLE_WORDS, word),
    year: /^20\d\d$/.test(word) && context.years.includes(Number(word)) ? Number(word) : null,
  });
  const isCriterion = (word: string) => Object.values(criterionOf(word)).some((value) => value !== null);

  // «No diamante», «sin potencia», «ni redonda»: el catálogo no sabe excluir, así que
  // el criterio negado no se aplica (ni la negación se busca como texto) y se avisa.
  const negated = new Set<number>();
  tokens.forEach((token, index) => {
    if (!NEGATORS.has(token.word)) return;
    let target = index + 1;
    while (target - index <= MAX_NEGATION_FILLERS && NEGATION_FILLERS.has(tokens[target]?.word ?? "")) target++;
    if (target >= tokens.length || !isCriterion(tokens[target].word)) return;
    draft.notes.push(notExcluded(quote({ start: token.start, end: tokens[target].end })));
    for (let skipped = index; skipped <= target; skipped++) negated.add(skipped);
  });

  tokens.forEach(({ word }, index) => {
    if (negated.has(index)) return;
    const { shape, level, style, year } = criterionOf(word);

    if (shape) add(draft, "shapes", [shape], `Forma ${SHAPE_LABELS[shape].toLowerCase()}`, word);
    else if (level) add(draft, "levels", [level], `Nivel ${LEVEL_LABELS[level].toLowerCase()}`, word);
    else if (year !== null) add(draft, "years", [year], `Temporada ${year}`, word);
    else if (style) styleCandidates.push({ style, word, cued: STYLE_CUES.has(tokens[index - 1]?.word ?? "") });
    else rest.push(word);
  });

  // «control» y «potencia» también están en nombres de modelo («Hack Control»): solo
  // son un criterio si la frase lo pide o si no queda ningún otro texto que buscar.
  const meaningful = rest.filter((word) => !NOISE.has(word));
  for (const candidate of styleCandidates) {
    if (candidate.cued || meaningful.length === 0) {
      add(draft, "styles", [candidate.style], `Juego de ${STYLE_LABELS[candidate.style].toLowerCase()}`, candidate.word);
    } else {
      rest.push(candidate.word);
      draft.notes.push(`«${candidate.word}» puede ser parte del nombre de un modelo: lo hemos buscado como texto.`);
    }
  }

  // Sin ningún criterio reconocido ni nada que avisar, la búsqueda es la de siempre: el texto tal cual.
  if (draft.detected.length === 0 && reference === null && draft.notes.length === 0) return { ...EMPTY, text: original };

  return {
    filters: draft.filters,
    detected: draft.detected,
    text: (reference ?? rest.filter((word) => !NOISE.has(word)).join(" ")).trim(),
    reference,
    notes: draft.notes,
  };
}

function find<T extends string>(dictionary: Record<T, string[]>, word: string): T | null {
  for (const key of Object.keys(dictionary) as T[]) {
    if (dictionary[key].includes(word)) return key;
  }
  return null;
}

/**
 * La consulta que se ejecuta: los filtros elegidos a mano más los deducidos del
 * texto. Lo elegido a mano manda: un filtro deducido no pisa uno explícito del
 * mismo tipo (presupuesto, orden, colección), y en las listas se suman.
 */
export function applyIntent(query: CatalogQuery, intent: SearchIntent): CatalogQuery {
  // Una nota sin criterios también cuenta: lo que no se ha podido aplicar («más de 200 €»)
  // se ha quitado del texto y no debe buscarse como si fuera el nombre de una pala.
  if (intent.detected.length === 0 && intent.reference === null && intent.notes.length === 0) return query;
  const { filters } = intent;
  const merge = <T,>(explicit: T[], detected: T[] | undefined) => [...new Set([...explicit, ...(detected ?? [])])];

  return {
    ...query,
    q: intent.text,
    levels: merge<PlayerLevel>(query.levels, filters.levels),
    styles: merge<PlayStyle>(query.styles, filters.styles),
    brands: merge(query.brands, filters.brands),
    shapes: merge<PalaShape>(query.shapes, filters.shapes),
    balances: merge<PalaBalance>(query.balances, filters.balances),
    years: merge(query.years, filters.years),
    coverage: merge<CoverageId>(query.coverage, filters.coverage),
    maxPrice: query.maxPrice ?? filters.maxPrice ?? null,
    collection: query.collection === "todas" ? (filters.collection ?? query.collection) : query.collection,
    sort: query.sort === "disponibilidad" ? (filters.sort ?? query.sort) : query.sort,
  };
}

/**
 * Los criterios deducidos que de verdad rigen en la consulta ejecutada. Un filtro
 * elegido a mano del mismo tipo (presupuesto, orden, colección) pisa al deducido,
 * y el tope del deslizador anula un presupuesto: esos no se enseñan como aplicados.
 */
export function appliedCriteria(intent: SearchIntent, query: CatalogQuery): DetectedCriterion[] {
  return intent.detected.filter((criterion) => {
    switch (criterion.key) {
      case "maxPrice":
        return query.maxPrice === intent.filters.maxPrice;
      case "sort":
        return query.sort === intent.filters.sort;
      case "collection":
        return query.collection === intent.filters.collection;
      default:
        // Las listas (forma, marca, año…) se suman a lo elegido a mano: siempre se aplican.
        return true;
    }
  });
}

/** Por qué un criterio deducido no rige: lo pisó un filtro fijado a mano, o no deja fuera ninguna pala. */
export type UnappliedReason = "fijado-a-mano" | "sin-efecto";

export interface UnappliedCriterion {
  criterion: DetectedCriterion;
  reason: UnappliedReason;
}

/**
 * Los criterios deducidos que no rigen y el motivo. `explicit` es la consulta antes
 * de sumarle la interpretación (lo elegido a mano): si ya traía ese filtro, fue
 * ella la que mandó; si no, el criterio se anuló por otra razón (un presupuesto
 * por encima del precio máximo del catálogo no deja fuera ninguna pala).
 */
export function unappliedCriteria(intent: SearchIntent, query: CatalogQuery, explicit: CatalogQuery): UnappliedCriterion[] {
  const applied = new Set(appliedCriteria(intent, query));
  const setByHand: Record<"maxPrice" | "sort" | "collection", boolean> = {
    maxPrice: explicit.maxPrice !== null,
    sort: explicit.sort !== DEFAULT_QUERY.sort,
    collection: explicit.collection !== DEFAULT_QUERY.collection,
  };
  return intent.detected
    .filter((criterion) => !applied.has(criterion))
    .map((criterion) => ({
      criterion,
      reason:
        (criterion.key === "maxPrice" || criterion.key === "sort" || criterion.key === "collection") && setByHand[criterion.key]
          ? "fijado-a-mano"
          : "sin-efecto",
    }));
}

export interface Relaxation {
  /** Qué se quita: «Sin el presupuesto de 120 €» */
  label: string;
  query: CatalogQuery;
}

/**
 * Cuando no hay resultados: las consultas que resultan de quitar un solo
 * criterio cada vez. Sirven para decir cuál limita, no para aplicarlo sin avisar.
 */
export function relaxations(query: CatalogQuery): Relaxation[] {
  const base = { ...query, page: 1 };
  const options: (Relaxation | false)[] = [
    query.maxPrice !== null && {
      label: `Sin el presupuesto de ${formatEuroCompact(query.maxPrice)}`,
      query: { ...base, maxPrice: null },
    },
    query.coverage.length > 0 && { label: "Sin exigir precio disponible", query: { ...base, coverage: [] } },
    query.collection !== "todas" && { label: "Sin limitar a ofertas", query: { ...base, collection: "todas" } },
    query.shapes.length > 0 && { label: "Con cualquier forma", query: { ...base, shapes: [] } },
    query.balances.length > 0 && { label: "Con cualquier balance", query: { ...base, balances: [] } },
    query.styles.length > 0 && { label: "Con cualquier estilo de juego", query: { ...base, styles: [] } },
    query.levels.length > 0 && { label: "Para cualquier nivel", query: { ...base, levels: [] } },
    query.brands.length > 0 && { label: "De cualquier marca", query: { ...base, brands: [] } },
    query.years.length > 0 && { label: "De cualquier temporada", query: { ...base, years: [] } },
    query.q !== "" && { label: `Sin el texto «${query.q}»`, query: { ...base, q: "" } },
  ];
  return options.filter((option): option is Relaxation => Boolean(option));
}
