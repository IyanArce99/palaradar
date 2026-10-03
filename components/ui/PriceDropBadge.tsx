import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";

interface PriceDropBadgeProps {
  percent: number;
  className?: string;
}

/** Etiqueta de bajada: siempre con ▼, no solo con color. */
export function PriceDropBadge({ percent, className }: PriceDropBadgeProps) {
  return (
    <span
      className={cn(
        "rounded bg-lime-soft px-1.5 py-[3px] text-xs font-extrabold whitespace-nowrap text-forest",
        className,
      )}
    >
      <span aria-hidden="true">▼ </span>
      <span className="sr-only">Baja un </span>
      {formatPercent(percent)}
    </span>
  );
}
