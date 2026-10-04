import { Dots } from "@/components/ui/Dots";
import { EmptyNote } from "@/components/ui/EmptyNote";
import type { Editorial } from "@/types/catalog";
import { SectionTitle } from "./SectionTitle";

interface PlayFeelProps {
  editorial: Pick<Editorial, "feel" | "feelSummary">;
  className?: string;
}

/** ¿Cómo se siente jugando? Sensaciones en puntos, sin gráficos. */
export function PlayFeel({ editorial, className }: PlayFeelProps) {
  return (
    <section aria-labelledby="sensaciones" className={className}>
      <SectionTitle id="sensaciones">¿Cómo se siente jugando?</SectionTitle>
      {/* Las sensaciones son juicio de uso real: sin él, se dice; no se puntúa. */}
      {editorial.feel.length === 0 ? (
        <EmptyNote className="mt-4">
          Todavía no hemos valorado cómo se siente esta pala en pista. Lo añadiremos cuando
          tengamos una valoración propia.
        </EmptyNote>
      ) : (
        <>
          <dl className="mt-3">
            {editorial.feel.map((aspect) => (
              <div
                key={aspect.label}
                className="flex min-h-11 items-center justify-between border-b border-line-soft text-[15px]"
              >
                <dt>{aspect.label}</dt>
                <dd>
                  <Dots score={aspect.score} className="text-[17px]" />
                </dd>
              </div>
            ))}
          </dl>
          {editorial.feelSummary && (
            <p className="mt-3.5 text-base leading-[1.6] text-pretty text-ink">
              {editorial.feelSummary}
            </p>
          )}
        </>
      )}
    </section>
  );
}
