"use client";

import { useEffect, useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { PARAMS } from "@/lib/catalog/query";
import { COMPARE_PARAMS, compareSelectPath, type CompareSlotId } from "@/lib/compare";
import { routes } from "@/lib/routes";
import type { PalaSuggestion } from "@/types/catalog";
import { SuggestionList } from "./SuggestionList";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;

interface PalaPickerProps {
  slot: CompareSlotId;
  /** Pala ya elegida en el otro hueco */
  other: string | null;
  /** Búsqueda enviada con el formulario (sin JavaScript) */
  defaultQuery: string;
}

/**
 * Buscador de un hueco del comparador. Es un formulario GET que funciona sin
 * JavaScript (el servidor pinta los resultados); con JavaScript, sugiere palas
 * mientras se escribe.
 */
export function PalaPicker({ slot, other, defaultQuery }: PalaPickerProps) {
  const [query, setQuery] = useState(defaultQuery);
  // Las sugerencias se guardan con la búsqueda a la que responden: al cambiar el
  // texto dejan de mostrarse hasta que llegan las nuevas.
  const [result, setResult] = useState<{ q: string; items: PalaSuggestion[] } | null>(null);
  const otherSlot: CompareSlotId = slot === "a" ? "b" : "a";
  const label = `Buscar la pala ${slot.toUpperCase()}`;
  const q = query.trim();
  const suggestions = result?.q === q ? result.items : null;

  useEffect(() => {
    if (q.length < MIN_QUERY_LENGTH || q === defaultQuery.trim()) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = `${routes.searchApi}?${new URLSearchParams({ [PARAMS.q]: q })}`;
        const response = await fetch(url, { signal: controller.signal });
        if (response.ok) setResult({ q, items: await response.json() });
      } catch {
        // Petición cancelada o sin red: el formulario sigue pudiendo enviarse.
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, defaultQuery]);

  return (
    <div>
      <form
        action={routes.compare}
        role="search"
        className="flex h-[50px] items-center gap-2 rounded-full border-2 border-carbon bg-white px-3.5"
      >
        {other && <input type="hidden" name={COMPARE_PARAMS[otherSlot]} value={other} />}
        <SearchIcon className="shrink-0" />
        <input
          type="search"
          name={slot === "a" ? COMPARE_PARAMS.searchA : COMPARE_PARAMS.searchB}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Marca o modelo…"
          aria-label={label}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-carbon outline-none placeholder:text-muted"
        />
      </form>
      {suggestions &&
        (suggestions.length > 0 ? (
          <SuggestionList
            suggestions={suggestions}
            hrefFor={(slug) => compareSelectPath({ [otherSlot]: other, [slot]: slug })}
          />
        ) : (
          <p className="mt-2 text-sm text-muted">No encontramos ninguna pala con ese nombre.</p>
        ))}
    </div>
  );
}
