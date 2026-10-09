import Link from "next/link";
import { formatEuro } from "@/lib/format";
import { comparePath } from "@/lib/compare";
import { routes } from "@/lib/routes";
import type { PalaSummary } from "@/types/catalog";
import { SectionTitle } from "./SectionTitle";

interface ModelSeasonsProps {
  /** Pala de la ficha */
  pala: { slug: string; model: string; year: number };
  /** El mismo modelo en otros años, del más reciente al más antiguo */
  seasons: PalaSummary[];
  className?: string;
}

/**
 * Otras temporadas del mismo modelo: quien mira la de este año suele querer
 * saber cuánto cuesta la anterior. Sin otras temporadas en el catálogo, no hay bloque.
 */
export function ModelSeasons({ pala, seasons, className }: ModelSeasonsProps) {
  if (seasons.length === 0) return null;

  return (
    <section aria-labelledby="temporadas" className={className}>
      <SectionTitle id="temporadas">Otras temporadas de la {pala.model}</SectionTitle>
      <p className="mt-1.5 text-sm leading-[1.45] text-pretty text-muted">
        El mismo modelo en otros años. Esta ficha es la de {pala.year}.
      </p>
      <ul className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
        {seasons.map((season) => (
          <li
            key={season.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3"
          >
            <div className="min-w-0">
              <Link href={routes.pala(season.slug)} className="text-base font-extrabold underline-offset-2 hover:underline">
                {season.model} {season.year}
              </Link>
              <p className="text-[13px] whitespace-nowrap text-muted tabular-nums">
                {season.price === null ? "Sin precio disponible ahora" : `desde ${formatEuro(season.price)}`}
              </p>
            </div>
            <Link
              href={comparePath(pala.slug, season.slug)}
              className="flex min-h-11 flex-none items-center text-[13px] font-bold underline"
            >
              Comparar
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
