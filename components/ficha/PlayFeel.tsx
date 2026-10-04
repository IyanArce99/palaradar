import { formatRating } from "@/lib/format";
import { declaredFeel } from "@/lib/pala-content";
import type { Pala } from "@/types/catalog";
import { SectionTitle } from "./SectionTitle";

interface PlayFeelProps {
  pala: Pala;
  className?: string;
}

/**
 * ¿Cómo se siente jugando? Dos fuentes, cada una con su nombre: lo que la pala
 * declara (tacto, superficie) y las puntuaciones técnicas heredadas de PadelZoom
 * (no son opiniones de usuarios ni puntuaciones de PalaRadar). PalaRadar no
 * puntúa: si no hay ninguna de las dos, el bloque no aparece.
 */
export function PlayFeel({ pala, className }: PlayFeelProps) {
  const declared = declaredFeel(pala);
  const ratings = pala.sourceRatings;
  if (!declared && !ratings) return null;

  return (
    <section aria-labelledby="sensaciones" className={className}>
      <SectionTitle id="sensaciones">¿Cómo se siente jugando?</SectionTitle>
      {declared && <p className="mt-3 text-base leading-[1.6] text-pretty text-ink">{declared}</p>}

      {ratings && (
        <div className="mt-5 rounded-[18px] bg-mist p-[18px]">
          <h3 className="text-[15px] font-extrabold">Puntuaciones técnicas de {ratings.source}</h3>
          <p className="mt-1 text-[13px] leading-[1.45] text-muted">
            Datos heredados de {ratings.source}, de 0 a 10. No son valoraciones propias de PalaRadar.
          </p>
          <dl className="mt-3.5 flex flex-col gap-2.5">
            {ratings.scores.map((aspect) => (
              <div key={aspect.label} className="grid grid-cols-[118px_1fr_30px] items-center gap-2.5 text-sm">
                <dt>{aspect.label}</dt>
                <dd className="contents">
                  <span aria-hidden="true" className="h-2 overflow-hidden rounded bg-line">
                    <span className="block h-full rounded bg-carbon" style={{ width: `${aspect.score * 10}%` }} />
                  </span>
                  <span className="text-right font-extrabold tabular-nums">{formatRating(aspect.score)}</span>
                </dd>
              </div>
            ))}
          </dl>
          {ratings.total !== null && (
            <p className="mt-3.5 border-t border-line pt-3 text-sm">
              Puntuación total de {ratings.source}:{" "}
              <strong className="tabular-nums">{formatRating(ratings.total)}</strong> sobre 10
            </p>
          )}
        </div>
      )}
    </section>
  );
}
