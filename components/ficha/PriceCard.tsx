import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatEuro, pluralize } from "@/lib/format";
import type { PriceSummary, PriceVerdict } from "@/types/pricing";

const STATUS_DOT: Record<PriceVerdict["status"], string> = {
  good: "bg-lime-deep shadow-[0_0_0_4px_#e3f5b0]",
  fair: "bg-muted shadow-[0_0_0_4px_var(--color-line)]",
  wait: "bg-wait shadow-[0_0_0_4px_#f8e9c8]",
  stale: "bg-ash shadow-[0_0_0_4px_var(--color-line-soft)]",
};

function PriceRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-[42px] items-center justify-between border-t border-line text-[15px]">
      <dt className="text-ink">{label}</dt>
      <dd className="font-bold whitespace-nowrap tabular-nums">{formatEuro(value)}</dd>
    </div>
  );
}

interface PriceCardProps {
  price: PriceSummary;
  /** Ancla del listado de tiendas */
  storesHref: string;
  className?: string;
}

/** Mejor precio hoy, con el veredicto en una frase y solo tres cifras de contexto. */
export function PriceCard({ price, storesHref, className }: PriceCardProps) {
  return (
    <section
      aria-label="Mejor precio"
      className={cn("rounded-[22px] border-2 border-carbon p-5 lg:p-6", className)}
    >
      <h2 className="text-[13px] font-bold text-muted">
        {price.isStale ? "Último precio conocido" : "Mejor precio hoy"}
      </h2>
      <p className="mt-0.5 text-[44px] leading-[1.05] font-black tracking-[-0.035em] whitespace-nowrap tabular-nums">
        {formatEuro(price.current)}
      </p>
      <p className="text-sm text-ink">
        en {price.bestOffer.store.name} · comparado en{" "}
        {pluralize(price.storeCount, "tienda", "tiendas")}
      </p>

      <div className="mt-4 border-t border-line pt-4">
        <p className="flex items-center gap-2 text-base font-extrabold">
          <span
            aria-hidden="true"
            className={cn("size-3 rounded-full", STATUS_DOT[price.verdict.status])}
          />
          {price.verdict.label}
        </p>
        <p className="mt-1.5 text-[15px] leading-normal text-ink">{price.verdict.detail}</p>
      </div>

      <dl className="mt-3.5">
        <PriceRow label="Precio actual" value={price.current} />
        {price.average90 !== null && (
          <PriceRow label="Media últimos 90 días" value={price.average90} />
        )}
        {price.historicalMin && (
          <PriceRow label="Mínimo histórico" value={price.historicalMin.price} />
        )}
      </dl>

      <a href={storesHref} className={buttonClass({ size: "lg", className: "mt-4 w-full" })}>
        Ver precios en todas las tiendas
      </a>
    </section>
  );
}
