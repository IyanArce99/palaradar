import { cn } from "@/lib/cn";
import { SLOT_IDS } from "@/lib/compare";
import { NOTABLE_SCORE_GAP, SIMILAR_SCORE_GAP, type ScoreComparison, type ScoreRow } from "@/lib/compare-insights";
import { formatRating } from "@/lib/format";
import type { Pala } from "@/types/catalog";
import { SLOT_BAR, SlotBadge } from "./Badges";
import { resultTitleClass } from "./CompareVerdict";

/** «Vertex 05 +1,5» o «Muy parecidas». */
function Lead({ row, palas, className }: { row: ScoreRow; palas: Pala[]; className?: string }) {
  return (
    <span className={className}>
      {row.lead ? (
        <>
          {palas[row.lead.index].model} <strong>+{formatRating(row.lead.gap)}</strong>
        </>
      ) : (
        "Muy parecidas"
      )}
    </span>
  );
}

interface CompareScoresProps {
  palas: Pala[];
  scores: ScoreComparison;
}

/**
 * «Rendimiento»: por cada aspecto, una barra por pala con su letra y su valor
 * sobre 10, y a quién favorece la diferencia. Las puntuaciones son de la fuente
 * externa y se presentan con su nombre: PalaRadar no puntúa.
 */
export function CompareScores({ palas, scores }: CompareScoresProps) {
  const legend = (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold">
      {palas.map((pala, i) => (
        <li key={pala.id} className="flex items-center gap-1.5">
          <SlotBadge slot={SLOT_IDS[i]} className="size-5 text-xs" />
          {pala.model}
        </li>
      ))}
    </ul>
  );

  return (
    <section
      aria-labelledby="rendimiento"
      className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-14"
    >
      <div>
        <div className="lg:mb-3 lg:flex lg:items-end lg:justify-between lg:gap-6">
          <div>
            <h2 id="rendimiento" className={resultTitleClass}>
              Rendimiento
            </h2>
            <p className="mt-1.5 text-sm leading-normal text-pretty text-muted lg:text-sm">
              Puntuaciones técnicas de {scores.source}, sobre 10. No son valoraciones propias de PalaRadar.
            </p>
          </div>
          <div className="mt-3 mb-1 lg:m-0 lg:flex-none">{legend}</div>
        </div>

        {scores.rows.map((row) => (
          <div
            key={row.label}
            className="border-t border-line py-3.5 lg:grid lg:grid-cols-[170px_minmax(0,1fr)_170px] lg:items-center lg:gap-6 lg:py-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="truncate text-sm font-extrabold lg:text-base">{row.label}</h3>
              <Lead row={row} palas={palas} className="text-xs text-muted lg:hidden" />
            </div>
            <dl className="mt-2.5 flex flex-col gap-[7px] lg:mt-0 lg:gap-2">
              {palas.map((pala, i) => {
                const score = row.scores[i];
                return (
                  <div key={pala.id} className="flex items-center gap-2 lg:gap-2.5">
                    <dt className="flex-none">
                      <SlotBadge slot={SLOT_IDS[i]} className="size-5 text-xs lg:size-[22px] lg:text-xs" />
                      <span className="sr-only">{pala.model}</span>
                    </dt>
                    <dd className="contents">
                      <span aria-hidden="true" className="h-2.5 flex-1 overflow-hidden rounded-md bg-line-soft lg:h-3">
                        {score !== null && (
                          <span
                            className={cn("block h-full rounded-md", SLOT_BAR[SLOT_IDS[i]])}
                            style={{ width: `${score * 10}%` }}
                          />
                        )}
                      </span>
                      <span className="w-[30px] text-right text-sm font-extrabold whitespace-nowrap tabular-nums lg:w-[34px] lg:text-base">
                        {score === null ? "—" : formatRating(score)}
                      </span>
                    </dd>
                  </div>
                );
              })}
            </dl>
            <Lead row={row} palas={palas} className="hidden text-right text-sm text-ink lg:block" />
          </div>
        ))}
      </div>

      <aside className="mt-5 rounded-3xl bg-mist p-5 lg:mt-16">
        <h3 className="text-base font-extrabold">Cómo leer esto</h3>
        <p className="mt-2 text-sm leading-normal text-ink">
          Con menos de {formatRating(SIMILAR_SCORE_GAP)} puntos de diferencia las damos por muy parecidas. A partir
          de {NOTABLE_SCORE_GAP} punto, la ventaja entra en «¿Cuál elegir?». Son datos de {scores.source}: PalaRadar
          no puntúa las palas.
        </p>
      </aside>
    </section>
  );
}
