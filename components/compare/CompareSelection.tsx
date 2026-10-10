"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { track } from "@/components/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { compareSetPath } from "@/lib/compare";
import {
  MAX_SELECTED,
  MIN_SELECTED,
  parseSelection,
  toggleSelected,
  type SelectedPala,
} from "@/lib/compare-selection";
import { routes } from "@/lib/routes";

// Selección compartida entre las tarjetas y la barra, sin contexto: un almacén
// mínimo sobre sessionStorage. Si el navegador no lo permite, la selección vive
// solo en memoria.
const STORAGE_KEY = "palaradar:comparar";
const EMPTY: SelectedPala[] = [];
const listeners = new Set<() => void>();
let selection: SelectedPala[] | null = null;

function read(): SelectedPala[] {
  if (selection === null) {
    try {
      selection = parseSelection(window.sessionStorage.getItem(STORAGE_KEY));
    } catch {
      selection = [];
    }
  }
  return selection;
}

function write(next: SelectedPala[]): void {
  selection = next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento disponible, la selección dura lo que dure la página.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useSelection(): SelectedPala[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Botón de una tarjeta: añade la pala a la comparación o la quita. */
export function CompareToggle({ pala, className }: { pala: SelectedPala; className?: string }) {
  const current = useSelection();
  const selected = current.some((item) => item.slug === pala.slug);
  const full = !selected && current.length >= MAX_SELECTED;

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={full}
      title={full ? `Ya has elegido ${MAX_SELECTED} palas: quita una para cambiarla` : undefined}
      onClick={() => {
        if (!selected) track(ANALYTICS_EVENTS.compareAdd, { pala: pala.slug, origen: "listado" });
        write(toggleSelected(read(), pala));
      }}
      className={cn(
        // La posición la pone quien lo usa: debe quedar por encima del enlace que cubre la tarjeta.
        "z-10 flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold whitespace-nowrap",
        selected ? "border-carbon bg-carbon text-white" : "border-line bg-white text-carbon hover:border-carbon",
        full && "cursor-not-allowed opacity-50 hover:border-line",
        className,
      )}
    >
      <span aria-hidden="true">{selected ? "✓" : "+"}</span>
      {selected ? "Comparando" : "Comparar"}
      <span className="sr-only"> {pala.name}</span>
    </button>
  );
}

/**
 * Barra de la comparación en curso. Solo aparece en los listados de palas y solo
 * cuando hay alguna elegida; en móvil se coloca justo encima de la barra de
 * pestañas, sin taparla.
 */
export function CompareBar() {
  const pathname = usePathname();
  const current = useSelection();

  // En el catálogo y en las ofertas: donde hay tarjetas con el botón de comparar.
  const listing = pathname.startsWith(routes.catalog) || pathname.startsWith(routes.deals);
  if (!listing || current.length === 0) return null;

  const ready = current.length >= MIN_SELECTED;

  return (
    <aside
      aria-label="Palas elegidas para comparar"
      className="sticky bottom-[calc(71px+env(safe-area-inset-bottom))] z-20 border-t border-line bg-white lg:bottom-0"
    >
      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-5 py-2.5 lg:px-12 lg:py-3">
        <p className="min-w-0 flex-1 text-[13px] leading-[1.35] lg:text-sm">
          {current.map((item, index) => (
            <span key={item.slug}>
              {index > 0 && <span className="text-muted"> vs </span>}
              <span className="font-extrabold">{item.name}</span>
            </span>
          ))}
          {!ready && <span className="text-muted"> · elige otra pala para compararla</span>}
          {ready && current.length < MAX_SELECTED && (
            <span className="hidden text-muted lg:inline"> · puedes añadir una tercera</span>
          )}
        </p>
        <button type="button" onClick={() => write([])} className="min-h-11 flex-none text-[13px] font-bold underline">
          Quitar
        </button>
        {ready && (
          <Link
            href={compareSetPath(current.map((item) => item.slug))}
            onClick={() => {
              track(ANALYTICS_EVENTS.compareStart, { origen: "listado" });
              write([]);
            }}
            className="flex h-11 flex-none items-center rounded-[14px] bg-lime px-4 text-sm font-extrabold hover:bg-[#bde52f]"
          >
            Comparar
          </Link>
        )}
      </div>
    </aside>
  );
}
