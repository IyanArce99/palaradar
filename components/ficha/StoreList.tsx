import { OutboundLink } from "@/components/analytics/OutboundLink";
import { buttonClass } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { EmptyNote } from "@/components/ui/EmptyNote";
import { cn } from "@/lib/cn";
import { formatDate, formatEuro, formatTimeAgo } from "@/lib/format";
import { outboundLink } from "@/lib/outbound";
import { canClaimCheapest } from "@/lib/pricing";
import { storeSpread } from "@/lib/store-spread";
import { StoreSpreadNote } from "@/components/pala/StoreSpreadNote";
import type { PriceSummary, RankedOffer } from "@/types/pricing";
import { SectionTitle } from "./SectionTitle";

interface StoreRowProps {
  offer: RankedOffer;
  cheapest: boolean;
  /** Puesto en la lista, empezando en 1 */
  position: number;
  palaSlug: string;
  /** Hay dos tiendas o más y sus totales son comparables: solo entonces se dice «la más barata» */
  claimCheapest: boolean;
}

/** Sin la regla de envío de la tienda no se afirma nada sobre el envío. */
function shippingText(shipping: number | null): string {
  if (shipping === null) return "Envío no verificado";
  return shipping > 0 ? `+${formatEuro(shipping)} de envío` : "Envío gratis";
}

function StoreRow({ offer, cheapest, position, palaSlug, claimCheapest }: StoreRowProps) {
  const cta = buttonClass({ variant: cheapest ? "dark" : "outline", size: "sm" });
  // Un enlace que no es una URL válida no se enseña como enlace.
  const link = outboundLink(offer.url, offer.store.slug);

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
          {cheapest && claimCheapest && (
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
          {/* Hoy no hay ningún programa de afiliación; cuando lo haya, se dice junto al enlace. */}
          {link?.affiliated && <span className="block">Enlace de afiliado</span>}
        </p>
      </div>
      <p className="text-[17px] font-black whitespace-nowrap tabular-nums">
        {formatEuro(offer.total)}
      </p>
      {link ? (
        <OutboundLink
          href={link.href}
          store={offer.store.slug}
          pala={palaSlug}
          price={offer.total}
          position={position}
          origin="ficha"
          className={cta}
        >
          Ir a la tienda
          <span className="sr-only"> {offer.store.name} (se abre en una pestaña nueva)</span>
        </OutboundLink>
      ) : (
        <span className="flex h-11 items-center rounded-[14px] bg-mist px-3.5 text-[13px] font-bold whitespace-nowrap text-muted">
          Sin enlace
        </span>
      )}
    </li>
  );
}

interface StoreListProps {
  price: PriceSummary | null;
  /** Slug de la pala, para medir los clics de salida */
  palaSlug: string;
  id: string;
  className?: string;
}

/** «Padel Nuestro», «Padel Nuestro y PadelProShop» */
function storeNames(offers: RankedOffer[]): string {
  const names = offers.map((offer) => offer.store.name);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

/** Precio por tienda, de más barata a más cara; la primera va destacada. */
export function StoreList({ price, palaSlug, id, className }: StoreListProps) {
  if (!price) {
    return (
      <section aria-labelledby={id} className={className}>
        <SectionTitle id={id}>Precios por tienda</SectionTitle>
        <EmptyNote className="mt-3.5">
          Ninguna de las tiendas que seguimos tiene esta pala a la venta ahora mismo. En cuanto
          vuelva a estar disponible, verás aquí su precio en cada tienda.
        </EmptyNote>
      </section>
    );
  }

  const unverified = price.offers.filter((offer) => offer.shipping === null);

  return (
    <section aria-labelledby={id} className={className}>
      <SectionTitle id={id}>Precios por tienda</SectionTitle>
      <p className="mt-1.5 text-[13px] leading-[1.45] text-pretty text-muted">
        {unverified.length > 0
          ? "Ordenadas por el importe que conocemos de cada una. El envío solo está incluido donde se indica."
          : "Precio final con envío, de más barata a más cara."}{" "}
        {price.freshness === "stale"
          ? `Sin comprobar desde el ${formatDate(price.checkedAt)}.`
          : `Comprobado ${formatTimeAgo(price.checkedAt, price.asOf)}.`}
      </p>
      <ol className="mt-3.5 overflow-hidden rounded-[18px] border border-line">
        {price.offers.map((offer, i) => (
          <StoreRow
            key={offer.store.id}
            offer={offer}
            cheapest={i === 0}
            position={i + 1}
            palaSlug={palaSlug}
            claimCheapest={canClaimCheapest(price.offers)}
          />
        ))}
      </ol>
      {/* Cuánto cambia el precio de una tienda a otra: solo existe con dos precios vigentes. */}
      <StoreSpreadNote
        spread={storeSpread(price.offers, new Date(price.asOf))}
        asOf={price.asOf}
        className="mt-3"
      />
      {/* Con un envío sin verificar no se puede afirmar cuál es el total más bajo. */}
      {unverified.length > 0 && price.offers.length > 1 && (
        <p className="mt-2.5 text-[13px] leading-[1.45] text-pretty text-muted">
          No hemos verificado los gastos de envío de {storeNames(unverified)}, así que su importe no los incluye. El
          orden puede cambiar al sumarlos y por eso no señalamos ninguna tienda como la más barata. Compruébalo en la
          tienda antes de comprar.
        </p>
      )}
      <DemoNotice className="mt-3">
        Tiendas y precios de prueba: no son ofertas reales. Los enlaces se activarán con ellas.
      </DemoNotice>
    </section>
  );
}
