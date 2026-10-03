import { buttonClass } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { cn } from "@/lib/cn";
import { formatDate, formatEuro, formatTimeAgo } from "@/lib/format";
import type { PriceSummary, RankedOffer } from "@/types/pricing";
import { SectionTitle } from "./SectionTitle";

interface StoreRowProps {
  offer: RankedOffer;
  cheapest: boolean;
}

/** Sin la regla de envío de la tienda no se afirma nada sobre el envío. */
function shippingText(shipping: number | null): string {
  if (shipping === null) return "Envío no incluido";
  return shipping > 0 ? `+${formatEuro(shipping)} de envío` : "Envío gratis";
}

function StoreRow({ offer, cheapest }: StoreRowProps) {
  const cta = buttonClass({ variant: cheapest ? "dark" : "outline", size: "sm" });

  return (
    <li
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 px-3 py-3.5 lg:gap-3 lg:px-4",
        cheapest
          ? "rounded-2xl border-2 border-lime-border bg-lime-tint"
          : "border-t border-line first:border-t-0",
      )}
    >
      <div>
        <p className="text-[15px] font-extrabold">
          {offer.store.name}
          {cheapest && (
            <span className="block text-xs font-bold text-forest lg:inline">
              <span className="hidden lg:inline"> · </span>
              la más barata
            </span>
          )}
        </p>
        {/* En móvil, envío y disponibilidad van en líneas propias para no partirse a medias */}
        <p className="text-xs text-muted">
          <span className="block lg:inline">
            {shippingText(offer.shipping)}
          </span>
          <span className="hidden lg:inline"> · </span>
          <span className="block lg:inline">{offer.availability}</span>
        </p>
      </div>
      <p className="text-[17px] font-black whitespace-nowrap tabular-nums">
        {formatEuro(offer.total)}
      </p>
      {offer.url ? (
        <a href={offer.url} target="_blank" rel="noopener nofollow sponsored" className={cta}>
          Ir a la tienda
          <span className="sr-only"> {offer.store.name} (se abre en una pestaña nueva)</span>
        </a>
      ) : (
        <span className="flex h-11 items-center rounded-[14px] bg-mist px-3.5 text-[13px] font-bold whitespace-nowrap text-muted">
          Sin enlace
        </span>
      )}
    </li>
  );
}

interface StoreListProps {
  price: PriceSummary;
  id: string;
}

/** Precio por tienda, de más barata a más cara; la primera va destacada. */
export function StoreList({ price, id }: StoreListProps) {
  return (
    <section aria-labelledby={id}>
      <SectionTitle id={id}>Precios en todas las tiendas</SectionTitle>
      <p className="mt-1.5 text-[13px] leading-[1.45] text-pretty text-muted">
        {price.offers.some((offer) => offer.shipping === null)
          ? "De más barata a más cara. El envío solo está incluido donde se indica."
          : "Precio final con envío, de más barata a más cara."}{" "}
        {price.freshness === "stale"
          ? `Sin comprobar desde el ${formatDate(price.checkedAt)}.`
          : `Comprobado ${formatTimeAgo(price.checkedAt, price.asOf)}.`}
      </p>
      <ol className="mt-3.5 overflow-hidden rounded-[18px] border border-line">
        {price.offers.map((offer, i) => (
          <StoreRow key={offer.store.id} offer={offer} cheapest={i === 0} />
        ))}
      </ol>
      <DemoNotice className="mt-3">
        Tiendas y precios de prueba: no son ofertas reales. Los enlaces se activarán con ellas.
      </DemoNotice>
    </section>
  );
}
