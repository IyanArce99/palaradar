// Estadísticas del histórico de precios por periodo e índice de oportunidad.
// Trabajan sobre el mismo histórico que el veredicto de la ficha (lib/pricing.ts:
// el mejor precio de cada día entre las tiendas) y siguen su misma regla: de un
// periodo solo se habla cuando el seguimiento lo cubre entero. Con pocos días,
// cualquier precio es «el más bajo que hemos visto», y eso no es información.
import { HISTORY_WINDOW_DAYS, historyWindow, priceDaysAgo, toIsoDate, trackedSince } from "@/lib/pricing";
import type { PricePoint } from "@/types/catalog";
import type { PriceFreshness } from "@/types/pricing";

const DAY_MS = 86_400_000;

/** Periodos de los que se dan estadísticas, en días */
export const STAT_PERIODS = [30, 90] as const;
export type StatPeriod = (typeof STAT_PERIODS)[number];

/**
 * Parte de los días del periodo que deben tener precio registrado para dar sus
 * estadísticas: con menos, la media sale de unos pocos días sueltos.
 */
export const MIN_COVERAGE = 0.5;

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Mediana de una lista de números; null si está vacía. Con un número par de
 * valores es la media de los dos centrales, no el de arriba: con 2 € y 50 € la
 * mediana es 26 €, no 50 €.
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export interface PeriodStats {
  days: StatPeriod;
  /** Días del periodo con precio registrado */
  observations: number;
  average: number;
  min: PricePoint;
  max: PricePoint;
  /**
   * Variación entre el precio vigente al empezar el periodo y el actual, en tanto
   * por ciento (negativo: ha bajado)
   */
  changePercent: number;
}

/**
 * Estadísticas de un periodo; null si el seguimiento no lo cubre o hay demasiados
 * días sin precio.
 *
 * El periodo son exactamente `days` días naturales, hoy incluido, de modo que
 * nunca hay más observaciones que días. (La ventana del veredicto, en
 * lib/pricing.ts, incluye además el día de hace `days` días; aquí no.)
 *
 * El precio actual cuenta para el mínimo y el máximo aunque hoy todavía no
 * tenga registro en el histórico: es un precio observado del periodo.
 */
export function periodStats(
  history: PricePoint[],
  days: StatPeriod,
  current: number,
  now: Date,
): PeriodStats | null {
  // Precio vigente al empezar el periodo: sin él, el seguimiento no lo cubre.
  const start = priceDaysAgo(history, days, now);
  if (start === null) return null;
  const points = historyWindow(history, days - 1, now);
  if (points.length < Math.ceil(days * MIN_COVERAGE)) return null;

  const today = toIsoDate(now);
  const observed = [...points, { date: today, price: current }];
  const pick = (better: (a: number, b: number) => boolean) =>
    observed.reduce((best, point) => (better(point.price, best.price) ? point : best));

  return {
    days,
    observations: points.length,
    average: round2(points.reduce((sum, point) => sum + point.price, 0) / points.length),
    min: pick((a, b) => a < b),
    max: pick((a, b) => a > b),
    changePercent: start > 0 ? Math.round(((current - start) / start) * 100) : 0,
  };
}

export interface HistoryCoverage {
  /** Primer día con precio registrado (YYYY-MM-DD) */
  since: string;
  /** Días naturales transcurridos desde entonces, contando hoy */
  daysTracked: number;
  /** Días con precio registrado */
  observations: number;
  /** Días que faltan para cubrir la ventana del veredicto; 0 si ya está cubierta */
  daysUntilVerdict: number;
}

/** Cuánto histórico hay de una pala; null si todavía no hay ninguno. */
export function historyCoverage(history: PricePoint[], now: Date): HistoryCoverage | null {
  const since = trackedSince(history, now);
  if (since === null) return null;
  const today = Date.parse(`${toIsoDate(now)}T00:00:00Z`);
  const elapsed = Math.round((today - Date.parse(`${since}T00:00:00Z`)) / DAY_MS);

  return {
    since,
    daysTracked: elapsed + 1,
    observations: history.filter((point) => point.date.slice(0, 10) <= toIsoDate(now)).length,
    daysUntilVerdict: Math.max(0, HISTORY_WINDOW_DAYS - elapsed),
  };
}

// --- Índice de oportunidad ------------------------------------------------------
//
// Una escala de 0 a 100 que resume, para quien no quiere leer un gráfico, cómo de
// bueno es el precio de hoy frente a lo que la pala ha costado en los últimos 30
// días. No es una predicción ni una medida científica: es una suma de tres
// señales, cada una con su tope, sobre los datos que tenemos.
//
//   50                     punto de partida: «lo que suele costar»
//   ± hasta 30             frente a la media de 30 días (cada 1 % por debajo suma 2,5)
//   ± hasta 15             posición entre el mínimo y el máximo del periodo
//   ± 5                    tendencia: si ha bajado o subido en los últimos 7 días
//
// Solo se calcula con los 30 días cubiertos y un precio comprobado. La confianza
// se da aparte y depende de cuántos días tienen precio registrado.

export const INDEX_BASE = 50;
const AVERAGE_POINTS_PER_PERCENT = 2.5;
const AVERAGE_CAP = 30;
const RANGE_CAP = 15;
const TREND_POINTS = 5;
const TREND_DAYS = 7;
/**
 * Lo más antiguo que puede ser el precio con el que se compara la tendencia: si
 * el último registro anterior a la semana es más viejo, no se sabe cuándo cambió.
 */
const TREND_MAX_AGE_DAYS = 10;
/** Variación mínima en 7 días para hablar de tendencia */
const TREND_THRESHOLD = 0.01;
/** Parte de los días con precio a partir de la cual la confianza es alta o media */
const HIGH_COVERAGE = 0.85;
const MEDIUM_COVERAGE = 0.65;

export type OpportunityConfidence = "alta" | "media" | "baja";

export interface OpportunityIndex {
  /** De 0 a 100; 50 es lo que la pala suele costar */
  score: number;
  confidence: OpportunityConfidence;
  /** Por qué sale esa puntuación, en frases */
  reasons: string[];
}

function confidenceOf(coverage: number, freshness: PriceFreshness): OpportunityConfidence {
  if (freshness === "current" && coverage >= HIGH_COVERAGE) return "alta";
  return coverage >= MEDIUM_COVERAGE ? "media" : "baja";
}

const clamp = (value: number, cap: number) => Math.max(-cap, Math.min(cap, value));

/** Precio de hace una semana, solo si hay un registro de esos días (no uno de hace un mes). */
function recentWeekAgoPrice(history: PricePoint[], now: Date): number | null {
  const today = Date.parse(`${toIsoDate(now)}T00:00:00Z`);
  const newest = today - TREND_DAYS * DAY_MS;
  const oldest = today - TREND_MAX_AGE_DAYS * DAY_MS;
  const point = history.findLast((item) => {
    const time = Date.parse(`${item.date.slice(0, 10)}T00:00:00Z`);
    return time <= newest && time >= oldest;
  });
  return point?.price ?? null;
}

/**
 * Índice de oportunidad del precio actual. null si el precio está sin confirmar
 * o si el histórico no cubre 30 días con observaciones suficientes.
 *
 * `verdictAverage` es la media de 30 días con la que la ficha da su veredicto
 * (`PriceSummary.average30`): si se pasa, el índice usa esa misma cifra, para que
 * la frase «un X % por debajo de su media» no difiera de la del veredicto.
 */
export function opportunityIndex(
  history: PricePoint[],
  current: number,
  freshness: PriceFreshness,
  now: Date,
  verdictAverage: number | null = null,
): OpportunityIndex | null {
  if (freshness === "stale" || !(current > 0)) return null;
  const stats = periodStats(history, HISTORY_WINDOW_DAYS as StatPeriod, current, now);
  const average = verdictAverage ?? stats?.average ?? 0;
  if (!stats || !(average > 0)) return null;

  const reasons: string[] = [];
  const belowAverage = ((average - current) / average) * 100;
  const averagePoints = clamp(belowAverage * AVERAGE_POINTS_PER_PERCENT, AVERAGE_CAP);
  const rounded = Math.round(Math.abs(belowAverage));
  if (rounded === 0) reasons.push("Está en su precio medio de los últimos 30 días.");
  else {
    reasons.push(
      `Está un ${rounded} % ${belowAverage > 0 ? "por debajo" : "por encima"} de su precio medio de los últimos 30 días.`,
    );
  }

  // El mínimo y el máximo ya incluyen el precio de hoy (periodStats).
  const range = stats.max.price - stats.min.price;
  let rangePoints = 0;
  if (range > 0) {
    const position = (current - stats.min.price) / range;
    rangePoints = clamp(RANGE_CAP - 2 * RANGE_CAP * position, RANGE_CAP);
    if (current <= stats.min.price) reasons.push("Es el precio más bajo que hemos registrado en ese periodo.");
    else if (current >= stats.max.price) reasons.push("Es el precio más alto que hemos registrado en ese periodo.");
  } else {
    reasons.push("Su precio no ha cambiado en ese periodo.");
  }

  const weekAgo = recentWeekAgoPrice(history, now);
  let trendPoints = 0;
  if (weekAgo !== null && weekAgo > 0) {
    const change = (current - weekAgo) / weekAgo;
    if (change <= -TREND_THRESHOLD) {
      trendPoints = TREND_POINTS;
      reasons.push("Ha bajado en la última semana.");
    } else if (change >= TREND_THRESHOLD) {
      trendPoints = -TREND_POINTS;
      reasons.push("Ha subido en la última semana.");
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(INDEX_BASE + averagePoints + rangePoints + trendPoints)));
  const coverage = stats.observations / HISTORY_WINDOW_DAYS;
  // Cada motivo de menor confianza se dice: pueden darse los dos a la vez.
  if (coverage < HIGH_COVERAGE) {
    reasons.push(
      `Solo hay precio registrado en ${stats.observations} de los últimos ${HISTORY_WINDOW_DAYS} días: tómalo como orientación.`,
    );
  }
  if (freshness !== "current") {
    reasons.push("El precio no se ha comprobado en las últimas horas: confírmalo en la tienda.");
  }

  return { score, confidence: confidenceOf(coverage, freshness), reasons };
}
