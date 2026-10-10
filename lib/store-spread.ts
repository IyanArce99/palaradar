// Diferencia de precio entre tiendas para una misma pala, hoy. No es el índice
// de oportunidad (lib/price-stats.ts), que compara el precio con su propio
// histórico: esto compara, en el mismo momento, lo que piden dos tiendas por el
// mismo producto.
//
// Qué ofertas se comparan:
//   · las de una misma pala del catálogo (cada producto de tienda está
//     emparejado con una pala exacta: variantes y colores son palas distintas);
//   · solo las vigentes: un precio sin confirmar no es una oferta activa;
//   · hacen falta dos como mínimo: con una sola tienda no hay nada que comparar.
//
// Los importes se calculan en céntimos enteros para no arrastrar errores de coma
// flotante (0,1 + 0,2), y la moneda es siempre el euro: la ingestión no admite otra.
import { priceFreshness } from "@/lib/pricing";
import type { Store, StoreOffer } from "@/types/catalog";
import type { PriceFreshness } from "@/types/pricing";

/** Céntimos de un importe en euros */
export function toCents(euros: number): number {
  return Math.round(euros * 100);
}

const toEuros = (cents: number) => cents / 100;

export interface SpreadOffer {
  store: Store;
  /** Precio de la pala, sin envío */
  price: number;
  /** Coste de envío; null si no está verificado */
  shipping: number | null;
  checkedAt: string;
  freshness: PriceFreshness;
}

export interface StoreSpread {
  /** Tiendas comparadas */
  stores: number;
  cheapest: SpreadOffer;
  priciest: SpreadOffer;
  /** Diferencia entre el precio más alto y el más bajo, en euros */
  difference: number;
  /**
   * La diferencia sobre el precio MÁS ALTO, en tanto por ciento con un decimal:
   * «comprando en la más barata pagas un X % menos que en la más cara».
   */
  percent: number;
  /**
   * producto: se comparan los precios de la pala, sin envío (hay algún envío sin
   * verificar). total: todas las tiendas tienen el envío verificado y se compara
   * el total con envío.
   */
  basis: "producto" | "total";
  /** Tiendas cuyo envío no está verificado */
  unverifiedShipping: Store[];
  /** La comprobación más antigua de las ofertas comparadas (ISO con hora) */
  oldestCheck: string;
}

/**
 * Diferencia entre tiendas. null si no hay al menos dos ofertas vigentes con un
 * precio válido. Si todas piden lo mismo se devuelve una diferencia de cero,
 * que también es información («cuesta lo mismo»).
 */
export function storeSpread(offers: StoreOffer[], now: Date): StoreSpread | null {
  const current: SpreadOffer[] = offers
    .filter((offer) => Number.isFinite(offer.price) && offer.price > 0)
    .map((offer) => ({
      store: offer.store,
      price: offer.price,
      shipping: offer.shipping,
      checkedAt: offer.checkedAt,
      freshness: priceFreshness(offer.checkedAt, now),
    }))
    .filter((offer) => offer.freshness !== "stale");

  // Una tienda cuenta una vez: si llegara repetida, vale su precio más bajo.
  const byStore = new Map<string, SpreadOffer>();
  for (const offer of current) {
    const known = byStore.get(offer.store.id);
    if (!known || offer.price < known.price) byStore.set(offer.store.id, offer);
  }
  const compared = [...byStore.values()];
  if (compared.length < 2) return null;

  const unverifiedShipping = compared.filter((offer) => offer.shipping === null).map((offer) => offer.store);
  const basis = unverifiedShipping.length === 0 ? "total" : "producto";
  const amount = (offer: SpreadOffer) => toCents(offer.price) + (basis === "total" ? toCents(offer.shipping ?? 0) : 0);

  const sorted = [...compared].sort(
    (a, b) => amount(a) - amount(b) || a.store.slug.localeCompare(b.store.slug),
  );
  const cheapest = sorted[0];
  const priciest = sorted.at(-1) as SpreadOffer;
  const [low, high] = [amount(cheapest), amount(priciest)];
  const differenceCents = high - low;

  return {
    stores: compared.length,
    cheapest,
    priciest,
    difference: toEuros(differenceCents),
    // Un decimal: (alto − bajo) / alto × 100, todo en céntimos enteros hasta el final.
    percent: high > 0 ? Math.round((differenceCents * 1000) / high) / 10 : 0,
    basis,
    unverifiedShipping,
    oldestCheck: compared.map((offer) => offer.checkedAt).sort((a, b) => a.localeCompare(b))[0],
  };
}

/** Importe que se compara de una oferta, en euros: el precio o el total con envío, según la base. */
export function spreadAmount(offer: SpreadOffer, basis: StoreSpread["basis"]): number {
  return toEuros(toCents(offer.price) + (basis === "total" ? toCents(offer.shipping ?? 0) : 0));
}

/** Por debajo de esta diferencia, las tiendas «piden prácticamente lo mismo» */
export const NEGLIGIBLE_SPREAD_EUROS = 1;
