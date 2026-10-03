import { pricingConfig } from "@/config/pricing";
import type { PricePoint, StoreOffer } from "@/types/catalog";
import type {
  PriceFreshness,
  PriceStats,
  PriceStatus,
  PriceSummary,
  PriceVerdict,
  RankedOffer,
} from "@/types/pricing";
import { formatDate, formatEuroCompact, formatMonthYear, formatPercent } from "./format";

// Tres fechas distintas que esta lógica nunca mezcla:
//   · now        → la fecha actual, siempre recibida como parámetro
//   · checkedAt  → cuándo se comprobó un precio en la tienda
//   · priceDate  → el día al que corresponde un registro del histórico

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const AVERAGE_WINDOW_DAYS = 90;
const MONTH_DAYS = 30;
const DAYS_PER_MONTH = 30.5;

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

/** Antigüedad de una comprobación de precio respecto a la fecha actual. */
export function priceFreshness(checkedAt: string, now: Date): PriceFreshness {
  const hours = (now.getTime() - Date.parse(checkedAt)) / HOUR_MS;
  if (hours <= pricingConfig.currentHours) return "current";
  return hours <= pricingConfig.staleAfterHours ? "recent" : "stale";
}

/**
 * Ofertas que cuentan para el mejor precio, de más barata a más cara. Un precio
 * desactualizado no compite con uno comprobado: si alguna tienda tiene el precio
 * al día, las desactualizadas se descartan. Solo si todas lo están se devuelven
 * todas, y entonces el resumen se presenta como «precio sin confirmar».
 */
export function usableOffers(offers: StoreOffer[], now: Date): RankedOffer[] {
  const ranked = rankOffers(offers);
  const checked = ranked.filter((offer) => priceFreshness(offer.checkedAt, now) !== "stale");
  return checked.length > 0 ? checked : ranked;
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
 * Agregados de precio de una pala a fecha `now`, a partir de sus ofertas y de
 * su histórico diario. La usan la ficha (sobre los precios vivos) y el proceso
 * que rellena `racket_price_stats` para el catálogo.
 * Devuelve null si la pala no tiene ninguna oferta.
 */
export function computePriceStats(
  offers: StoreOffer[],
  history: PricePoint[],
  now: Date,
): PriceStats | null {
  const usable = usableOffers(offers, now);
  const best = usable[0];
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
    storeCount: usable.length,
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
    priceCheckedAt: best.checkedAt,
    computedAt: now.toISOString(),
  };
}

type NoteInput = Pick<PriceStats, "status" | "bestPrice" | "minPrice">;

/** Nota corta para tarjetas; null si no hay nada que destacar o el precio está desactualizado. */
export function priceCardNote(stats: NoteInput, freshness: PriceFreshness): string | null {
  if (freshness === "stale" || stats.status !== "good") return null;
  const atMin = stats.minPrice !== null && stats.bestPrice <= stats.minPrice * AT_MIN_RATIO;
  return atMin ? "Cerca de su mínimo" : "Buen momento para comprar";
}

function describePrice(stats: PriceStats, freshness: PriceFreshness): PriceVerdict {
  if (freshness === "stale") {
    const since = formatDate(stats.priceCheckedAt);
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

/** Resumen de precio para la ficha, calculado sobre las ofertas vivas. null si no hay ofertas. */
export function buildPriceSummary(
  offers: StoreOffer[],
  history: PricePoint[],
  now: Date,
): PriceSummary | null {
  const stats = computePriceStats(offers, history, now);
  if (!stats) return null;

  const ranked = usableOffers(offers, now);
  const freshness = priceFreshness(stats.priceCheckedAt, now);

  return {
    current: stats.bestPrice,
    bestOffer: ranked[0],
    offers: ranked,
    storeCount: stats.storeCount,
    previous: stats.previousPrice,
    dropPercent: stats.dropPercent,
    average90: stats.average90,
    historicalMin:
      stats.minPrice !== null && stats.minPriceDate !== null
        ? { price: stats.minPrice, date: stats.minPriceDate }
        : null,
    checkedAt: stats.priceCheckedAt,
    asOf: now.toISOString(),
    freshness,
    verdict: describePrice(stats, freshness),
  };
}

type ChartPrice = Pick<PriceSummary, "current" | "asOf" | "checkedAt" | "freshness">;

/**
 * Serie del gráfico para los últimos `months` meses contados desde hoy. El
 * precio actual se añade como último punto en la fecha que le corresponde: hoy
 * si la comprobación es reciente, o el día en que se comprobó si no lo es.
 */
export function chartSeries(history: PricePoint[], price: ChartPrice, months: number): PricePoint[] {
  const now = new Date(price.asOf);
  const points = historyWindow(history, Math.round(months * DAYS_PER_MONTH), now);
  const lastPointDate = price.freshness === "current" ? toIsoDate(now) : price.checkedAt.slice(0, 10);
  const lastRecorded = points.at(-1)?.date ?? "";

  return lastRecorded < lastPointDate
    ? [...points, { date: lastPointDate, price: price.current }]
    : points;
}
