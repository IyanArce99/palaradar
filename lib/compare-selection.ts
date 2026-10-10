// Palas elegidas para comparar desde los listados. El comparador enfrenta dos o
// tres palas, así que la selección admite hasta tres y ya se puede comparar con
// dos. Vive en la pestaña del navegador (sessionStorage): no hay cuenta ni
// servidor detrás.
import { MAX_COMPARED, MIN_COMPARED } from "@/lib/compare";

export interface SelectedPala {
  slug: string;
  /** Marca y modelo, para enseñarlo en la barra */
  name: string;
}

/** Forma de un slug del catálogo: lo guardado en el navegador acaba en una URL */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Palas que se pueden comparar a la vez */
export const MAX_SELECTED = MAX_COMPARED;
/** Con cuántas ya se puede abrir la comparación */
export const MIN_SELECTED = MIN_COMPARED;

/** Añade la pala o, si ya estaba, la quita. Con la selección llena no añade más. */
export function toggleSelected(selection: SelectedPala[], pala: SelectedPala): SelectedPala[] {
  if (selection.some((item) => item.slug === pala.slug)) {
    return selection.filter((item) => item.slug !== pala.slug);
  }
  return selection.length >= MAX_SELECTED ? selection : [...selection, pala];
}

/** Lee una selección guardada, descartando cualquier cosa que no tenga la forma esperada y las repetidas. */
export function parseSelection(raw: string | null): SelectedPala[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value
      .filter(
        (item): item is SelectedPala =>
          typeof item === "object" &&
          item !== null &&
          typeof item.slug === "string" &&
          SLUG.test(item.slug) &&
          typeof item.name === "string",
      )
      .filter((item) => !seen.has(item.slug) && seen.add(item.slug))
      .slice(0, MAX_SELECTED);
  } catch {
    return [];
  }
}
