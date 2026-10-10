import { cn } from "@/lib/cn";
import { reliabilityNotes, type ReliabilityNote } from "@/lib/data-confidence";
import { missingData } from "@/lib/pala-content";
import type { Pala } from "@/types/catalog";
import { SectionTitle } from "./SectionTitle";

interface DataReliabilityProps {
  pala: Pala;
  className?: string;
}

const MARKS: Record<ReliabilityNote["tone"], { symbol: string; label: string; className: string }> = {
  ok: { symbol: "✓", label: "Comprobado", className: "bg-lime text-carbon" },
  aviso: { symbol: "!", label: "A tener en cuenta", className: "bg-carbon text-white" },
  falta: { symbol: "?", label: "No disponible", className: "border border-carbon bg-white text-carbon" },
};

/**
 * Qué sabemos de esta pala y con qué seguridad: el estado de su precio, en
 * cuántas tiendas se ha comparado, de dónde salen sus características y qué no
 * se ha podido verificar (lib/data-confidence.ts). Una ausencia se presenta como
 * lo que es, no como un defecto de la pala.
 */
export function DataReliability({ pala, className }: DataReliabilityProps) {
  const notes = reliabilityNotes({
    price: pala.price,
    missing: missingData(pala),
    // El catálogo solo sabe que la pala tiene un EAN, no si se ha contrastado: `verified_at`
    // se rellena al importar cualquier identificador, así que no demuestra una verificación.
    gtin: pala.gtin === null ? null : "declarado",
    ratingsSource: pala.sourceRatings?.source ?? null,
  });

  return (
    <section aria-labelledby="fiabilidad" className={className}>
      <SectionTitle id="fiabilidad">Fiabilidad de los datos</SectionTitle>
      <ul className="mt-3 grid gap-2 lg:grid-cols-2 lg:gap-x-10">
        {notes.map((note) => {
          const mark = MARKS[note.tone];
          return (
            <li key={note.text} className="grid grid-cols-[22px_1fr] items-start gap-2.5 text-sm leading-[1.45]">
              <span aria-hidden="true" className={cn("grid size-[22px] place-items-center rounded-full text-xs font-black", mark.className)}>
                {mark.symbol}
              </span>
              <span>
                <span className="sr-only">{mark.label}: </span>
                {note.text}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
