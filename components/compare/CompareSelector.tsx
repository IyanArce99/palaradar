import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/cn";
import {
  compareSelectPath,
  compareSetPath,
  MAX_COMPARED,
  MIN_COMPARED,
  SLOT_IDS,
  type CompareSelection,
  type CompareSlotId,
} from "@/lib/compare";
import type { Pala, PalaSuggestion } from "@/types/catalog";
import { VsBadge } from "./Badges";
import { CompareSlot } from "./CompareSlot";
import { PalaPicker, type PickerChip } from "./PalaPicker";

export interface SelectorSlot {
  id: CompareSlotId;
  pala: Pala | null;
  /** Búsqueda enviada desde este hueco y sus resultados (camino sin JavaScript) */
  search: string;
  results: PalaSuggestion[];
  chips: PickerChip[];
}

interface CompareSelectorProps {
  /** Los huecos que se enseñan: dos o, con el tercero abierto, tres */
  slots: SelectorSlot[];
}

const CTA_CLASS =
  "flex h-14 items-center justify-center gap-2 rounded-full px-[22px] text-[15px] font-extrabold whitespace-nowrap lg:h-[60px] lg:min-w-[280px]";

/**
 * Selector del comparador: los huecos frente a frente con «VS» entre ellos, la
 * opción de añadir una tercera pala y el botón que lleva a la comparación.
 */
export function CompareSelector({ slots }: CompareSelectorProps) {
  const three = slots.length === MAX_COMPARED;
  const selection: CompareSelection = { third: three };
  for (const slot of slots) selection[slot.id] = slot.pala?.slug ?? null;

  const chosen = slots.flatMap((slot) => (slot.pala ? [slot.pala] : []));
  const slugs = [...new Set(chosen.map((pala) => pala.slug))];
  const repeated = slugs.length < chosen.length;
  const ready = !repeated && slugs.length >= MIN_COMPARED;
  const third = slots.find((slot) => slot.id === "c");

  let hint: string | null = "Elige dos palas para empezar";
  if (repeated) hint = "Has elegido la misma pala dos veces: cambia una.";
  else if (ready) hint = slugs.length === MAX_COMPARED ? "Comparando 3 palas" : null;

  return (
    <div>
      <div className={cn("relative mx-auto", three ? "max-w-[1180px]" : "max-w-[900px]")}>
        {/* Anillos concéntricos tras las tarjetas: guiño al radar de la marca. */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 rounded-full border border-line lg:block",
            three ? "size-[560px]" : "size-[460px]",
          )}
        >
          <div className="absolute inset-[16%] rounded-full border border-line" />
          <div className="absolute inset-[32%] rounded-full border border-line" />
        </div>

        <div
          className={cn(
            "relative text-left lg:grid lg:items-stretch",
            three ? "lg:grid-cols-[1fr_56px_1fr_56px_1fr]" : "lg:grid-cols-[1fr_72px_1fr]",
          )}
        >
          {slots.map((slot, i) => (
            <Fragment key={slot.id}>
              {i > 0 && (
                <div className="relative z-[2] -my-3.5 flex items-center justify-center lg:my-0">
                  <VsBadge
                    className={cn(
                      "size-11 text-[13px] shadow-[0_0_0_6px_#fff]",
                      three ? "lg:size-12 lg:text-sm" : "lg:size-[60px] lg:text-lg",
                    )}
                  />
                </div>
              )}
              {slot.pala ? (
                <CompareSlot
                  slot={slot.id}
                  pala={slot.pala}
                  changeHref={compareSelectPath({ ...selection, [slot.id]: null })}
                  compact={three}
                />
              ) : (
                <PalaPicker
                  // La búsqueda enviada forma parte de la identidad del buscador.
                  key={slot.search}
                  slot={slot.id}
                  selection={selection}
                  defaultQuery={slot.search}
                  serverResults={slot.results}
                  chips={slot.chips}
                  compact={three}
                />
              )}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="mt-3.5 flex flex-col gap-2.5 lg:mt-6 lg:items-center lg:gap-3.5">
        {three ? (
          <p className="text-center text-[13px] text-muted">
            Máximo {MAX_COMPARED} palas
            {/* En móvil, la pala elegida ya se quita con su «×»; el enlace solo hace falta si el hueco está vacío. */}
            <span className={cn(third?.pala && "hidden lg:inline")}>
              {" · "}
              <Link
                href={compareSelectPath({ ...selection, c: null, third: false })}
                className="inline-flex min-h-11 items-center font-bold text-carbon underline"
              >
                Quitar {third?.pala ? `la ${third.pala.model}` : "la tercera"}
              </Link>
            </span>
          </p>
        ) : (
          <Link
            href={compareSelectPath({ ...selection, third: true })}
            className="flex h-[46px] items-center justify-center gap-1.5 rounded-full border-[1.5px] border-dashed border-[#9a9f95] px-5 text-sm font-bold whitespace-nowrap hover:border-carbon"
          >
            + Añadir otra pala <span className="font-medium text-muted">(hasta {MAX_COMPARED})</span>
          </Link>
        )}

        <div className="flex flex-col gap-2 lg:mt-1.5 lg:items-center">
          {ready ? (
            <Link
              href={compareSetPath(slugs)}
              className={cn(CTA_CLASS, "bg-lime text-carbon shadow-[0_2px_0_#9fc21f] hover:bg-[#bde52f]")}
            >
              <span>
                Comparar {slugs.length === MAX_COMPARED && <span className="lg:hidden">3 </span>}palas
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(CTA_CLASS, "cursor-default bg-line-soft text-[#8a8f86]")}>
              Comparar palas
            </span>
          )}
          {/* Con tres palas, en móvil el propio botón ya dice «Comparar 3 palas». */}
          {hint && <p className={cn("text-center text-[13px] text-muted", ready && "hidden lg:block")}>{hint}</p>}
        </div>
      </div>
    </div>
  );
}

/** Los huecos que se enseñan: A y B siempre; C solo si está abierto. */
export function visibleSlots(third: boolean): CompareSlotId[] {
  return SLOT_IDS.filter((id) => id !== "c" || third);
}
