// Palas elegidas para comparar desde los listados. El comparador enfrenta dos
// palas, así que la selección admite dos. Vive en la pestaña del navegador
// (sessionStorage): no hay cuenta ni servidor detrás.

export interface SelectedPala {
  slug: string;
  /** Marca y modelo, para enseñarlo en la barra */
  name: string;
}

/** Palas que se pueden comparar a la vez */
export const MAX_SELECTED = 2;

/** Añade la pala o, si ya estaba, la quita. Con la selección llena no añade más. */
export function toggleSelected(selection: SelectedPala[], pala: SelectedPala): SelectedPala[] {
  if (selection.some((item) => item.slug === pala.slug)) {
    return selection.filter((item) => item.slug !== pala.slug);
  }
  return selection.length >= MAX_SELECTED ? selection : [...selection, pala];
}

/** Lee una selección guardada, descartando cualquier cosa que no tenga la forma esperada. */
export function parseSelection(raw: string | null): SelectedPala[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is SelectedPala =>
          typeof item === "object" && item !== null && typeof item.slug === "string" && typeof item.name === "string",
      )
      .slice(0, MAX_SELECTED);
  } catch {
    return [];
  }
}
