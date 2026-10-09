import Link from "next/link";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { formatEuro } from "@/lib/format";
import { SHAPE_LABELS } from "@/lib/labels";
import type { PalaSuggestion } from "@/types/catalog";

interface SuggestionListProps {
  suggestions: PalaSuggestion[];
  /** Enlace que elige esa pala para el hueco */
  hrefFor: (slug: string) => string;
}

/** Palas que encajan con lo buscado: foto, marca y modelo, año y forma, y su precio si lo tiene. */
export function SuggestionList({ suggestions, hrefFor }: SuggestionListProps) {
  return (
    <ul>
      {suggestions.map((pala) => (
        <li key={pala.slug} className="border-t border-line-soft first:border-t-0">
          <Link
            href={hrefFor(pala.slug)}
            className="grid min-h-11 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg px-1 py-2 hover:bg-mist"
          >
            <PalaPhoto src={pala.image} alt="" sizes="40px" className="h-12 w-10 rounded-lg" />
            <span className="min-w-0">
              {/* Como mucho dos líneas: el nombre completo queda en el title. */}
              <span
                title={`${pala.brand} ${pala.model}`}
                className="line-clamp-2 text-sm leading-[1.2] font-extrabold"
              >
                {pala.brand} {pala.model}
              </span>
              <span className="block text-xs text-muted">
                {pala.year} · {SHAPE_LABELS[pala.shape]}
              </span>
            </span>
            {pala.price !== null && (
              <span className="text-sm font-extrabold whitespace-nowrap tabular-nums">
                {formatEuro(pala.price)}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
