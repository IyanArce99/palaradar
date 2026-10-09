"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { PARAMS } from "@/lib/catalog/query";
import { cn } from "@/lib/cn";
import {
  COMPARE_PARAMS,
  compareSelectPath,
  MAX_COMPARED,
  SEARCH_PARAM,
  SLOT_IDS,
  type CompareSelection,
  type CompareSlotId,
} from "@/lib/compare";
import { routes } from "@/lib/routes";
import type { PalaSuggestion } from "@/types/catalog";
import { SlotBadge } from "./Badges";
import { SuggestionList } from "./SuggestionList";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;

export interface PickerChip {
  slug: string;
  label: string;
}

interface PalaPickerProps {
  slot: CompareSlotId;
  /** Palas ya elegidas en los demás huecos, y si el tercero está abierto */
  selection: CompareSelection;
  /** Búsqueda enviada con el formulario (sin JavaScript) y sus resultados */
  defaultQuery: string;
  serverResults: PalaSuggestion[];
  /** Palas del catálogo para empezar con un toque (solo en escritorio) */
  chips: PickerChip[];
  /** Con tres huecos, las tarjetas son más estrechas */
  compact: boolean;
}

/** Silueta de una pala en línea discontinua: el hueco aún no tiene pala. */
function Silhouette() {
  return (
    <span aria-hidden="true" className="flex flex-none flex-col items-center">
      <span className="h-[54px] w-10 rounded-[48%_48%_44%_44%] border-2 border-dashed border-ash lg:h-40 lg:w-[120px]" />
      <span className="-mt-0.5 h-[20px] w-2 rounded-b-md border-2 border-t-0 border-dashed border-ash lg:h-[61px] lg:w-6" />
    </span>
  );
}

/**
 * Un hueco vacío del comparador: la silueta, el buscador y, en escritorio, unas
 * palas para empezar. El buscador es un formulario GET que funciona sin
 * JavaScript (el servidor pinta los resultados); con JavaScript, sugiere palas
 * mientras se escribe y la tarjeta se eleva para enseñarlas.
 */
export function PalaPicker({ slot, selection, defaultQuery, serverResults, chips, compact }: PalaPickerProps) {
  const [query, setQuery] = useState(defaultQuery);
  // Las sugerencias se guardan con la búsqueda a la que responden: al cambiar el
  // texto dejan de mostrarse hasta que llegan las nuevas.
  const [result, setResult] = useState<{ q: string; items: PalaSuggestion[] } | null>(null);
  const title = `Pala ${slot.toUpperCase()}`;
  const q = query.trim();
  const submitted = defaultQuery.trim();

  let suggestions: PalaSuggestion[] | null = null;
  if (result?.q === q) suggestions = result.items;
  else if (submitted && q === submitted) suggestions = serverResults;
  const open = suggestions !== null;

  useEffect(() => {
    if (q.length < MIN_QUERY_LENGTH || q === submitted) return;

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
  }, [q, submitted]);

  const hrefFor = (slug: string) => compareSelectPath({ ...selection, [slot]: slug });

  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-[22px] border-2 p-3 lg:flex lg:flex-col lg:items-stretch lg:gap-4 lg:rounded-3xl lg:p-4",
        compact ? "lg:min-h-[380px]" : "lg:min-h-[430px]",
        open
          ? "flex flex-col gap-2.5 border-carbon bg-white shadow-[0_12px_30px_rgba(21,23,26,0.10)]"
          : "grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2.5 border-transparent bg-mist",
      )}
    >
      <h2 className={cn("flex items-center gap-2 lg:gap-2.5", !open && "col-start-2 row-start-1")}>
        <SlotBadge slot={slot} className="size-[22px] text-[10px] lg:size-7 lg:text-[13px]" />
        <span className="truncate text-sm font-extrabold">{title}</span>
      </h2>

      {!open && (
        <div className="col-start-1 row-span-2 row-start-1 flex justify-center lg:flex-1 lg:items-center">
          <Silhouette />
        </div>
      )}

      <form
        action={routes.compare}
        role="search"
        className={cn(
          "flex h-12 items-center gap-2 rounded-full border-[1.5px] px-3.5 text-carbon lg:h-[54px] lg:gap-2.5 lg:px-[18px]",
          open
            ? "border-transparent bg-mist"
            : "col-start-2 row-start-2 border-line bg-white focus-within:border-carbon",
        )}
      >
        {SLOT_IDS.filter((other) => other !== slot).map((other) => {
          const slug = selection[other];
          return slug ? <input key={other} type="hidden" name={COMPARE_PARAMS[other]} value={slug} /> : null;
        })}
        {(selection.third || slot === "c") && !selection.c && (
          <input type="hidden" name={COMPARE_PARAMS.slots} value={MAX_COMPARED} />
        )}
        <SearchIcon size={18} className="size-4 flex-none lg:size-[18px]" />
        <input
          type="search"
          name={SEARCH_PARAM[slot]}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar marca o modelo…"
          aria-label={`Buscar la pala ${slot.toUpperCase()}`}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm text-carbon outline-none placeholder:text-muted lg:text-[15px]"
        />
      </form>

      {suggestions !== null &&
        (suggestions.length > 0 ? (
          <div className="lg:flex-1">
            <SuggestionList suggestions={suggestions} hrefFor={hrefFor} />
          </div>
        ) : (
          <p className="px-1 text-sm text-muted lg:flex-1">No encontramos ninguna pala con ese nombre.</p>
        ))}

      {!open && chips.length > 0 && (
        <p className="hidden flex-wrap items-center gap-1.5 lg:flex">
          <span className="text-xs text-muted">Prueba con:</span>
          {chips.map((chip) => (
            <Link
              key={chip.slug}
              href={hrefFor(chip.slug)}
              className="flex h-8 items-center rounded-full bg-white px-3 text-[13px] font-semibold whitespace-nowrap hover:bg-lime-soft"
            >
              {chip.label}
            </Link>
          ))}
        </p>
      )}
    </section>
  );
}
