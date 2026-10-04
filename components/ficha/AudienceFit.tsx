import { CheckList } from "@/components/ui/CheckList";
import { EmptyNote } from "@/components/ui/EmptyNote";
import type { Editorial } from "@/types/catalog";
import { SectionTitle } from "./SectionTitle";

interface AudienceFitProps {
  editorial: Pick<Editorial, "idealFor" | "notFor">;
  className?: string;
}

/** ¿Para quién es? Ideal para / puede no ser para ti. */
export function AudienceFit({ editorial, className }: AudienceFitProps) {
  const isEmpty = editorial.idealFor.length === 0 && editorial.notFor.length === 0;

  return (
    <section aria-labelledby="para-quien" className={className}>
      <SectionTitle id="para-quien">¿Para quién es?</SectionTitle>
      {isEmpty ? (
        <EmptyNote className="mt-4">
          Todavía no tenemos información suficiente para decirte a qué tipo de jugador le encaja
          esta pala.
        </EmptyNote>
      ) : (
        <div className="mt-4 grid gap-3">
          <CheckList
            title="Ideal para"
            items={editorial.idealFor}
            tone="positive"
            className="rounded-[18px] bg-lime-tint p-[18px]"
          />
          <CheckList
            title="Puede no ser para ti si"
            items={editorial.notFor}
            tone="negative"
            className="rounded-[18px] bg-mist p-[18px]"
          />
        </div>
      )}
    </section>
  );
}
