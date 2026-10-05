import { cn } from "@/lib/cn";
import { HISTORY_WINDOW_DAYS, RECENT_PRICE_LABEL } from "@/lib/pricing";

/**
 * Indicación discreta junto a un precio que todavía no tiene veredicto: la pala
 * lleva menos de 30 días en seguimiento. No es una oferta ni un aviso, así que
 * va en gris, sin negrita y sin punto de color.
 */
export function RecentPriceNote({ className }: { className?: string }) {
  return (
    <span
      title={`Seguimos este precio desde hace menos de ${HISTORY_WINDOW_DAYS} días: todavía no lo comparamos con su histórico.`}
      className={cn("text-xs font-normal whitespace-nowrap text-muted", className)}
    >
      {RECENT_PRICE_LABEL}
    </span>
  );
}
