import { CheckList } from "@/components/ui/CheckList";
import type { Editorial } from "@/types/catalog";
import { SectionTitle } from "./SectionTitle";

interface AudienceFitProps {
  editorial: Pick<Editorial, "idealFor" | "notFor">;
}

/** ¿Para quién es? Ideal para / puede no ser para ti. */
export function AudienceFit({ editorial }: AudienceFitProps) {
  return (
    <section aria-labelledby="para-quien">
      <SectionTitle id="para-quien">¿Para quién es?</SectionTitle>
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
    </section>
  );
}
