import Link from "next/link";
import { comparePath } from "@/lib/compare";
import { SEASON_RELATION } from "@/lib/data-confidence";
import { formatEuro, formatEuroCompact, formatPercent, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { SeasonComparison } from "@/lib/seasons";
import { SectionTitle } from "./SectionTitle";

interface ModelSeasonsProps {
  /** Pala de la ficha */
  pala: { slug: string; model: string; year: number };
  /** El mismo modelo en otros años, del más reciente al más antiguo, ya comparado con el de la ficha */
  seasons: SeasonComparison[];
  className?: string;
}

/** Cambios que se enseñan sin desplegar; el resto se ve en el comparador */
const MAX_CHANGES = 4;

function PriceGap({ season, year }: { season: SeasonComparison; year: number }) {
  if (!season.price) {
    return <p className="text-sm text-muted">{season.storeCount === 0 ? "Sin precio disponible ahora" : "Sin precio comparable ahora"}</p>;
  }
  const { other, difference, percent } = season.price;
  const euros = Math.round(difference);

  return (
    <p className="text-sm text-ink">
      <span className="text-lg font-black whitespace-nowrap text-carbon tabular-nums">{formatEuro(other)}</span>{" "}
      <span className="whitespace-nowrap">en {pluralize(season.storeCount, "tienda", "tiendas")}</span>
      {euros !== 0 && (
        <span className={euros < 0 ? "mt-0.5 block font-bold text-forest" : "mt-0.5 block text-muted"}>
          {formatEuroCompact(Math.abs(euros))} {euros < 0 ? "menos" : "más"} que la de {year}
          {percent !== 0 && ` (${formatPercent(Math.abs(percent))})`}
        </span>
      )}
    </p>
  );
}

/**
 * Otras temporadas del mismo modelo, enfrentadas con la de la ficha: qué cambia
 * en lo que las dos declaran, qué se mantiene y cuánto cuesta hoy cada una. No
 * se dice que una edición sea mejor: solo se comparan datos (lib/seasons.ts).
 * Sin otras temporadas en el catálogo, no hay bloque.
 */
export function ModelSeasons({ pala, seasons, className }: ModelSeasonsProps) {
  if (seasons.length === 0) return null;

  return (
    <section aria-labelledby="temporadas" className={className}>
      <SectionTitle id="temporadas">Otras temporadas de la {pala.model}</SectionTitle>
      <p className="mt-1.5 text-sm leading-normal text-pretty text-muted">
        El mismo modelo en otros años, comparado con el de {pala.year} en las características que las dos ediciones
        declaran. {SEASON_RELATION.note}
      </p>
      <ul className="mt-3.5 grid gap-3 lg:grid-cols-2">
        {seasons.map((season) => (
          <li key={season.slug} className="flex flex-col rounded-3xl border border-line p-4 lg:p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base leading-snug font-extrabold">
                <Link href={routes.pala(season.slug)} className="underline-offset-2 hover:underline">
                  {season.model} {season.year}
                </Link>
              </h3>
              <span className="flex-none rounded-2xl bg-mist px-2 py-1 text-xs font-bold whitespace-nowrap">
                {season.year < pala.year ? "Edición anterior" : "Edición posterior"}
              </span>
            </div>
            <div className="mt-1.5">
              <PriceGap season={season} year={pala.year} />
            </div>

            {season.changed.length > 0 && (
              <>
                <p className="mt-3.5 text-sm font-extrabold">Qué cambia</p>
                <dl className="mt-1 text-sm leading-normal">
                  {season.changed.slice(0, MAX_CHANGES).map((change) => (
                    <div key={change.label} className="flex flex-wrap gap-x-1.5 border-t border-line py-1.5 first:border-t-0">
                      <dt className="font-bold">{change.label}:</dt>
                      <dd className="text-ink">
                        {change.other} <span className="text-muted">(en la de {pala.year}, {change.current})</span>
                      </dd>
                    </div>
                  ))}
                </dl>
                {season.changed.length > MAX_CHANGES && (
                  <p className="mt-1 text-xs text-muted">
                    Y {season.changed.length - MAX_CHANGES} más en la comparación completa.
                  </p>
                )}
              </>
            )}
            {season.same.length > 0 && (
              <p className="mt-2.5 text-sm leading-normal text-ink">
                <span className="font-extrabold">Se mantiene:</span> {season.same.join(", ").toLowerCase()}.
              </p>
            )}
            {season.unknown.length > 0 && (
              <p className="mt-1.5 text-sm leading-normal text-muted">
                No se puede comparar (solo lo declara una edición): {season.unknown.join(", ").toLowerCase()}.
              </p>
            )}
            {season.conclusion && (
              <p className="mt-3 rounded-2xl bg-mist px-3.5 py-2.5 text-sm leading-normal text-pretty text-ink">
                {season.conclusion}
              </p>
            )}

            <Link
              href={comparePath(pala.slug, season.slug)}
              className="mt-auto flex min-h-11 items-center pt-2 text-sm font-bold underline"
            >
              Comparar la {pala.year} con la {season.year}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
