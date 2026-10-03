import { Dots } from "@/components/ui/Dots";
import type { Editorial } from "@/types/catalog";
import { SectionTitle } from "./SectionTitle";

interface PlayFeelProps {
  editorial: Pick<Editorial, "feel" | "feelSummary">;
}

/** ¿Cómo se siente jugando? Sensaciones en puntos, sin gráficos. */
export function PlayFeel({ editorial }: PlayFeelProps) {
  // Las sensaciones son juicio de uso real: sin ellas no hay sección.
  if (editorial.feel.length === 0) return null;

  return (
    <section aria-labelledby="sensaciones">
      <SectionTitle id="sensaciones">¿Cómo se siente jugando?</SectionTitle>
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
      <p className="mt-3.5 text-base leading-[1.6] text-pretty text-ink">{editorial.feelSummary}</p>
    </section>
  );
}
