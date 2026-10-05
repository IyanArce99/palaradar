import { pricingConfig } from "@/config/pricing";
import type { PricePoint, Store, StoreOffer } from "@/types/catalog";
import type {
  PriceFreshness,
  PriceHistory,
  StorePriceSeries,
  PriceStats,
  PriceStatus,
  PriceSummary,
  PriceVerdict,
  RankedOffer,
} from "@/types/pricing";
import { formatDate, formatEuroCompact, formatPercent } from "./format";

// Tres fechas distintas que esta lógica nunca mezcla:
//   · now        → la fecha actual, siempre recibida como parámetro
//   · checkedAt  → cuándo se comprobó un precio en la tienda
//   · priceDate  → el día al que corresponde un registro del histórico

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const DAYS_PER_MONTH = 30.5;

/**
 * Ventana de todo lo que se dice de un precio frente a su histórico: la media,
 * el mínimo y el veredicto se calculan sobre estos días, y una pala no tiene
 * veredicto hasta que su seguimiento cubre la ventana entera.
 */
export const HISTORY_WINDOW_DAYS = 30;

/** Cómo se presenta un precio que aún no tiene veredicto, en la ficha y en los listados. */
export const RECENT_PRICE_LABEL = "Precio reciente";

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
    .map((offer) => ({ ...offer, total: round2(offer.price + (offer.shipping ?? 0)) }))
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

/** Un registro de `price_history`: el precio final de una pala en una tienda un día. */
export interface StorePriceRecord {
  store: Store;
  date: string;
  price: number;
}

/**
 * Histórico global y por tienda a partir de los registros de una pala. El
 * global es, cada día, el mínimo entre las tiendas con registro ese día (a
 * igualdad de precio, la primera por orden alfabético). No inventa días: una
 * tienda sin registro un día no aporta nada a ese día.
 */
export function buildPriceHistory(records: StorePriceRecord[]): PriceHistory {
  const byStore = new Map<string, StorePriceSeries>();
  const byDate = new Map<string, StorePriceRecord[]>();

  for (const record of records) {
    const series = byStore.get(record.store.id) ?? { store: record.store, points: [] };
    series.points.push({ date: record.date, price: record.price });
    byStore.set(record.store.id, series);

    const day = byDate.get(record.date) ?? [];
    day.push(record);
    byDate.set(record.date, day);
  }

  const byDay = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date);

  return {
    market: [...byDate.values()]
      .map((day) => {
        const [best] = [...day].sort(
          (a, b) => a.price - b.price || a.store.slug.localeCompare(b.store.slug),
        );
        return { date: best.date, price: best.price, store: best.store, storeCount: day.length };
      })
      .sort(byDay),
    byStore: [...byStore.values()]
      .map((series) => ({ store: series.store, points: [...series.points].sort(byDay) }))
      .sort((a, b) => a.store.slug.localeCompare(b.store.slug)),
  };
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

/** Primer día con precio registrado, o null si todavía no hay ninguno. */
export function trackedSince(history: PricePoint[], now: Date): string | null {
  const today = dayTime(toIsoDate(now));
  return history.find((point) => dayTime(point.date) <= today)?.date.slice(0, 10) ?? null;
}

/** true si el seguimiento de la pala cubre la ventana entera: su primer registro tiene 30 días o más. */
export function hasEnoughHistory(history: PricePoint[], now: Date): boolean {
  return priceDaysAgo(history, HISTORY_WINDOW_DAYS, now) !== null;
}

function priceSignals(current: number, average: number | null, minPrice: number | null) {
  return {
    belowAverage: average ? (average - current) / average : 0,
    isWindowMin: minPrice !== null && current <= minPrice,
    atMin: minPrice !== null && current <= minPrice * AT_MIN_RATIO,
    nearMin: minPrice !== null && current <= minPrice * NEAR_MIN_RATIO,
  };
}

/**
 * Veredicto del precio actual frente a la media y el mínimo de la ventana. Solo
 * se llama con histórico suficiente. Estar en el mínimo no basta: un precio que
 * no se ha movido también lo está, y eso no es una oportunidad. Hace falta,
 * además, que esté por debajo de lo que ha costado de media.
 */
export function classifyPrice(
  current: number,
  average: number | null,
  minPrice: number | null,
): Exclude<PriceStatus, "recent"> {
  const { belowAverage, atMin, nearMin } = priceSignals(current, average, minPrice);
  if (belowAverage >= GOOD_BELOW_AVERAGE) return "good";
  if (atMin && belowAverage >= WAIT_BELOW_AVERAGE) return "good";
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

  // Sin la ventana cubierta no hay media, mínimo ni veredicto: con pocos días,
  // cualquier precio es «el más bajo que hemos visto».
  const enough = hasEnoughHistory(history, now);
  const window = enough ? historyWindow(history, HISTORY_WINDOW_DAYS, now) : [];
  const average30 = average(window);
  const min = lowest(window);
  const previousPrice =
    best.previousPrice === null ? null : round2(best.previousPrice + (best.shipping ?? 0));

  return {
    bestPrice: best.total,
    bestStoreId: best.store.id,
    storeCount: usable.length,
    previousPrice,
    dropPercent:
      previousPrice !== null && previousPrice > best.total
        ? Math.round(((previousPrice - best.total) / previousPrice) * 100)
        : null,
    average30,
    minPrice: min?.price ?? null,
    minPriceDate: min?.date ?? null,
    price30dAgo: priceDaysAgo(history, HISTORY_WINDOW_DAYS, now),
    trackedSince: trackedSince(history, now),
    status: enough ? classifyPrice(best.total, average30, min?.price ?? null) : "recent",
    priceCheckedAt: best.checkedAt,
    computedAt: now.toISOString(),
  };
}

type NoteInput = Pick<PriceStats, "status" | "bestPrice" | "minPrice">;

/**
 * Nota corta para tarjetas; null si no hay nada que destacar, si el precio está
 * desactualizado o si la pala aún no tiene histórico suficiente.
 */
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

  const { bestPrice, average30, minPrice, minPriceDate, status } = stats;

  if (status === "recent") {
    const since = formatDate(stats.trackedSince ?? stats.priceCheckedAt);
    return {
      status,
      label: RECENT_PRICE_LABEL,
      detail: `Seguimos este precio desde el ${since}. Todavía no hay histórico suficiente para valorarlo.`,
      answer: `Todavía no podemos decírtelo. Seguimos el precio de esta pala desde el ${since} y hacen falta ${HISTORY_WINDOW_DAYS} días de histórico para compararlo con lo que ha costado.`,
    };
  }

  const signals = priceSignals(bestPrice, average30, minPrice);
  const belowAveragePct = formatPercent(Math.round(signals.belowAverage * 100));
  const minText = minPrice === null ? null : formatEuroCompact(minPrice);
  const minWhen = minPriceDate === null ? null : formatDate(minPriceDate);
  const window = `los últimos ${HISTORY_WINDOW_DAYS} días`;

  if (status === "good") {
    let answer = `Sí. Está un ${belowAveragePct} por debajo de lo que ha costado de media en ${window}.`;
    if (signals.isWindowMin) {
      answer = `Sí. Está en su precio más bajo de ${window}, un ${belowAveragePct} por debajo de la media.`;
    } else if (signals.nearMin && minText && minWhen) {
      answer = `Sí, bastante. Está cerca de su precio más bajo de ${window}: ${minText}, el ${minWhen}.`;
    }
    return {
      status,
      label: "Buen momento para comprar",
      detail: `Está un ${belowAveragePct} por debajo de su precio medio de ${window}.`,
      answer,
    };
  }

  if (status === "wait") {
    return {
      status,
      label: "Puedes esperar",
      detail: `Ahora mismo no es especialmente barata. En ${window} ha llegado a estar a ${minText}.`,
      answer: `No especialmente. En ${window} ha llegado a estar a ${minText}, el ${minWhen}. Si no tienes prisa, puedes esperar a la siguiente bajada.`,
    };
  }

  return {
    status,
    label: "Precio normal",
    detail: `Está en línea con lo que ha costado en ${window}.`,
    answer:
      minText && minWhen && minPrice !== null && minPrice < bestPrice
        ? `Ni cara ni barata. Está en su precio habitual; en ${window} su mínimo fue de ${minText}, el ${minWhen}.`
        : `Ni cara ni barata. Está en su precio habitual de ${window}.`,
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
    average30: stats.average30,
    min30:
      stats.minPrice !== null && stats.minPriceDate !== null
        ? { price: stats.minPrice, date: stats.minPriceDate }
        : null,
    trackedSince: stats.trackedSince,
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
