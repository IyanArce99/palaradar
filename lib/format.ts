const NBSP = " ";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 239.95 → "239,95 €" */
export function formatEuro(value: number): string {
  const [int, dec] = value.toFixed(2).split(".");
  return `${groupThousands(int)},${dec}${NBSP}€`;
}

/** 286 → "286 €" · 219.95 → "219,95 €" */
export function formatEuroCompact(value: number): string {
  return Number.isInteger(value) ? `${groupThousands(String(value))}${NBSP}€` : formatEuro(value);
}

/** 1180 → "1.180" */
export function formatCount(value: number): string {
  return groupThousands(String(Math.round(value)));
}

/** 4.6 → "4,6" */
export function formatRating(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

/** 16 → "16 %" */
export function formatPercent(value: number): string {
  return `${value}${NBSP}%`;
}

function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return { year, month: month - 1, day };
}

/** "2026-10-01" → "1 de octubre de 2026" */
export function formatDate(iso: string): string {
  const { year, month, day } = parseIsoDate(iso);
  return `${day} de ${MONTHS[month]} de ${year}`;
}

/** Tiempo transcurrido entre dos instantes ISO: "hace 12 minutos", "hace 3 días" */
export function formatTimeAgo(iso: string, nowIso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(nowIso) - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  const hours = Math.round(minutes / 60);
  // Hasta dos días se cuenta en horas: «hace 30 horas» dice más que «hace 1 día».
  if (hours < 48) return `hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.round(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

/** "2026-10-01" → "octubre de 2026" */
export function formatMonthYear(iso: string): string {
  const { year, month } = parseIsoDate(iso);
  return `${MONTHS[month]} de ${year}`;
}

/** "2025-10-16" → "16 oct" */
export function formatDayMonthShort(iso: string): string {
  const { month, day } = parseIsoDate(iso);
  return `${day} ${MONTHS[month].slice(0, 3)}`;
}

/** "2025-10-16" → "oct 2025" */
export function formatMonthYearShort(iso: string): string {
  const { year, month } = parseIsoDate(iso);
  return `${MONTHS[month].slice(0, 3)} ${year}`;
}

/** {355, 375} → "355–375 g" · {365, 365} → "365 g" */
export function formatWeight({ min, max }: { min: number; max: number }): string {
  return min === max ? `${min} g` : `${min}–${max} g`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}
