import type { NormalizedOffer, StoreListing, StoreShipping } from "./types";

const CURRENCY = "EUR";

export type NormalizeResult =
  | { ok: true; offer: NormalizedOffer }
  | { ok: false; reason: string };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Coste de envío de un precio según la regla de la tienda; null si no se conoce la regla. */
export function shippingFor(price: number, shipping: StoreShipping | null): number | null {
  if (shipping === null) return null;
  return shipping.freeFrom !== null && price >= shipping.freeFrom ? 0 : shipping.cost;
}

/**
 * Valida un listado y deja su precio listo para guardar: importe en euros con
 * dos decimales, envío de la tienda aplicado, disponibilidad y fecha de
 * comprobación. Los listados con datos no válidos se descartan con su motivo.
 *
 * El precio de lista de la tienda se conserva solo como dato informativo: el
 * «precio anterior» que mostramos sale siempre de nuestro propio histórico.
 */
export function normalizeListing(
  listing: StoreListing,
  shipping: StoreShipping | null,
  now: Date,
): NormalizeResult {
  const currency = (listing.currency ?? CURRENCY).toUpperCase();
  if (currency !== CURRENCY) return { ok: false, reason: `Moneda no admitida: ${currency}.` };

  if (!Number.isFinite(listing.price) || listing.price <= 0) {
    return { ok: false, reason: "Precio no válido." };
  }

  const checked = Date.parse(listing.checkedAt);
  if (Number.isNaN(checked)) return { ok: false, reason: "Fecha de comprobación no válida." };

  const price = round2(listing.price);
  const listPrice =
    listing.listPrice !== null && Number.isFinite(listing.listPrice) && listing.listPrice > price
      ? round2(listing.listPrice)
      : null;
  const shippingCost = shippingFor(price, shipping);

  return {
    ok: true,
    offer: {
      price,
      listPrice,
      shipping: shippingCost,
      total: round2(price + (shippingCost ?? 0)),
      available: listing.available === true,
      // Una comprobación no puede ser posterior a la fecha actual.
      checkedAt: new Date(Math.min(checked, now.getTime())).toISOString(),
    },
  };
}
