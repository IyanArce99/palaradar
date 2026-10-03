import type { PalaBalance, PalaShape, PlayerLevel, PlayStyle } from "@/types/catalog";

export const LEVEL_LABELS: Record<PlayerLevel, string> = {
  iniciacion: "Iniciación",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
  competicion: "Competición",
};

export const SHAPE_LABELS: Record<PalaShape, string> = {
  redonda: "Redonda",
  lagrima: "Lágrima",
  diamante: "Diamante",
};

export const BALANCE_LABELS: Record<PalaBalance, string> = {
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
};

export const STYLE_LABELS: Record<PlayStyle, string> = {
  control: "Control",
  polivalente: "Polivalente",
  potencia: "Potencia",
};

export function formatLevels(levels: PlayerLevel[]): string {
  return levels.map((level) => LEVEL_LABELS[level]).join(" · ");
}
