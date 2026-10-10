import { fullSpecs, missingData } from "@/lib/pala-content";
import type { Pala } from "@/types/catalog";
import { SectionTitle } from "./SectionTitle";

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

interface SpecsTableProps {
  pala: Pala;
  className?: string;
}

/**
 * Especificaciones completas, a la vista: todas las características que la pala
 * declara, como referencia tras los bloques que ayudan a decidir.
 */
export function SpecsTable({ pala, className }: SpecsTableProps) {
  const missing = missingData(pala);

  return (
    <section aria-labelledby="especificaciones" className={className}>
      <SectionTitle id="especificaciones">Especificaciones completas</SectionTitle>
      <dl className="mt-3 grid lg:grid-cols-2 lg:gap-x-10">
        {fullSpecs(pala).map((spec) => (
          <div
            key={spec.label}
            className="flex min-h-11 items-center justify-between gap-3 border-b border-line-soft py-1.5 text-sm"
          >
            <dt className="text-muted">{spec.label}</dt>
            <dd className="text-right font-bold">{spec.value}</dd>
          </div>
        ))}
      </dl>
      {missing.length > 0 && (
        <p className="mt-3 text-sm leading-normal text-muted">
          <span className="font-bold text-ink">Dato no disponible:</span> {missing.join(", ")}. La fuente no lo declara
          y no lo damos por supuesto.
        </p>
      )}
      {pala.specsSourceUrl && (
        <p className="mt-3 text-xs text-muted">
          Fuente de los datos: {hostname(pala.specsSourceUrl)}. Son características declaradas, no mediciones propias.
        </p>
      )}
    </section>
  );
}
