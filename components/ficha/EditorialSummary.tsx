import { CheckList } from "@/components/ui/CheckList";
import { formatMonthYear } from "@/lib/format";
import type { Editorial } from "@/types/catalog";
import { SectionTitle } from "./SectionTitle";

interface EditorialSummaryProps {
  editorial: Editorial;
  className?: string;
}

/** Nuestra opinión: resumen editorial, lo mejor y lo menos bueno. */
export function EditorialSummary({ editorial, className }: EditorialSummaryProps) {
  return (
    <section aria-labelledby="resumen" className={className}>
      <SectionTitle id="resumen">¿Qué tal es esta pala?</SectionTitle>
      <p className="mt-2.5 text-[17px] leading-[1.6] text-pretty text-ink">{editorial.summary}</p>
      <div className="mt-5 grid gap-[18px]">
        <CheckList title="Lo mejor" items={editorial.pros} tone="positive" />
        <CheckList title="Lo menos bueno" items={editorial.cons} tone="negative" />
      </div>
      <p className="mt-4 text-xs text-muted">
        {editorial.status === "draft"
          ? "Borrador a partir de la información publicada sobre esta pala, pendiente de revisión por el equipo de PalaRadar"
          : "Resumen del equipo de PalaRadar"}{" "}
        · actualizado en {formatMonthYear(editorial.updatedAt)}
      </p>
    </section>
  );
}
