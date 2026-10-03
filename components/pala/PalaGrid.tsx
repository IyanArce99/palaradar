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
  className?: string;
}

export function PalaGrid({ palas, variant = "catalog", columns = 3, className }: PalaGridProps) {
  return (
    <ul className={cn("grid grid-cols-2 gap-x-3 gap-y-6 lg:gap-x-6 lg:gap-y-10", COLUMNS[columns], className)}>
      {palas.map((pala) => (
        <li key={pala.id}>
          <PalaCard pala={pala} variant={variant} />
        </li>
      ))}
    </ul>
  );
}
