// Lo que una guía dice de cada pala seleccionada. Todo sale de los datos de la
// pala: su puntuación en la fuente externa y sus atributos declarados. Aquí no
// hay adjetivos que un dato no respalde.
import type { GuideDoc } from "@/content/guides";
import { formatRating } from "@/lib/format";
import { BALANCE_LABELS, formatLevels, SHAPE_LABELS } from "@/lib/labels";
import { scoreHighlights } from "@/lib/pala-content";
import type { Pala } from "@/types/catalog";

const WORDS_PER_MINUTE = 200;

function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Minutos de lectura de una guía, a partir de su texto. */
export function readingMinutes(guide: GuideDoc): number {
  const total = [
    ...guide.intro,
    ...guide.picks.map((pick) => pick.why),
    ...guide.blocks.flatMap((block) => block.paragraphs),
    ...guide.faq.flatMap((item) => [item.question, item.answer]),
  ].reduce((sum, text) => sum + words(text), 0);
  return Math.max(1, Math.round(total / WORDS_PER_MINUTE));
}

/** «Diamante · balance alto · avanzado · competición»: los datos declarados que definen la pala. */
export function pickTraits(pala: Pick<Pala, "shape" | "balance" | "levels">): string {
  return [
    SHAPE_LABELS[pala.shape],
    pala.balance ? `balance ${BALANCE_LABELS[pala.balance].toLowerCase()}` : null,
    pala.levels.length > 0 ? formatLevels(pala.levels).toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Por qué sale esta pala en el apartado: el criterio de selección, con su cifra. */
export function pickReason(pala: Pick<Pala, "sourceRatings">, score: number | null): string {
  if (score === null || !pala.sourceRatings) {
    return "Es la primera pala del catálogo que cumple este criterio y tiene precio hoy.";
  }
  return `Tiene un ${formatRating(score)} sobre 10 de puntuación técnica total en ${pala.sourceRatings.source}: la más alta de este apartado entre las palas con precio hoy en las tiendas que seguimos.`;
}

export interface PickHighlights {
  /** Aspectos mejor puntuados, con su nota: «Potencia (9,5)» */
  best: string[];
  /** Aspecto peor puntuado, con su nota */
  weakest: string | null;
}

/** Lo mejor y lo menos alto de la pala según las puntuaciones por aspecto de la fuente. */
export function pickHighlights(pala: Pick<Pala, "sourceRatings">): PickHighlights {
  // La misma regla que la ficha (lib/pala-content.ts): sin diferencia entre notas, no se destaca ninguna.
  const highlights = scoreHighlights(pala);
  return highlights ? { best: highlights.best, weakest: highlights.weakest } : { best: [], weakest: null };
}
