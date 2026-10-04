import Link from "next/link";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import type { PalaSuggestion } from "@/types/catalog";

interface SuggestionListProps {
  suggestions: PalaSuggestion[];
  /** Enlace que elige esa pala para el hueco */
  hrefFor: (slug: string) => string;
}

/** Palas que encajan con lo buscado: foto, marca, modelo y año. */
export function SuggestionList({ suggestions, hrefFor }: SuggestionListProps) {
  return (
    <ul className="mt-2 overflow-hidden rounded-2xl border border-line">
      {suggestions.map((pala) => (
        <li key={pala.slug} className="border-b border-line-soft last:border-b-0">
          <Link
            href={hrefFor(pala.slug)}
            className="flex min-h-14 items-center gap-2 px-2 py-2 hover:bg-mist lg:gap-2.5 lg:px-2.5"
          >
            <PalaPhoto
              src={pala.image}
              alt=""
              sizes="40px"
              className="size-8 flex-none rounded-lg lg:size-10"
            />
            <span className="min-w-0">
              <span className="block truncate text-xs text-muted">
                {pala.brand} · {pala.year}
              </span>
              {/* Como mucho dos líneas: el nombre completo queda en el title. */}
              <span
                title={pala.model}
                className="line-clamp-2 text-[13px] leading-[1.2] font-extrabold lg:text-sm"
              >
                {pala.model}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
