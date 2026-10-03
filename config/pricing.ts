function hoursFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Las tiendas de demostración (`stores.is_demo`) solo cuentan en desarrollo y
 * si se pide expresamente. En producción no se incluyen nunca, diga lo que
 * diga la variable.
 */
export function resolveIncludeDemoStores(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV !== "production" && env.INCLUDE_DEMO_PRICES === "true";
}

export const pricingConfig = {
  /** Hasta estas horas desde la comprobación, el precio se presenta como «de hoy». */
  currentHours: hoursFromEnv("PRICE_CURRENT_HOURS", 24),
  /** A partir de estas horas, el precio se da por desactualizado y no se valora. */
  staleAfterHours: hoursFromEnv("PRICE_STALE_AFTER_HOURS", 48),
  /** true = los precios de las tiendas demo participan en la base de datos (solo desarrollo). */
  includeDemoStores: resolveIncludeDemoStores(process.env),
} as const;
