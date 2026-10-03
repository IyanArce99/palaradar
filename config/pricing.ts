function hoursFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Umbrales de antigüedad del precio, configurables por variable de entorno. */
export const pricingConfig = {
  /** Hasta estas horas desde la comprobación, el precio se presenta como «de hoy». */
  currentHours: hoursFromEnv("PRICE_CURRENT_HOURS", 24),
  /** A partir de estas horas, el precio se da por desactualizado y no se valora. */
  staleAfterHours: hoursFromEnv("PRICE_STALE_AFTER_HOURS", 48),
} as const;
