import type { PricePoint, StoreOffer } from "@/types/catalog";
import type {
  PriceStats,
  PriceStatus,
  PriceSummary,
  PriceVerdict,
  RankedOffer,
} from "@/types/pricing";
import { formatDate, formatEuroCompact, formatMonthYear, formatPercent } from "./format";

// Toda la lógica de precios recibe `now` de forma explícita: la fecha actual es
// un dato de entrada, nunca "el último registro del histórico".

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const AVERAGE_WINDOW_DAYS = 90;
const MONTH_DAYS = 30;
const DAYS_PER_MONTH = 30.5;

/** Un precio sin comprobar durante más tiempo se considera desactualizado. */
export const PRICE_STALE_AFTER_HOURS = 48;

// Umbrales del veredicto de precio
const AT_MIN_RATIO = 1.03;
const NEAR_MIN_RATIO = 1.1;
const GOOD_BELOW_AVERAGE = 0.08;
const WAIT_BELOW_AVERAGE = 0.03;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** "2026-10-03T09:00:00Z" → "2026-10-03" */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayTime(isoDate: string): number {
  return Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
}

export function rankOffers(offers: StoreOffer[]): RankedOffer[] {
  return offers
    .map((offer) => ({ ...offer, total: round2(offer.price + offer.shipping) }))
    .sort((a, b) => a.total - b.total);
}

/** Registros del histórico entre hace `days` días y hoy, ambos incluidos. */
export function historyWindow(history: PricePoint[], days: number, now: Date): PricePoint[] {
  const to = dayTime(toIsoDate(now));
  const from = to - days * DAY_MS;
  return history.filter((point) => {
    const time = dayTime(point.date);
    return time >= from && time <= to;
  });
}

/** Precio vigente hace `days` días: el último registro anterior o igual a esa fecha. */
export function priceDaysAgo(history: PricePoint[], days: number, now: Date): number | null {
  const target = dayTime(toIsoDate(now)) - days * DAY_MS;
  return history.findLast((point) => dayTime(point.date) <= target)?.price ?? null;
}

export function isPriceStale(updatedAt: string, now: Date): boolean {
  return now.getTime() - Date.parse(updatedAt) > PRICE_STALE_AFTER_HOURS * HOUR_MS;
}

function average(points: PricePoint[]): number | null {
  if (points.length === 0) return null;
  return Math.round(points.reduce((sum, point) => sum + point.price, 0) / points.length);
}

function lowest(points: PricePoint[]): PricePoint | null {
  return points.reduce<PricePoint | null>(
    (min, point) => (min === null || point.price < min.price ? point : min),
    null,
  );
}

function priceSignals(current: number, average90: number | null, minPrice: number | null) {
  return {
    belowAverage: average90 ? (average90 - current) / average90 : 0,
    isHistoricalMin: minPrice !== null && current <= minPrice,
    atMin: minPrice !== null && current <= minPrice * AT_MIN_RATIO,
    nearMin: minPrice !== null && current <= minPrice * NEAR_MIN_RATIO,
  };
}

export function classifyPrice(
  current: number,
  average90: number | null,
  minPrice: number | null,
): PriceStatus {
  const { belowAverage, atMin, nearMin } = priceSignals(current, average90, minPrice);
  if (atMin || belowAverage >= GOOD_BELOW_AVERAGE) return "good";
  if (minPrice !== null && !nearMin && belowAverage < WAIT_BELOW_AVERAGE) return "wait";
  return "fair";
}

/**
 * Agregados de precio de una pala a fecha `now`. Es la lógica que debe ejecutar
 * el proceso de actualización de precios para rellenar `racket_price_stats`.
 * Devuelve null si la pala no tiene ninguna oferta.
 */
export function computePriceStats(
  offers: StoreOffer[],
  history: PricePoint[],
  now: Date,
): PriceStats | null {
  const best = rankOffers(offers)[0];
  if (!best) return null;

  const today = dayTime(toIsoDate(now));
  const recorded = history.filter((point) => dayTime(point.date) <= today);
  const average90 = average(historyWindow(history, AVERAGE_WINDOW_DAYS, now));
  const min = lowest(recorded);
  const previousPrice =
    best.previousPrice === null ? null : round2(best.previousPrice + best.shipping);

  return {
    bestPrice: best.total,
    bestStoreId: best.store.id,
    storeCount: offers.length,
    previousPrice,
    dropPercent:
      previousPrice !== null && previousPrice > best.total
        ? Math.round(((previousPrice - best.total) / previousPrice) * 100)
        : null,
    average90,
    minPrice: min?.price ?? null,
    minPriceDate: min?.date ?? null,
    price30dAgo: priceDaysAgo(history, MONTH_DAYS, now),
    status: classifyPrice(best.total, average90, min?.price ?? null),
    priceUpdatedAt: best.updatedAt,
    computedAt: now.toISOString(),
  };
}

type NoteInput = Pick<PriceStats, "status" | "bestPrice" | "minPrice">;

/** Nota corta para tarjetas; null si no hay nada que destacar. */
export function priceCardNote(stats: NoteInput, isStale: boolean): string | null {
  if (isStale || stats.status !== "good") return null;
  const atMin = stats.minPrice !== null && stats.bestPrice <= stats.minPrice * AT_MIN_RATIO;
  return atMin ? "Cerca de su mínimo" : "Buen momento para comprar";
}

function describePrice(stats: PriceStats, isStale: boolean): PriceVerdict {
  if (isStale) {
    const since = formatDate(stats.priceUpdatedAt);
    return {
      status: "stale",
      label: "Precio sin confirmar",
      detail: `No hemos podido comprobar este precio desde el ${since}. Confírmalo en la tienda.`,
      answer: `No podemos decírtelo con seguridad: la última vez que comprobamos el precio fue el ${since}, así que puede haber cambiado.`,
    };
  }

  const { bestPrice, average90, minPrice, minPriceDate, status } = stats;
  const signals = priceSignals(bestPrice, average90, minPrice);
  const belowAveragePct = formatPercent(Math.round(signals.belowAverage * 100));
  const minText = minPrice === null ? null : formatEuroCompact(minPrice);
  const minWhen = minPriceDate === null ? null : formatMonthYear(minPriceDate);

  if (status === "good") {
    let answer = `Sí. Está un ${belowAveragePct} por debajo de lo que ha costado de media en los últimos 90 días.`;
    if (signals.isHistoricalMin) {
      answer = "Sí. Está en su precio más bajo desde que seguimos esta pala.";
    } else if (signals.nearMin && minWhen) {
      answer = `Sí, bastante. Ahora mismo está cerca de su precio más bajo: solo ha estado más barata en ${minWhen}.`;
    }
    return {
      status,
      label: "Buen momento para comprar",
      detail:
        signals.belowAverage >= WAIT_BELOW_AVERAGE
          ? `Está un ${belowAveragePct} por debajo de su precio medio de los últimos 90 días.`
          : "Está prácticamente en su precio más bajo.",
      answer,
    };
  }

  if (status === "wait") {
    return {
      status,
      label: "Puedes esperar",
      detail: `Ahora mismo no es especialmente barata. Ha llegado a estar a ${minText}.`,
      answer: `No especialmente. Su precio está en línea con el de los últimos meses y ha llegado a estar a ${minText} en ${minWhen}. Si no tienes prisa, puedes esperar a la siguiente bajada.`,
    };
  }

  return {
    status,
    label: "Precio normal",
    detail: "Está en línea con lo que ha costado en los últimos 90 días.",
    answer:
      minText && minWhen
        ? `Ni cara ni barata. Está en su precio habitual; su mínimo fue de ${minText} en ${minWhen}.`
        : "Ni cara ni barata. Está en su precio habitual.",
  };
}

/** Resumen de precio para la ficha, a partir de los agregados y las ofertas. */
export function buildPriceSummary(
  stats: PriceStats,
  offers: StoreOffer[],
  now: Date,
): PriceSummary | null {
  const ranked = rankOffers(offers);
  const bestOffer = ranked.find((offer) => offer.store.id === stats.bestStoreId) ?? ranked[0];
  if (!bestOffer) return null;

  const isStale = isPriceStale(stats.priceUpdatedAt, now);

  return {
    current: stats.bestPrice,
    bestOffer,
    offers: ranked,
    storeCount: stats.storeCount,
    previous: stats.previousPrice,
    dropPercent: stats.dropPercent,
    average90: stats.average90,
    historicalMin:
      stats.minPrice !== null && stats.minPriceDate !== null
        ? { price: stats.minPrice, date: stats.minPriceDate }
        : null,
    updatedAt: stats.priceUpdatedAt,
    asOf: now.toISOString(),
    isStale,
    verdict: describePrice(stats, isStale),
  };
}

type ChartPrice = Pick<PriceSummary, "current" | "asOf" | "isStale">;

/**
 * Serie del gráfico para los últimos `months` meses contados desde hoy. Si el
 * precio está al día y el histórico aún no tiene registro de hoy, se añade el
 * precio actual; si está desactualizado, la serie termina en el último registro.
 */
export function chartSeries(history: PricePoint[], price: ChartPrice, months: number): PricePoint[] {
  const now = new Date(price.asOf);
  const points = historyWindow(history, Math.round(months * DAYS_PER_MONTH), now);
  const today = toIsoDate(now);
  const lastDate = points.at(-1)?.date ?? "";

  return !price.isStale && lastDate < today
    ? [...points, { date: today, price: price.current }]
    : points;
}
