import { DisclosureMarker } from "@/components/ui/DisclosureMarker";
import { BALANCE_LABELS, formatLevels, SHAPE_LABELS } from "@/lib/labels";
import type { Pala, Spec } from "@/types/catalog";

function buildSpecs(pala: Pala): Spec[] {
  return [
    { label: "Forma", value: SHAPE_LABELS[pala.shape] },
    { label: "Peso", value: `${pala.weight.min}–${pala.weight.max} g` },
    { label: "Balance", value: BALANCE_LABELS[pala.balance] },
    ...pala.specs,
    { label: "Nivel", value: formatLevels(pala.levels) },
    { label: "Año", value: String(pala.year) },
  ];
}

interface SpecsTableProps {
  pala: Pala;
}

/** Especificaciones técnicas, plegadas: están para quien las busca, no para abrir la ficha. */
export function SpecsTable({ pala }: SpecsTableProps) {
  return (
    <details className="group rounded-[18px] border border-line px-[18px]">
      <summary className="flex min-h-[60px] items-center justify-between">
        <h2 className="text-[17px] font-extrabold">Especificaciones técnicas</h2>
        <DisclosureMarker />
      </summary>
      <dl className="pb-3">
        {buildSpecs(pala).map((spec) => (
          <div
            key={spec.label}
            className="flex min-h-10 items-center justify-between gap-3 border-t border-line-soft text-sm"
          >
            <dt className="text-muted">{spec.label}</dt>
            <dd className="text-right font-bold">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
