// Recomendador «Pala ideal»: seis preguntas y un recuento de coincidencias.
// No hay IA ni porcentajes inventados: cada respuesta se compara con un dato
// declarado de la pala (nivel, estilo, forma, balance, tacto) o con su precio de
// hoy, y la relevancia es, literalmente, cuántas respuestas cumple.
import { formatEuro } from "@/lib/format";
import { BALANCE_LABELS, formatLevels, SHAPE_LABELS, STYLE_LABELS } from "@/lib/labels";
import { routes } from "@/lib/routes";
import type {
  Pala,
  PalaBalance,
  PalaShape,
  PalaSummary,
  PlayerLevel,
  PlayStyle,
} from "@/types/catalog";

export type FinderSide = "drive" | "reves";
/** Tacto que prefiere el jugador, en los términos en que lo declaran las palas */
export type FinderTouch = "blando" | "medio-blando" | "medio" | "duro";

export interface RecommenderPrefs {
  level: PlayerLevel | null;
  style: PlayStyle | null;
  /** Lado de la pista; null si juega en los dos */
  side: FinderSide | null;
  /** Forma elegida: solo se recomiendan palas de esa forma */
  shape: PalaShape | null;
  touch: FinderTouch | null;
  /** Precio máximo de hoy, en euros */
  maxPrice: number | null;
}

/** Respuestas con las que se compara cada pala */
export type RecommenderCriterion = "level" | "style" | "side" | "shape" | "touch" | "budget";

export const CRITERION_LABELS: Record<RecommenderCriterion, string> = {
  level: "tu nivel",
  style: "tu estilo de juego",
  side: "tu lado de la pista",
  shape: "la forma",
  touch: "el tacto",
  budget: "tu presupuesto",
};

export interface Recommendation {
  pala: PalaSummary;
  /** Respuestas que esta pala cumple */
  matched: RecommenderCriterion[];
}

/**
 * El lado de la pista no es un dato de la pala: se traduce a una preferencia de
 * balance, como orientación. En el revés se remata más y suele preferirse balance
 * alto; en el drive, medio o bajo.
 */
export const SIDE_BALANCES: Record<FinderSide, PalaBalance[]> = {
  drive: ["bajo", "medio"],
  reves: ["alto"],
};

/**
 * Qué valores declarados corresponden a cada tacto que se puede pedir: el tacto
 * de la pala y, solo si no declara tacto, su dureza. «Duro» incluye el medio-duro.
 */
export const TOUCH_MATCHES: Record<FinderTouch, { touches: string[]; hardness: string | null }> = {
  blando: { touches: ["blando"], hardness: "blanda" },
  "medio-blando": { touches: ["medio-blando"], hardness: null },
  medio: { touches: ["medio"], hardness: "media" },
  duro: { touches: ["duro", "medio-duro"], hardness: "dura" },
};

const clean = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

/** true si la pala declara el tacto pedido: por su tacto o, si no lo declara, por su dureza. */
export function matchesTouch(
  wanted: FinderTouch,
  touch: string | null | undefined,
  hardness: string | null | undefined,
): boolean {
  const match = TOUCH_MATCHES[wanted];
  if (clean(touch) !== "") return match.touches.includes(clean(touch));
  return match.hardness !== null && clean(hardness) === match.hardness;
}

interface Option {
  /** Valor en la URL */
  value: string;
  label: string;
  description: string;
}

export interface FinderQuestion {
  id: RecommenderCriterion;
  /** Nombre del parámetro en la URL */
  param: string;
  eyebrow: string;
  title: string;
  /** Por qué lo preguntamos */
  why: string;
  options: Option[];
}

export const FINDER_QUESTIONS: FinderQuestion[] = [
  {
    id: "level",
    param: "nivel",
    eyebrow: "TU NIVEL",
    title: "¿Cuál es tu nivel?",
    why: "Las palas más exigentes castigan los golpes descentrados. Si estás empezando, una pala que perdone te hará disfrutar más.",
    options: [
      { value: "iniciacion", label: "Principiante", description: "Estoy empezando o juego de vez en cuando" },
      { value: "intermedio", label: "Intermedio", description: "Juego con regularidad y ya construyo puntos" },
      { value: "avanzado", label: "Avanzado", description: "Remato con soltura y busco rendimiento" },
      { value: "competicion", label: "Competición", description: "Juego torneos o ligas" },
    ],
  },
  {
    id: "style",
    param: "estilo",
    eyebrow: "TU JUEGO",
    title: "¿Cómo te gusta jugar?",
    why: "Es lo que más cambia de una pala a otra: dónde está el peso y cómo sale la bola.",
    options: [
      { value: "control", label: "Control", description: "Precisión y seguridad desde el fondo" },
      { value: "polivalente", label: "Equilibrio", description: "Un poco de todo, según el punto" },
      { value: "potencia", label: "Potencia", description: "Atacar, rematar y cerrar el punto" },
    ],
  },
  {
    id: "side",
    param: "lado",
    eyebrow: "TU POSICIÓN",
    title: "¿En qué lado juegas?",
    why: "En el revés se remata más, y suele convenir más potencia. En el drive se agradece el control.",
    options: [
      { value: "drive", label: "Drive", description: "Lado derecho de la pista" },
      { value: "reves", label: "Revés", description: "Lado izquierdo de la pista" },
      { value: "ambos", label: "Me da igual", description: "Juego en los dos lados" },
    ],
  },
  {
    id: "shape",
    param: "forma",
    eyebrow: "FORMA",
    title: "¿Qué forma de pala prefieres?",
    why: "La forma decide dónde está el punto dulce: abajo en la redonda, en el centro en la lágrima y arriba en la diamante.",
    options: [
      { value: "redonda", label: "Redonda", description: "Más control y más fácil" },
      { value: "lagrima", label: "Lágrima", description: "Equilibrio entre control y potencia" },
      { value: "diamante", label: "Diamante", description: "Más potencia, más exigente" },
      { value: "cualquiera", label: "Me da igual", description: "Recomiéndame tú" },
    ],
  },
  {
    id: "touch",
    param: "tacto",
    eyebrow: "TACTO",
    title: "¿Qué tacto prefieres?",
    why: "El tacto es cómo responde la pala al golpear. Los blandos suelen dar más salida de bola; los duros, más precisión en los golpes fuertes.",
    options: [
      { value: "blando", label: "Blando", description: "La bola sale con facilidad" },
      { value: "medio-blando", label: "Medio-blando", description: "Entre el blando y el medio" },
      { value: "medio", label: "Medio", description: "Un punto intermedio" },
      { value: "duro", label: "Duro", description: "Duro o medio-duro: más firme al golpear" },
      { value: "cualquiera", label: "Me da igual", description: "Recomiéndame tú" },
    ],
  },
  {
    id: "budget",
    param: "presupuesto",
    eyebrow: "PRESUPUESTO",
    title: "¿Cuánto quieres gastarte?",
    why: "Te enseñamos el mejor precio de hoy en las tiendas que seguimos, así que el presupuesto rinde más de lo que parece.",
    options: [
      { value: "100", label: "Hasta 100 €", description: "Buenas palas para empezar" },
      { value: "180", label: "100 – 180 €", description: "Gama media, mucha variedad" },
      { value: "250", label: "180 – 250 €", description: "Gama alta" },
      { value: "sin-limite", label: "Sin límite", description: "Quiero la mejor para mí" },
    ],
  },
];

/** Opción elegida en cada pregunta (su posición), o null si aún no se ha respondido */
export type FinderAnswers = (number | null)[];

export const NO_ANSWERS: FinderAnswers = FINDER_QUESTIONS.map(() => null);

type RawParams = Record<string, string | string[] | undefined>;

/** Lee las respuestas de la URL: solo valores conocidos. */
export function parseFinderAnswers(params: RawParams): FinderAnswers {
  return FINDER_QUESTIONS.map((question) => {
    const raw = params[question.param];
    const value = (Array.isArray(raw) ? raw[0] : raw) ?? "";
    const index = question.options.findIndex((option) => option.value === value);
    return index >= 0 ? index : null;
  });
}

export function isComplete(answers: FinderAnswers): boolean {
  return FINDER_QUESTIONS.every((_, i) => answers[i] !== null && answers[i] !== undefined);
}

/** URL del recomendador con esas respuestas: el resultado se puede compartir y recuperar. */
export function finderPath(answers: FinderAnswers): string {
  const params = new URLSearchParams();
  FINDER_QUESTIONS.forEach((question, i) => {
    const answer = answers[i];
    if (answer !== null && answer !== undefined) params.set(question.param, question.options[answer].value);
  });
  const qs = params.toString();
  return qs ? `${routes.idealPala}?${qs}` : routes.idealPala;
}

function valueOf(answers: FinderAnswers, id: RecommenderCriterion): string | null {
  const index = FINDER_QUESTIONS.findIndex((question) => question.id === id);
  const answer = answers[index];
  return answer === null || answer === undefined ? null : FINDER_QUESTIONS[index].options[answer].value;
}

/** De las respuestas a las preferencias con las que se busca. «Me da igual» no restringe. */
export function toPrefs(answers: FinderAnswers): RecommenderPrefs {
  const side = valueOf(answers, "side");
  const shape = valueOf(answers, "shape");
  const touch = valueOf(answers, "touch");
  const budget = Number(valueOf(answers, "budget"));

  return {
    level: valueOf(answers, "level") as PlayerLevel | null,
    style: valueOf(answers, "style") as PlayStyle | null,
    side: side === "drive" || side === "reves" ? side : null,
    shape: shape && shape !== "cualquiera" ? (shape as PalaShape) : null,
    touch: touch && touch in TOUCH_MATCHES ? (touch as FinderTouch) : null,
    maxPrice: Number.isFinite(budget) && budget > 0 ? budget : null,
  };
}

/** Respuestas en las que el jugador ha pedido algo concreto: sobre ellas se mide cada pala. */
export function expressedCriteria(prefs: RecommenderPrefs): RecommenderCriterion[] {
  const expressed: [RecommenderCriterion, boolean][] = [
    ["level", prefs.level !== null],
    ["style", prefs.style !== null],
    ["side", prefs.side !== null],
    ["shape", prefs.shape !== null],
    ["touch", prefs.touch !== null],
    ["budget", prefs.maxPrice !== null],
  ];
  return expressed.filter(([, asked]) => asked).map(([criterion]) => criterion);
}

/** Lo que se necesita saber de una pala para compararla con las respuestas */
export interface RacketTraits {
  levels: PlayerLevel[];
  playStyle: PlayStyle | null;
  shape: PalaShape;
  balance: PalaBalance | null;
  touch: string | null;
  hardness: string | null;
  /** Mejor precio vigente; null si no tiene */
  price: number | null;
}

/**
 * Respuestas que cumple una pala, o null si queda fuera: sin precio de hoy, por
 * encima del presupuesto o de otra forma que la elegida. Es la misma regla que
 * aplica la consulta de PostgreSQL.
 */
export function matchCriteria(prefs: RecommenderPrefs, racket: RacketTraits): RecommenderCriterion[] | null {
  if (racket.price === null) return null;
  if (prefs.maxPrice !== null && racket.price > prefs.maxPrice) return null;
  if (prefs.shape !== null && racket.shape !== prefs.shape) return null;

  const matched: [RecommenderCriterion, boolean][] = [
    ["level", prefs.level !== null && racket.levels.includes(prefs.level)],
    ["style", prefs.style !== null && racket.playStyle === prefs.style],
    ["side", prefs.side !== null && racket.balance !== null && SIDE_BALANCES[prefs.side].includes(racket.balance)],
    ["shape", prefs.shape !== null],
    ["touch", prefs.touch !== null && matchesTouch(prefs.touch, racket.touch, racket.hardness)],
    ["budget", prefs.maxPrice !== null],
  ];
  return matched.filter(([, ok]) => ok).map(([criterion]) => criterion);
}

/** Tacto declarado de una pala, tal y como figura en sus especificaciones. */
export function declaredTouch(pala: Pick<Pala, "specs">): string | null {
  return pala.specs.find((spec) => spec.label === "Tacto")?.value ?? null;
}

const SIDE_NAMES: Record<FinderSide, string> = { drive: "drive", reves: "revés" };

/**
 * Por qué encaja una pala, en frases: cada una cita el dato declarado de la pala
 * que coincide con una respuesta. Sin adjetivos que el dato no respalde.
 */
export function buildReasons(pala: Pala, prefs: RecommenderPrefs, matched: RecommenderCriterion[], max = 3): string[] {
  // El dato que coincide con el tacto pedido: el tacto de la pala o, si no lo declara, su dureza.
  const touch = declaredTouch(pala);
  const touchFact = touch
    ? `Declara un tacto ${touch.toLowerCase()}, el que prefieres`
    : pala.hardness
      ? `Declara una dureza ${pala.hardness.toLowerCase()}, la del tacto que prefieres`
      : null;
  const reasons: [RecommenderCriterion, string | null][] = [
    ["shape", `Es de forma ${SHAPE_LABELS[pala.shape].toLowerCase()}, la que buscas`],
    ["level", `Su nivel declarado (${formatLevels(pala.levels).toLowerCase()}) incluye el tuyo`],
    ["style", pala.playStyle ? `Su estilo de juego declarado es ${STYLE_LABELS[pala.playStyle].toLowerCase()}, como el tuyo` : null],
    ["touch", touchFact],
    [
      "side",
      pala.balance && prefs.side
        ? `Tiene balance ${BALANCE_LABELS[pala.balance].toLowerCase()}, la orientación habitual para el ${SIDE_NAMES[prefs.side]}`
        : null,
    ],
    ["budget", pala.price ? `Entra en tu presupuesto: hoy desde ${formatEuro(pala.price.current)}` : null],
  ];

  return reasons
    .filter(([criterion, text]) => text !== null && matched.includes(criterion))
    .map(([, text]) => text as string)
    .slice(0, max);
}

/** Las respuestas en etiquetas cortas, para el resumen «Tu perfil». */
export function profileChips(answers: FinderAnswers): string[] {
  const label = (id: RecommenderCriterion) => {
    const index = FINDER_QUESTIONS.findIndex((question) => question.id === id);
    const answer = answers[index];
    return answer === null || answer === undefined ? null : FINDER_QUESTIONS[index].options[answer];
  };
  const side = label("side");
  const shape = label("shape");
  const touch = label("touch");

  return [
    label("level")?.label,
    label("style")?.label,
    side?.value === "ambos" ? "Drive y revés" : side?.label,
    shape?.value === "cualquiera" ? "Cualquier forma" : shape?.label,
    touch && touch.value !== "cualquiera" ? `Tacto ${touch.label.toLowerCase()}` : null,
    label("budget")?.label,
  ].filter((chip): chip is string => Boolean(chip));
}
