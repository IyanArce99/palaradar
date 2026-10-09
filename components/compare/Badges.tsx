import { cn } from "@/lib/cn";
import type { CompareSlotId } from "@/lib/compare";

// Cada pala lleva siempre su letra además del color, también en las barras:
// distinguirlas no puede depender solo del color.
const SLOT_BADGE: Record<CompareSlotId, string> = {
  a: "bg-carbon text-lime",
  b: "bg-lime text-carbon",
  c: "border-2 border-carbon bg-white text-carbon",
};

/** Relleno de la barra de cada pala: sólida, lima con borde interior y rayada. */
export const SLOT_BAR: Record<CompareSlotId, string> = {
  a: "bg-carbon",
  b: "bg-lime shadow-[inset_0_0_0_1.5px_#15171a]",
  c: "bg-[repeating-linear-gradient(135deg,#15171a_0_3px,#fff_3px_6px)] shadow-[inset_0_0_0_1.5px_#15171a]",
};

interface SlotBadgeProps {
  slot: CompareSlotId;
  /** Tamaño del círculo y de la letra; por defecto, 28 px */
  className?: string;
}

/** Insignia con la letra de la pala (A, B o C). */
export function SlotBadge({ slot, className }: SlotBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-full font-mono font-bold uppercase",
        SLOT_BADGE[slot],
        className ?? "size-7 text-[13px]",
      )}
    >
      {slot}
    </span>
  );
}

interface VsBadgeProps {
  /** Tamaño del círculo, del texto y del anillo blanco; por defecto, el pequeño de las tarjetas */
  className?: string;
}

/** Círculo «VS» entre dos palas, con anillo blanco para separarlo de lo que pisa. */
export function VsBadge({ className }: VsBadgeProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative z-[2] flex flex-none items-center justify-center rounded-full bg-carbon font-mono font-bold tracking-[0.04em] text-lime",
        className ?? "size-7 text-[9px] shadow-[0_0_0_3px_#fff]",
      )}
    >
      VS
    </span>
  );
}
