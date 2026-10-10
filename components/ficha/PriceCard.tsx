import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { priceHeading } from "@/lib/compare";
import { formatEuro, formatEuroCompact, formatPercent, formatTimeAgo, pluralize } from "@/lib/format";
import { msrpSaving } from "@/lib/pricing";
import type { PriceSummary, PriceVerdict } from "@/types/pricing";

const STATUS_DOT: Record<PriceVerdict["status"], string> = {
  good: "bg-lime-deep shadow-[0_0_0_4px_#e3f5b0]",
  fair: "bg-muted shadow-[0_0_0_4px_var(--color-line)]",
  wait: "bg-wait shadow-[0_0_0_4px_#f8e9c8]",
  recent: "bg-muted shadow-[0_0_0_4px_var(--color-line)]",
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
  price: PriceSummary | null;
  /** Precio de venta recomendado (PVPR), si se conoce */
  msrp: number | null;
  /** Ancla del listado de tiendas */
  storesHref: string;
  /** Ancla del bloque «Avísame cuando baje»; null si las alertas no están disponibles */
  alertHref: string | null;
  /** Salida para una pala sin precio cuando no hay alertas: otras palas que sí están a la venta */
  onSale: { label: string; href: string };
  className?: string;
}

/** Mejor precio hoy, con el veredicto en una frase y, como mucho, tres cifras de contexto. */
export function PriceCard({ price, msrp, storesHref, alertHref, onSale, className }: PriceCardProps) {
  const frame = cn("rounded-[22px] border-2 border-carbon p-5 lg:p-6", className);
  // El ahorro sobre el PVPR solo se dice con un precio vigente.
  const saving = price && price.freshness !== "stale" ? msrpSaving(price.current, msrp) : null;

  if (!price) {
    return (
      <section aria-label="Mejor precio" className={frame}>
        <p className="text-[13px] font-bold text-muted">Mejor precio hoy</p>
        <p className="mt-0.5 text-[26px] leading-[1.1] font-black tracking-[-0.025em]">
          Sin precio ahora mismo
        </p>
        <p className="mt-2 text-[15px] leading-normal text-ink">
          Ninguna de las tiendas que seguimos tiene esta pala a la venta en este momento.
        </p>
        {alertHref ? (
          <a href={alertHref} className={buttonClass({ variant: "outline", className: "mt-4 w-full" })}>
            Avísame cuando esté disponible
          </a>
        ) : (
          <Link href={onSale.href} className={buttonClass({ variant: "outline", className: "mt-4 w-full" })}>
            {onSale.label}
          </Link>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Mejor precio" className={frame}>
      <p className="text-[13px] font-bold text-muted">
        {priceHeading(price)}
      </p>
      <p className="mt-0.5 text-[44px] leading-[1.05] font-black tracking-[-0.035em] whitespace-nowrap tabular-nums">
        {formatEuro(price.current)}
      </p>
      <p className="text-sm text-ink">
        en {price.bestOffer.store.name} ·{" "}
        {price.storeCount >= 2
          ? `comparado en ${pluralize(price.storeCount, "tienda", "tiendas")}`
          : "única tienda con precio hoy"}
        {/* Sin el envío verificado, el importe es solo el de la pala: se dice junto al precio. */}
        {price.bestOffer.shipping === null && " · envío no incluido"}
        {price.freshness !== "current" &&
          ` · comprobado ${formatTimeAgo(price.checkedAt, price.asOf)}`}
      </p>
      {saving !== null && msrp !== null && (
        <p className="mt-2 inline-block rounded-lg bg-lime-soft px-2 py-1 text-[13px] font-extrabold text-forest">
          {formatPercent(saving)} por debajo de su PVPR ({formatEuroCompact(msrp)})
        </p>
      )}

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
        {/* Media y mínimo solo existen con 30 días de histórico. */}
        {price.average30 !== null && (
          <PriceRow label="Media últimos 30 días" value={price.average30} />
        )}
        {price.min30 && <PriceRow label="Mínimo últimos 30 días" value={price.min30.price} />}
        {msrp !== null && <PriceRow label="Precio recomendado (PVPR)" value={msrp} />}
      </dl>

      <div className="mt-4 grid gap-2">
        <a href={storesHref} className={buttonClass({ size: "lg" })}>
          Ver el precio en cada tienda
        </a>
        {alertHref && (
          <a href={alertHref} className={buttonClass({ variant: "outline" })}>
            Avísame cuando baje de precio
          </a>
        )}
      </div>
    </section>
  );
}
