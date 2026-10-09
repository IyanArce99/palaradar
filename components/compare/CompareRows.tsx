import { cn } from "@/lib/cn";
import { MAX_COMPARED, SLOT_IDS, type SpecRow } from "@/lib/compare";
import type { Pala } from "@/types/catalog";
import { SlotBadge } from "./Badges";
import { resultTitleClass } from "./CompareVerdict";

/** Columna de cada pala en móvil: la primera a la izquierda y la última a la derecha. */
function mobileAlign(index: number, count: number): string {
  if (index === 0) return "text-left";
  return index === count - 1 ? "text-right" : "text-center";
}

/** Las diferencias pesan (800); lo que coincide, menos (500); lo que falta va en gris. */
function weightClass(value: string | null, equal: boolean): string {
  if (value === null) return "font-normal text-muted";
  return equal ? "font-medium" : "font-extrabold";
}

interface CompareRowsProps {
  palas: Pala[];
  rows: SpecRow[];
}

/**
 * «Ficha técnica»: los atributos declarados de cada pala, fila a fila. Las filas
 * iguales llevan la marca «· igual» y pierden peso; las diferencias van en
 * negrita. En móvil la etiqueta va centrada y los valores en columnas, sin
 * tablas anchas. Sin puntuaciones.
 */
export function CompareRows({ palas, rows }: CompareRowsProps) {
  const three = palas.length === MAX_COMPARED;
  const mobileCols = three ? "grid-cols-3" : "grid-cols-2";
  const desktopCols = three ? "lg:grid-cols-[200px_1fr_1fr_1fr]" : "lg:grid-cols-[200px_1fr_1fr]";

  return (
    <section aria-labelledby="ficha-tecnica">
      <h2 id="ficha-tecnica" className={resultTitleClass}>
        Ficha técnica
      </h2>

      <div
        aria-hidden="true"
        className={cn("grid gap-3 pt-3.5 pb-1.5 text-[13px] font-black lg:gap-6 lg:pt-4 lg:pb-2.5 lg:text-[15px]", mobileCols, desktopCols)}
      >
        <span className="hidden lg:block" />
        {palas.map((pala, i) => (
          <span
            key={pala.id}
            className={cn(
              "flex min-w-0 items-center gap-1.5 lg:flex-row lg:justify-start lg:gap-2",
              i === palas.length - 1 && "flex-row-reverse",
              three && i === 1 && "justify-center",
            )}
          >
            <SlotBadge slot={SLOT_IDS[i]} className="size-5 text-[9px] lg:size-[22px] lg:text-[10px]" />
            <span className="truncate">{pala.model}</span>
          </span>
        ))}
      </div>

      <dl>
        {rows.map((row) => (
          <div
            key={row.label}
            className={cn(
              "border-t border-line py-3 lg:grid lg:min-h-[50px] lg:items-center lg:gap-6 lg:py-2",
              desktopCols,
            )}
          >
            <dt className="text-center font-mono text-[11px] font-bold tracking-[0.04em] text-muted uppercase lg:text-left lg:text-xs">
              {row.label}
              {row.equal && <span className="font-medium lg:normal-case"> · igual</span>}
            </dt>
            <dd className={cn("mt-1 grid gap-3 text-[15px] lg:contents", mobileCols)}>
              {row.values.map((value, i) => (
                <span
                  key={palas[i].id}
                  className={cn("lg:text-left", mobileAlign(i, row.values.length), weightClass(value, row.equal))}
                >
                  <span className="sr-only">{palas[i].model}: </span>
                  {value ?? "Sin datos"}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
