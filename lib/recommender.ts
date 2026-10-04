// Recomendador «Pala ideal»: seis preguntas y una puntuación por coincidencias.
// No hay IA ni notas inventadas: cada respuesta se compara con un dato declarado
// de la pala (nivel, estilo, forma, balance, peso) y el presupuesto es un límite.
import { BALANCE_LABELS, LEVEL_LABELS, SHAPE_LABELS, STYLE_LABELS } from "@/lib/labels";
import type { PalaBalance, PalaShape, PalaSummary, PlayerLevel, PlayStyle } from "@/types/catalog";

/** Tramos de peso, sobre el punto medio del rango que declara el fabricante (gramos). */
export const WEIGHT_BANDS = {
  ligera: { label: "Ligera (hasta 355 g)", min: 0, max: 355 },
  media: { label: "Media (355–370 g)", min: 355, max: 370 },
  pesada: { label: "Pesada (más de 370 g)", min: 370, max: 1000 },
} as const;

export type WeightBand = keyof typeof WEIGHT_BANDS;

export const BUDGETS = [100, 150, 200, 300] as const;

export interface RecommenderPrefs {
  level: PlayerLevel | null;
  style: PlayStyle | null;
  shape: PalaShape | null;
  balance: PalaBalance | null;
  weight: WeightBand | null;
  /** Precio máximo en euros: límite, no criterio de puntuación */
  maxPrice: number | null;
}

/** Criterios que puntúan: un punto por cada respuesta que la pala cumple. */
export type RecommenderCriterion = "level" | "style" | "shape" | "balance" | "weight";

export const CRITERION_LABELS: Record<RecommenderCriterion, string> = {
  level: "Tu nivel",
  style: "Tu estilo de juego",
  shape: "La forma",
  balance: "El balance",
  weight: "El peso",
};

export interface Recommendation {
  pala: PalaSummary;
  /** Respuestas que esta pala cumple */
  matched: RecommenderCriterion[];
}

/** Nombres de los parámetros en la URL */
export const RECOMMENDER_PARAMS = {
  level: "nivel",
  style: "estilo",
  shape: "forma",
  balance: "balance",
  weight: "peso",
  maxPrice: "presupuesto",
} as const;

type RawParams = Record<string, string | string[] | undefined>;

function pick<T extends string>(value: string, known: Record<T, unknown>): T | null {
  return Object.hasOwn(known, value) ? (value as T) : null;
}

export function parseRecommenderPrefs(params: RawParams): RecommenderPrefs {
  const first = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const maxPrice = Number(first(RECOMMENDER_PARAMS.maxPrice));

  return {
    level: pick(first(RECOMMENDER_PARAMS.level), LEVEL_LABELS),
    style: pick(first(RECOMMENDER_PARAMS.style), STYLE_LABELS),
    shape: pick(first(RECOMMENDER_PARAMS.shape), SHAPE_LABELS),
    balance: pick(first(RECOMMENDER_PARAMS.balance), BALANCE_LABELS),
    weight: pick(first(RECOMMENDER_PARAMS.weight), WEIGHT_BANDS),
    maxPrice: BUDGETS.find((budget) => budget === maxPrice) ?? null,
  };
}

/** Criterios a los que el jugador ha respondido (sin contar el presupuesto). */
export function answeredCriteria(prefs: RecommenderPrefs): RecommenderCriterion[] {
  const criteria: RecommenderCriterion[] = ["level", "style", "shape", "balance", "weight"];
  return criteria.filter((criterion) => prefs[criterion] !== null);
}

export function hasAnswers(prefs: RecommenderPrefs): boolean {
  return answeredCriteria(prefs).length > 0 || prefs.maxPrice !== null;
}

export function matchesWeight(band: WeightBand, min: number | null, max: number | null): boolean {
  if (min === null || max === null) return false;
  const middle = (min + max) / 2;
  const { min: low, max: high } = WEIGHT_BANDS[band];
  return middle > low && middle <= high;
}
