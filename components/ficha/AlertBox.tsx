import { cn } from "@/lib/cn";

interface AlertBoxProps {
  id: string;
  /** Sin precio actual no hay umbral de bajada que ofrecer: la alerta será de disponibilidad. */
  hasPrice: boolean;
  className?: string;
}

/**
 * «Avísame cuando baje». El bloque del diseño se mantiene en su sitio; mientras
 * las alertas no existan, lo dice sin ofrecer un formulario que no haría nada.
 */
export function AlertBox({ id, hasPrice, className }: AlertBoxProps) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className={cn("rounded-[22px] bg-carbon p-[22px] text-white", className)}>
      <h2 id={`${id}-titulo`} className="text-xl font-black">
        {hasPrice ? "Avísame cuando baje" : "Avísame cuando esté disponible"}
      </h2>
      <p className="mt-2.5 text-sm leading-[1.45] text-ash">
        {hasPrice
          ? "Muy pronto podrás elegir un precio y te avisaremos cuando encontremos ese precio o uno inferior en cualquier tienda."
          : "Muy pronto podrás pedirnos que te avisemos cuando alguna de las tiendas que seguimos vuelva a tener esta pala a la venta."}
      </p>
    </section>
  );
}
