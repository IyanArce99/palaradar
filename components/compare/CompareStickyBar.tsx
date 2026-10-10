import Link from "next/link";
import { cn } from "@/lib/cn";
import { MAX_COMPARED, SLOT_IDS, type CompareSlotId } from "@/lib/compare";
import { formatEuro } from "@/lib/format";
import type { Pala } from "@/types/catalog";
import { offersHref } from "./CompareHeader";

const SLOT_BUTTON: Record<CompareSlotId, string> = {
  a: "bg-lime text-carbon",
  b: "bg-carbon text-white",
  c: "border-[1.5px] border-carbon bg-white text-carbon",
};

/**
 * Barra inferior de la comparación en móvil: un botón por pala con su precio,
 * que lleva a sus ofertas. Sustituye a la barra de pestañas en esta pantalla.
 */
export function CompareStickyBar({ palas }: { palas: Pala[] }) {
  const three = palas.length === MAX_COMPARED;

  return (
    <nav
      aria-label="Ofertas de cada pala"
      className={cn(
        "sticky bottom-0 z-20 grid gap-2 border-t border-line bg-white px-3 pt-2.5 pb-[calc(16px+env(safe-area-inset-bottom))] lg:hidden",
        three ? "grid-cols-3" : "grid-cols-2",
      )}
    >
      {palas.map((pala, i) => (
        <Link
          key={pala.id}
          href={offersHref(pala)}
          className={cn(
            "flex h-[54px] min-w-0 items-center justify-between gap-1.5 rounded-2xl px-3",
            SLOT_BUTTON[SLOT_IDS[i]],
          )}
        >
          <span className="min-w-0 leading-[1.1]">
            <span className="block truncate text-xs font-bold">{pala.model}</span>
            <span className="block text-base font-black whitespace-nowrap tabular-nums">
              {pala.price ? formatEuro(pala.price.current) : "Sin precio"}
            </span>
          </span>
          <span className="flex-none text-sm font-extrabold">
            {!three && (pala.price ? "Ofertas " : "Ficha ")}
            <span aria-hidden="true">→</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
