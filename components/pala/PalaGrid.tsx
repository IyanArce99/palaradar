import { cn } from "@/lib/cn";
import type { PalaSummary } from "@/types/catalog";
import { PalaCard } from "./PalaCard";

const COLUMNS = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
} as const;

interface PalaGridProps {
  palas: PalaSummary[];
  variant?: "catalog" | "offer";
  /** Columnas en escritorio; en móvil siempre son dos */
  columns?: keyof typeof COLUMNS;
  /** Fotos más bajas, para cuadrículas de cuatro columnas junto a los filtros */
  dense?: boolean;
  className?: string;
}

export function PalaGrid({ palas, variant = "catalog", columns = 3, dense = false, className }: PalaGridProps) {
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-x-3 gap-y-6",
        dense ? "lg:gap-x-5 lg:gap-y-9" : "lg:gap-x-6 lg:gap-y-10",
        COLUMNS[columns],
        className,
      )}
    >
      {palas.map((pala) => (
        <li key={pala.id}>
          {/* En los listados cada tarjeta se puede guardar y añadir a la comparación. */}
          <PalaCard
            pala={pala}
            variant={variant}
            compare
            photoClassName={dense ? "h-[170px] lg:h-[210px]" : undefined}
          />
        </li>
      ))}
    </ul>
  );
}
