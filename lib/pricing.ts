import type { Pala, PricePoint, StoreOffer } from "@/types/catalog";
import { formatEuroCompact, formatMonthYear, formatPercent } from "./format";

const DAY_MS = 86_400_000;
const AVERAGE_WINDOW_DAYS = 90;

// Umbrales del veredicto de precio
const AT_MIN_RATIO = 1.03;
const NEAR_MIN_RATIO = 1.1;
const GOOD_BELOW_AVERAGE = 0.08;
const WAIT_BELOW_AVERAGE = 0.03;

export interface RankedOffer extends StoreOffer {
  /** Precio final con envío */
  total: number;
}

export type PriceStatus = "good" | "fair" | "wait";

export interface PriceVerdict {
  status: PriceStatus;
  label: string;
  /** Una frase que justifica el veredicto */
  detail: string;
  /** Respuesta a «¿Está barata ahora?» */
  answer: string;
  /** Nota corta para tarjetas; null si no hay nada que destacar */
  cardNote: string | null;
}

export interface PriceSummary {
  current: number;
  bestOffer: RankedOffer;
  /** De más barata a más cara, por precio final */
  offers: RankedOffer[];
  storeCount: number;
  previous: number | null;
  dropPercent: number | null;
  average90: number | null;
  historicalMin: PricePoint | null;
  verdict: PriceVerdict;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toTime(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function rankOffers(offers: StoreOffer[]): RankedOffer[] {
  return offers
    .map((offer) => ({ ...offer, total: round2(offer.price + offer.shipping) }))
    .sort((a, b) => a.total - b.total);
}

/** Puntos del histórico dentro de los últimos `days`, contados desde el último registro. */
export function historySince(history: PricePoint[], days: number): PricePoint[] {
  const last = history.at(-1);
  if (!last) return [];
  const from = toTime(last.date) - days * DAY_MS;
  return history.filter((point) => toTime(point.date) >= from);
}

/** Precio registrado hace `days` días (el punto anterior más cercano). */
export function priceDaysAgo(history: PricePoint[], days: number): number | null {
  const last = history.at(-1);
  if (!last) return null;
  const target = toTime(last.date) - days * DAY_MS;
  const point = history.findLast((p) => toTime(p.date) <= target);
  return point?.price ?? null;
}

function findHistoricalMin(history: PricePoint[]): PricePoint | null {
  return history.reduce<PricePoint | null>(
    (min, point) => (min === null || point.price < min.price ? point : min),
    null,
  );
}

function average(history: PricePoint[]): number | null {
  if (history.length === 0) return null;
  return Math.round(history.reduce((sum, point) => sum + point.price, 0) / history.length);
}

function buildVerdict(
  current: number,
  average90: number | null,
  min: PricePoint | null,
): PriceVerdict {
  const belowAverage = average90 ? (average90 - current) / average90 : 0;
  const belowAveragePct = formatPercent(Math.round(belowAverage * 100));
  const isHistoricalMin = min !== null && current <= min.price;
  const atMin = min !== null && current <= min.price * AT_MIN_RATIO;
  const nearMin = min !== null && current <= min.price * NEAR_MIN_RATIO;

  if (atMin || belowAverage >= GOOD_BELOW_AVERAGE) {
    const detail =
      belowAverage >= WAIT_BELOW_AVERAGE
        ? `Está un ${belowAveragePct} por debajo de su precio medio de los últimos 90 días.`
        : "Está prácticamente en su precio más bajo.";

    let answer = `Sí. Está un ${belowAveragePct} por debajo de lo que ha costado de media en los últimos 90 días.`;
    if (isHistoricalMin) {
      answer = "Sí. Está en su precio más bajo desde que seguimos esta pala.";
    } else if (nearMin && min) {
      answer = `Sí, bastante. Ahora mismo está cerca de su precio más bajo: solo ha estado más barata en ${formatMonthYear(min.date)}.`;
    }

    return {
      status: "good",
      label: "Buen momento para comprar",
      detail,
      answer,
      cardNote: atMin ? "Cerca de su mínimo" : "Buen momento para comprar",
    };
  }

  if (!nearMin && belowAverage < WAIT_BELOW_AVERAGE && min) {
    const minText = formatEuroCompact(min.price);
    return {
      status: "wait",
      label: "Puedes esperar",
      detail: `Ahora mismo no es especialmente barata. Ha llegado a estar a ${minText}.`,
      answer: `No especialmente. Su precio está en línea con el de los últimos meses y ha llegado a estar a ${minText} en ${formatMonthYear(min.date)}. Si no tienes prisa, puedes esperar a la siguiente bajada.`,
      cardNote: null,
    };
  }

  return {
    status: "fair",
    label: "Precio normal",
    detail: "Está en línea con lo que ha costado en los últimos 90 días.",
    answer: min
      ? `Ni cara ni barata. Está en su precio habitual; su mínimo fue de ${formatEuroCompact(min.price)} en ${formatMonthYear(min.date)}.`
      : "Ni cara ni barata. Está en su precio habitual.",
    cardNote: null,
  };
}

/** Resumen de precio de una pala. null si no tiene ninguna oferta. */
export function getPriceSummary(
  pala: Pick<Pala, "offers" | "previousPrice" | "priceHistory">,
): PriceSummary | null {
  const offers = rankOffers(pala.offers);
  const bestOffer = offers[0];
  if (!bestOffer) return null;

  const current = bestOffer.total;
  const previous = pala.previousPrice;
  const average90 = average(historySince(pala.priceHistory, AVERAGE_WINDOW_DAYS));
  const historicalMin = findHistoricalMin(pala.priceHistory);

  return {
    current,
    bestOffer,
    offers,
    storeCount: offers.length,
    previous,
    dropPercent:
      previous !== null && previous > current
        ? Math.round(((previous - current) / previous) * 100)
        : null,
    average90,
    historicalMin,
    verdict: buildVerdict(current, average90, historicalMin),
  };
}
