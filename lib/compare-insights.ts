// Lo que el comparador dice de dos o tres palas más allá de su ficha técnica:
// puntuaciones enfrentadas, «¿Cuál elegir?», lectura del precio, preguntas
// frecuentes y tarjetas de otras comparaciones. Todo se genera con datos:
//   · puntuaciones técnicas de la fuente externa (PadelZoom), nombrada siempre;
//   · atributos declarados (forma, balance, estilo, nivel, peso);
//   · precios vigentes y PVPR.
// No hay opiniones ni puntuaciones de PalaRadar: si falta un dato, la frase no sale.
import {
  canonicalPair,
  comparePath,
  describeDifferences,
  uniquePairs,
} from "@/lib/compare";
import { formatEuro, formatEuroCompact, formatPercent, formatRating, formatWeight } from "@/lib/format";
import { BALANCE_LABELS, LEVEL_LABELS, SHAPE_LABELS, STYLE_LABELS } from "@/lib/labels";
import { isProductPhoto } from "@/lib/media";
import { msrpSaving } from "@/lib/pricing";
import type { FaqItem, Pala, PalaShape, PalaSummary, PricePoint } from "@/types/catalog";

/** Por debajo de esta diferencia de puntuación, dos palas se dan por «muy parecidas» */
export const SIMILAR_SCORE_GAP = 0.3;
/** A partir de esta diferencia, la ventaja entra en «¿Cuál elegir?» */
export const NOTABLE_SCORE_GAP = 1;
/** Diferencia mínima de peso que se menciona (gramos), como en «En qué se diferencian» */
const MIN_WEIGHT_GAP = 5;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** «la Vertex 05», «la Hack 04 o la Metalbone 3.4», «la A, la B o la C» */
function nameList(palas: Pala[], conjunction: "o" | "y"): string {
  const names = palas.map((pala) => `la ${pala.model}`);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${conjunction} ${names.at(-1)}`;
}

/** Precio vigente de una pala: uno caducado no se compara como si fuera actual. */
export function currentPriceOf(pala: Pala): number | null {
  return pala.price && pala.price.freshness !== "stale" ? pala.price.current : null;
}

// ───────────────────────── Puntuaciones ─────────────────────────

export interface ScoreRow {
  label: string;
  /** Una puntuación por pala (0–10), en su orden; null si la fuente no la da */
  scores: (number | null)[];
  /** La pala con más puntuación y su ventaja sobre la siguiente; null: «muy parecidas» */
  lead: { index: number; gap: number } | null;
}

export interface ScoreComparison {
  /** Nombre de la fuente de las puntuaciones, tal y como se enseña */
  source: string;
  rows: ScoreRow[];
}

/**
 * Puntuaciones técnicas enfrentadas. Solo hay comparación si al menos dos palas
 * las tienen, y solo entran los aspectos puntuados en dos o más.
 */
export function buildScoreRows(palas: Pala[]): ScoreComparison | null {
  const rated = palas.filter((pala) => pala.sourceRatings !== null);
  const [first] = rated;
  if (rated.length < 2 || !first?.sourceRatings) return null;

  const labels = [...new Set(rated.flatMap((pala) => pala.sourceRatings?.scores.map((s) => s.label) ?? []))];
  const rows = labels.flatMap((label): ScoreRow[] => {
    const scores = palas.map(
      (pala) => pala.sourceRatings?.scores.find((aspect) => aspect.label === label)?.score ?? null,
    );
    const ranked = scores
      .flatMap((score, index) => (score === null ? [] : [{ score, index }]))
      .sort((x, y) => y.score - x.score);
    if (ranked.length < 2) return [];

    const gap = round1(ranked[0].score - ranked[1].score);
    return [{ label, scores, lead: gap >= SIMILAR_SCORE_GAP ? { index: ranked[0].index, gap } : null }];
  });

  return rows.length > 0 ? { source: first.sourceRatings.source, rows } : null;
}

// ───────────────────────── ¿Cuál elegir? ─────────────────────────

/** Cómo se nombra cada aspecto en «Si priorizas…» */
const ASPECT_PHRASES: Record<string, string> = {
  Potencia: "la potencia",
  Control: "el control",
  "Salida de bola": "la salida de bola",
  Manejabilidad: "la manejabilidad",
  "Punto dulce": "el punto dulce",
};

/** Aspectos que puntúa la fuente, con el nombre que llevan en la comparación */
export const SCORE_ASPECTS = Object.keys(ASPECT_PHRASES);

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function shapeAndBalance(pala: Pala): string {
  const shape = `forma ${SHAPE_LABELS[pala.shape].toLowerCase()}`;
  return pala.balance ? `${shape} y balance ${BALANCE_LABELS[pala.balance].toLowerCase()}` : shape;
}

function levelList(pala: Pala): string {
  return pala.levels.map((level) => LEVEL_LABELS[level].toLowerCase()).join(" y ");
}

/** Índice de la pala más barata hoy y lo que le saca a la siguiente; null si no todas tienen precio vigente o hay empate. */
function cheapest(palas: Pala[]): { index: number; price: number; gap: number } | null {
  const prices = palas.map(currentPriceOf);
  if (prices.some((price) => price === null)) return null;

  const ranked = (prices as number[]).map((price, index) => ({ price, index })).sort((x, y) => x.price - y.price);
  const gap = round2(ranked[1].price - ranked[0].price);
  return gap > 0 ? { ...ranked[0], gap } : null;
}

/** La más ligera, si todas declaran peso y la diferencia de puntos medios se nota. */
function lightest(palas: Pala[]): { index: number; grams: number; exact: boolean } | null {
  if (palas.some((pala) => pala.weight === null)) return null;

  const ranked = palas
    .map((pala, index) => ({ middle: ((pala.weight?.min ?? 0) + (pala.weight?.max ?? 0)) / 2, index }))
    .sort((x, y) => x.middle - y.middle);
  const grams = Math.round(ranked[1].middle - ranked[0].middle);
  if (grams < MIN_WEIGHT_GAP) return null;
  return { index: ranked[0].index, grams, exact: palas.every((pala) => pala.weight?.min === pala.weight?.max) };
}

export interface Verdict {
  /** Ventajas de cada pala, en su orden: frases cortas, todas con un dato detrás */
  advantages: string[][];
  /** «Si priorizas X → pala»: como mucho una por pala */
  summary: { index: number; text: string }[];
  /** Fuente de las puntuaciones usadas; null si no ha entrado ninguna */
  source: string | null;
}

/**
 * Ventajas por puntuación de la pala `index`: los aspectos en los que va por
 * delante. Con un punto o más es «más»; con menos (pero ya distinguible), «algo más».
 */
function scoreAdvantages(rows: ScoreRow[], index: number, pair: boolean): string[] {
  return rows.flatMap((row) => {
    if (row.lead?.index !== index) return [];
    const own = row.scores[index];
    if (own === null) return [];

    const label = row.label.toLowerCase();
    if (!pair) return [`La de más ${label}: ${formatRating(own)} sobre 10`];
    const more = row.lead.gap >= NOTABLE_SCORE_GAP ? "Más" : "Algo más de";
    return [`${more} ${label}: ${formatRating(own)} frente a ${formatRating(round1(own - row.lead.gap))}`];
  });
}

/** true si el valor de la pala `index` no lo comparte ninguna de las demás. */
function isOwn<T>(values: T[], index: number): boolean {
  return values.every((value, i) => i === index || value !== values[index]);
}

/** Forma y balance de la pala, contando solo lo que la distingue de las demás. */
function shapeLine(palas: Pala[], index: number): string | null {
  const pala = palas[index];
  const ownShape = isOwn(palas.map((item) => item.shape), index);
  // El balance solo se compara si todas lo declaran: «sin datos» no es una diferencia.
  const ownBalance =
    palas.every((item) => item.balance !== null) && isOwn(palas.map((item) => item.balance), index);

  if (ownShape && ownBalance) return capitalize(shapeAndBalance(pala));
  if (ownShape) return `Forma ${SHAPE_LABELS[pala.shape].toLowerCase()}`;
  return ownBalance && pala.balance ? `Balance ${BALANCE_LABELS[pala.balance].toLowerCase()}` : null;
}

/** Ventajas por atributos declarados: solo los que la pala no comparte con ninguna otra. */
function declaredAdvantages(palas: Pala[], index: number): string[] {
  const pala = palas[index];
  const lines: string[] = [];

  const shape = shapeLine(palas, index);
  if (shape) lines.push(shape);
  if (pala.playStyle && isOwn(palas.map((item) => item.playStyle), index)) {
    lines.push(`Estilo de juego declarado: ${STYLE_LABELS[pala.playStyle].toLowerCase()}`);
  }
  if (pala.levels.length > 0 && isOwn(palas.map(levelList), index)) {
    lines.push(`Nivel declarado: ${levelList(pala)}`);
  }
  return lines;
}

/**
 * «¿Cuál elegir?»: lo que distingue a cada pala, sin opinar. Entran las
 * puntuaciones en las que va por delante, los atributos declarados que no
 * coinciden, el peso y la diferencia de precio de hoy.
 */
export function buildVerdict(palas: Pala[]): Verdict {
  const scores = buildScoreRows(palas);
  const rows = scores?.rows ?? [];
  const pair = palas.length === 2;
  const light = lightest(palas);
  const cheap = cheapest(palas);

  const advantages = palas.map((pala, index) => {
    const lines = [...scoreAdvantages(rows, index, pair), ...declaredAdvantages(palas, index)];

    if (light?.index === index) {
      lines.push(
        pair
          ? `Pesa ${light.exact ? "" : "de media "}${light.grams} g menos`
          : `La más ligera: ${pala.weight ? formatWeight(pala.weight) : ""}`,
      );
    }
    if (cheap?.index === index) {
      lines.push(pair ? `${formatEuro(cheap.gap)} más barata hoy` : `La más barata hoy: ${formatEuro(cheap.price)}`);
    }
    return lines;
  });

  // El resumen sale del aspecto con más ventaja a favor de cada pala; sin él, del precio.
  const summary = palas.flatMap((_, index) => {
    const best = rows
      .filter((row) => row.lead?.index === index)
      .sort((x, y) => (y.lead?.gap ?? 0) - (x.lead?.gap ?? 0))[0];
    if (best) return [{ index, text: `Si priorizas ${ASPECT_PHRASES[best.label] ?? best.label.toLowerCase()}` }];
    if (cheap?.index === index) return [{ index, text: "Si buscas el precio más bajo hoy" }];
    return [];
  });

  const usedScores = rows.some((row) => row.lead !== null);
  return { advantages, summary, source: usedScores && scores ? scores.source : null };
}

// ───────────────────────── Precio ─────────────────────────

export interface PriceFacts {
  /** Precio vigente; null si no tiene o está caducado */
  current: number | null;
  /** PVPR, solo si el precio vigente está por debajo */
  msrp: number | null;
  saving: { amount: number; percent: number } | null;
  /** Mínimo de los últimos 30 días; null sin histórico suficiente */
  min30: PricePoint | null;
  /** Tiendas que la tienen en stock */
  inStock: number;
}

/** Tiendas que declaran la pala en stock, entre las ofertas vigentes. */
export function inStockCount(pala: Pala): number {
  if (currentPriceOf(pala) === null || !pala.price) return 0;
  return pala.price.offers.filter((offer) => /^en stock/i.test(offer.availability.trim())).length;
}

/** Los datos de precio de una pala que enseña la comparación. */
export function priceFacts(pala: Pala): PriceFacts {
  const current = currentPriceOf(pala);
  const percent = current === null ? null : msrpSaving(current, pala.msrp);
  const saving =
    current !== null && percent !== null && pala.msrp !== null
      ? { amount: round2(pala.msrp - current), percent }
      : null;

  return {
    current,
    msrp: saving ? pala.msrp : null,
    saving,
    min30: current === null ? null : (pala.price?.min30 ?? null),
    inStock: inStockCount(pala),
  };
}

export interface PriceConclusion {
  before: string;
  /** La parte que se destaca en negrita */
  strong: string;
  after: string;
}

function stockSentence(palas: Pala[]): string {
  if (!palas.every((pala) => inStockCount(pala) > 0)) return "";
  return palas.length === 2 ? " Las dos están en stock." : " Las tres están en stock.";
}

/** Con dos palas: cuál tiene más descuento sobre su PVPR, si las dos lo tienen. */
function discountClause(cheaper: Pala, other: Pala): string {
  const a = priceFacts(cheaper).saving;
  const b = priceFacts(other).saving;
  if (!a || !b || a.percent === b.percent) return "";

  return a.percent > b.percent
    ? ` y tiene más descuento sobre su PVPR (${formatPercent(a.percent)} frente a ${formatPercent(b.percent)})`
    : `, aunque la ${other.model} tiene más descuento sobre su PVPR (${formatPercent(b.percent)} frente a ${formatPercent(a.percent)})`;
}

/** «¿Cuál sale mejor de precio?», en una frase. null si ninguna tiene precio vigente. */
export function priceConclusion(palas: Pala[]): PriceConclusion | null {
  const priced = palas.filter((pala) => currentPriceOf(pala) !== null);
  if (priced.length === 0) return null;
  if (priced.length < palas.length) {
    const verb = priced.length === 1 ? "tiene" : "tienen";
    return {
      before: "Hoy solo ",
      strong: `${nameList(priced, "y")} ${verb} precio`,
      after: " en las tiendas que seguimos.",
    };
  }

  const cheap = cheapest(palas);
  if (!cheap) {
    const all = palas.length === 2 ? "Las dos" : "Las tres";
    return { before: "", strong: `${all} cuestan lo mismo hoy`, after: `.${stockSentence(palas)}` };
  }

  const winner = palas[cheap.index];
  if (palas.length === 2) {
    const other = palas[1 - cheap.index];
    return {
      before: "Hoy ",
      strong: `la ${winner.model} es ${formatEuro(cheap.gap)} más barata`,
      after: `${discountClause(winner, other)}.${stockSentence(palas)}`,
    };
  }
  return {
    before: "Hoy ",
    strong: `la ${winner.model} es la más barata`,
    after: `, a ${formatEuro(cheap.price)}.${stockSentence(palas)}`,
  };
}

// ───────────────────────── Preguntas frecuentes ─────────────────────────

function scoreQuestion(palas: Pala[], scores: ScoreComparison, label: string): FaqItem[] {
  const row = scores.rows.find((item) => item.label === label);
  if (!row) return [];

  const aspect = label.toLowerCase();
  const figures = palas
    .flatMap((pala, i) => (row.scores[i] === null ? [] : [`${pala.model}, ${formatRating(row.scores[i] ?? 0)}`]))
    .join("; ");
  const answer = row.lead
    ? `Según las puntuaciones técnicas de ${scores.source}, la ${palas[row.lead.index].model}. Sobre 10 en ${aspect}: ${figures}.`
    : `Según las puntuaciones técnicas de ${scores.source}, son muy parecidas en ${aspect}. Sobre 10: ${figures}.`;

  return [{ question: `¿Cuál tiene más ${aspect}, ${nameList(palas, "o")}?`, answer }];
}

/** Preguntas frecuentes de la comparación, respondidas solo con los datos de las palas. */
export function comparisonFaq(palas: Pala[]): FaqItem[] {
  const items: FaqItem[] = [];
  const scores = buildScoreRows(palas);
  if (scores) {
    items.push(...scoreQuestion(palas, scores, "Potencia"), ...scoreQuestion(palas, scores, "Control"));
  }

  if (palas.every((pala) => pala.levels.length > 0)) {
    const [first, ...rest] = palas;
    const others = rest.map((pala) => `; la ${pala.model}, para nivel ${levelList(pala)}`).join("");
    items.push({
      question: "¿Para qué nivel de juego es cada una?",
      answer: `La ${first.model} está declarada para nivel ${levelList(first)}${others}.`,
    });
  }

  if (palas.length === 2) {
    const [a, b] = palas;
    items.push({
      question: `¿En qué se diferencian ${nameList(palas, "y")}?`,
      answer: describeDifferences(a, b).join(" "),
    });
  }

  const priced = palas.filter((pala) => currentPriceOf(pala) !== null);
  if (priced.length >= 2) {
    const prices = priced.map((pala) => `la ${pala.model} está a ${formatEuro(currentPriceOf(pala) ?? 0)}`);
    const cheap = priced.length === palas.length ? cheapest(palas) : null;
    const gap = cheap && palas.length === 2 ? `: ${formatEuro(cheap.gap)} de diferencia` : "";
    items.push({
      question: "¿Cuál está más barata ahora?",
      answer: `Hoy ${prices.slice(0, -1).join(", ")} y ${prices.at(-1)}${gap}. Los precios cambian: en cada ficha está el de cada tienda.`,
    });
  }

  return items;
}

// ───────────────────────── Tarjetas de otras comparaciones ─────────────────────────

/** Lo mínimo de una pala para una tarjeta de comparación */
export interface CardPala {
  slug: string;
  brand: string;
  model: string;
  year: number;
  shape: PalaShape;
  image: string | null;
  /** Precio vigente; null si no tiene */
  price: number | null;
}

export interface ComparisonCard {
  a: CardPala;
  b: CardPala;
  href: string;
  /** «Lágrima vs Diamante · desde 229 €» */
  meta: string;
}

export function cardPalaFromSummary(pala: PalaSummary): CardPala {
  return {
    slug: pala.slug,
    brand: pala.brand.name,
    model: pala.model,
    year: pala.year,
    shape: pala.shape,
    image: pala.image,
    price: pala.price,
  };
}

export function cardPalaFromPala(pala: Pala): CardPala {
  return {
    slug: pala.slug,
    brand: pala.brand.name,
    model: pala.model,
    year: pala.year,
    shape: pala.shape,
    image: pala.images[0] ?? null,
    price: currentPriceOf(pala),
  };
}

/** Tarjeta de una comparación, con las palas en el orden canónico de su URL. */
export function comparisonCard(x: CardPala, y: CardPala): ComparisonCard {
  const [first] = canonicalPair(x.slug, y.slug);
  const [a, b] = first === x.slug ? [x, y] : [y, x];

  // Dos temporadas del mismo modelo se distinguen por el año, no por la forma.
  const sameModel = a.brand === b.brand && a.model === b.model;
  const traits = sameModel ? `${a.year} vs ${b.year}` : `${SHAPE_LABELS[a.shape]} vs ${SHAPE_LABELS[b.shape]}`;
  const prices = [a.price, b.price].filter((price): price is number => price !== null);
  const from = prices.length > 0 ? ` · desde ${formatEuroCompact(Math.min(...prices))}` : "";

  return { a, b, href: comparePath(a.slug, b.slug), meta: `${traits}${from}` };
}

/**
 * Comparaciones destacadas de la portada del comparador: pares curados (palas
 * «parecidas») en los que las dos tienen precio vigente y foto real. No hay
 * datos de visitas, así que no es un ranking: se reparten para que no se repita
 * siempre la misma pala y, a igualdad, van primero las que están en más tiendas.
 */
export function pickFeaturedPairs(
  pairs: [string, string][],
  summaries: PalaSummary[],
  limit: number,
): ComparisonCard[] {
  const bySlug = new Map(summaries.map((pala) => [pala.slug, pala]));
  const showable = (pala: PalaSummary | undefined): pala is PalaSummary =>
    pala !== undefined && pala.price !== null && pala.image !== null && isProductPhoto(pala.image);

  const candidates = uniquePairs(pairs)
    .flatMap(([x, y]) => {
      const a = bySlug.get(x);
      const b = bySlug.get(y);
      return showable(a) && showable(b) ? [{ a, b, stores: a.storeCount + b.storeCount }] : [];
    })
    .sort((x, y) => y.stores - x.stores);

  const uses = new Map<string, number>();
  const used = (slug: string) => uses.get(slug) ?? 0;
  const picked: ComparisonCard[] = [];

  while (picked.length < limit && candidates.length > 0) {
    // La que menos repite palas ya enseñadas; el orden previo desempata.
    let best = 0;
    for (let i = 1; i < candidates.length; i++) {
      const cost = used(candidates[i].a.slug) + used(candidates[i].b.slug);
      if (cost < used(candidates[best].a.slug) + used(candidates[best].b.slug)) best = i;
    }
    const [{ a, b }] = candidates.splice(best, 1);
    uses.set(a.slug, used(a.slug) + 1);
    uses.set(b.slug, used(b.slug) + 1);
    picked.push(comparisonCard(cardPalaFromSummary(a), cardPalaFromSummary(b)));
  }

  return picked;
}

/** Comparaciones en siete días a partir de las cuales se enseña «Comparaciones recientes» */
export const RECENT_MIN_WEEKLY = 20;

/** Actividad real del comparador. Sin registro de actividad, va vacía y el bloque no aparece. */
export interface RecentActivity {
  /** Comparaciones abiertas en los últimos siete días */
  weekCount: number;
  /** Las últimas, de más reciente a más antigua, con su instante (ISO) */
  items: { card: ComparisonCard; at: string }[];
}

/**
 * Comparaciones relacionadas con la que se está viendo: cada pala frente a sus
 * «parecidas» (pares curados), sin repetir las que ya están en pantalla.
 */
export function relatedComparisons(palas: Pala[], limit: number): ComparisonCard[] {
  const current = new Set(palas.map((pala) => pala.slug));
  const queues = palas.map((pala) =>
    pala.alternatives
      .filter((alternative) => !current.has(alternative.pala.slug))
      .map((alternative) => comparisonCard(cardPalaFromPala(pala), cardPalaFromSummary(alternative.pala))),
  );

  // Por turnos, para que salgan comparaciones de todas las palas y no solo de la primera.
  const cards = new Map<string, ComparisonCard>();
  const longest = Math.max(0, ...queues.map((queue) => queue.length));
  for (let turn = 0; turn < longest; turn++) {
    for (const queue of queues) {
      const card = queue[turn];
      if (card && !cards.has(card.href)) cards.set(card.href, card);
    }
  }
  return [...cards.values()].slice(0, limit);
}
