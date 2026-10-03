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

function parseIsoDate(iso: string): { year: number; month: number } {
  const [year, month] = iso.split("-").map(Number);
  return { year, month: month - 1 };
}

/** "2026-10-01" → "octubre de 2026" */
export function formatMonthYear(iso: string): string {
  const { year, month } = parseIsoDate(iso);
  return `${MONTHS[month]} de ${year}`;
}

/** "2025-10-16" → "oct 2025" */
export function formatMonthYearShort(iso: string): string {
  const { year, month } = parseIsoDate(iso);
  return `${MONTHS[month].slice(0, 3)} ${year}`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}
