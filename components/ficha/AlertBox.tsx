import { maxTarget, suggestedTarget } from "@/alerts/service";
import { cn } from "@/lib/cn";
import { AlertForm } from "./AlertForm";

interface AlertBoxProps {
  id: string;
  slug: string;
  /** Mejor precio vigente de la pala; null si ahora no tiene (la alerta será de disponibilidad) */
  currentPrice: number | null;
  className?: string;
}

/**
 * «Avísame cuando baje de…»: alerta de precio por correo, sin cuenta. Con precio
 * vigente se elige un objetivo por debajo; sin él, se avisa cuando la pala vuelva
 * a estar a la venta.
 */
export function AlertBox({ id, slug, currentPrice, className }: AlertBoxProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className={cn("rounded-3xl bg-carbon p-5 text-white", className)}
    >
      <h2 id={`${id}-titulo`} className="text-xl font-black">
        {currentPrice === null ? "Avísame cuando esté disponible" : "Avísame cuando baje de…"}
      </h2>
      {currentPrice === null && (
        <p className="mt-2.5 text-sm leading-normal text-ash">
          Te escribiremos cuando alguna de las tiendas que seguimos vuelva a tener esta pala a la
          venta.
        </p>
      )}
      <AlertForm
        slug={slug}
        target={
          currentPrice === null
            ? null
            : { suggested: suggestedTarget(currentPrice), max: maxTarget(currentPrice) }
        }
      />
    </section>
  );
}
