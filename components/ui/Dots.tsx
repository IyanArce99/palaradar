import { cn } from "@/lib/cn";

const MAX_DOTS = 5;

interface DotsProps {
  /** De 1 a 5 */
  score: number;
  className?: string;
}

/** Escala de sensaciones en puntos: ●●●●○ */
export function Dots({ score, className }: DotsProps) {
  const filled = Math.min(MAX_DOTS, Math.max(0, Math.round(score)));

  return (
    <span
      role="img"
      aria-label={`${filled} de ${MAX_DOTS}`}
      className={cn("font-bold tracking-[2px] whitespace-nowrap", className)}
    >
      <span aria-hidden="true">{"●".repeat(filled)}</span>
      <span aria-hidden="true" className="text-dot-off">
        {"●".repeat(MAX_DOTS - filled)}
      </span>
    </span>
  );
}
