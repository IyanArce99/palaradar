// Semilla de ejemplo con la forma exacta de las tablas de db/schema.sql. Los
// identificadores son legibles (rk_…, st_…); al cargarla en PostgreSQL se
// sustituyen por los uuid que genere la base de datos.
import type {
  PriceHistoryRow,
  RacketAlternativeRow,
  RacketRow,
  ReviewRow,
  StorePriceRow,
} from "@/types/db";
import { racketSeeds, type RacketSeed } from "./rackets";

export { brands } from "./brands";
export { stores } from "./stores";

/**
 * Momento en que se "tomó" esta semilla. Con datos de ejemplo, la capa de datos
 * usa esta fecha como reloj: así los precios no caducan según pasan los días.
 */
export const SEED_SNAPSHOT_AT = "2026-10-03T09:00:00Z";

/** Última comprobación de precios de la semilla: 12 minutos antes de la instantánea */
const PRICES_CHECKED_AT = "2026-10-03T08:48:00Z";

const HISTORY_LAST_DATE = Date.UTC(2026, 9, 1);
const HISTORY_STEP_DAYS = 14;
const DAY_MS = 86_400_000;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function historyDate(index: number, length: number): string {
  return new Date(HISTORY_LAST_DATE - (length - 1 - index) * HISTORY_STEP_DAYS * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function bestTotal(seed: RacketSeed): number {
  return Math.min(...seed.prices.map(([, price, shipping]) => round2(price + shipping)));
}

export const rackets: RacketRow[] = racketSeeds.map((seed) => seed.racket);

export const storePrices: StorePriceRow[] = racketSeeds.flatMap((seed) => {
  const best = bestTotal(seed);
  return seed.prices.map(([storeId, price, shipping, availability]) => ({
    racket_id: seed.racket.id,
    store_id: storeId,
    current_price: price,
    previous_price: round2(price + shipping) === best ? seed.previousPrice : null,
    shipping_cost: shipping,
    availability,
    product_url: null,
    last_updated: PRICES_CHECKED_AT,
  }));
});

// Cada tienda sigue la serie del mejor precio a la distancia que mantiene hoy.
export const priceHistory: PriceHistoryRow[] = racketSeeds.flatMap((seed) => {
  const best = bestTotal(seed);
  return seed.prices.flatMap(([storeId, price, shipping]) => {
    const offset = round2(price + shipping - best);
    return seed.bestPriceHistory.map((bestPrice, i) => ({
      racket_id: seed.racket.id,
      store_id: storeId,
      price: round2(bestPrice + offset),
      date: historyDate(i, seed.bestPriceHistory.length),
    }));
  });
});

export const reviews: ReviewRow[] = racketSeeds.flatMap((seed) =>
  seed.reviews.map((review, i) => ({
    ...review,
    id: `rv_${seed.racket.slug}_${i + 1}`,
    racket_id: seed.racket.id,
  })),
);

export const racketAlternatives: RacketAlternativeRow[] = racketSeeds.flatMap((seed) =>
  seed.alternatives.map(([slug, reason], position) => ({
    racket_id: seed.racket.id,
    alternative_id: `rk_${slug}`,
    reason,
    position,
  })),
);
