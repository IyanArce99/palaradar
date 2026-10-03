import { DisclosureMarker } from "@/components/ui/DisclosureMarker";
import { BALANCE_LABELS, formatLevels, SHAPE_LABELS, STYLE_LABELS } from "@/lib/labels";
import type { Pala, Spec } from "@/types/catalog";

/** Solo las características que la fuente declara: lo desconocido no se muestra. */
function buildSpecs(pala: Pala): Spec[] {
  const entries: [string, string | null][] = [
    ["Forma", SHAPE_LABELS[pala.shape]],
    ["Peso", pala.weight ? formatWeight(pala.weight) : null],
    ["Balance", pala.balance ? BALANCE_LABELS[pala.balance] : null],
    ["Estilo de juego", pala.playStyle ? STYLE_LABELS[pala.playStyle] : null],
    ...pala.specs.map((spec): [string, string] => [spec.label, spec.value]),
    ["Nivel", pala.levels.length > 0 ? formatLevels(pala.levels) : null],
    ["Año", String(pala.year)],
  ];
  return entries.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

function formatWeight({ min, max }: { min: number; max: number }): string {
  return min === max ? `${min} g` : `${min}–${max} g`;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
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
      <dl>
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
      {pala.specsSourceUrl && (
        <p className="border-t border-line-soft py-3 text-xs text-muted">
          Fuente de los datos: {hostname(pala.specsSourceUrl)}
        </p>
      )}
    </details>
  );
}
