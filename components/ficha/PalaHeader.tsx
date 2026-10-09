import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { Stars } from "@/components/ui/Rating";
import { formatCount, formatEuro, formatRating, pluralize } from "@/lib/format";
import { SHAPE_LABELS } from "@/lib/labels";
import { palaName } from "@/lib/pala-content";
import { routes } from "@/lib/routes";
import type { Pala } from "@/types/catalog";

interface PalaHeaderProps {
  pala: Pala;
  /** Ancla de la sección de opiniones */
  reviewsHref: string;
  /** Ancla del listado de tiendas */
  storesHref: string;
  /** Ancla de la alerta de precio; null si las alertas no están disponibles */
  alertHref: string | null;
  /** Salida para una pala sin precio cuando no hay alertas: otras palas que sí están a la venta */
  onSale: { label: string; href: string };
}

/** Marca, año y forma; nombre de la pala; precio de partida y las acciones que de verdad funcionan. */
export function PalaHeader({ pala, reviewsHref, storesHref, alertHref, onSale }: PalaHeaderProps) {
  const { price } = pala;
  const hasPrice = price !== null && price.freshness !== "stale";

  return (
    <header>
      <p className="text-sm text-muted">
        <Link href={routes.brand(pala.brand.slug)} className="underline-offset-2 hover:text-carbon hover:underline">
          {pala.brand.name}
        </Link>{" "}
        · {pala.year} · {SHAPE_LABELS[pala.shape]}
      </p>
      <h1 className="mt-1 text-[40px] leading-none font-black tracking-[-0.035em] text-balance lg:text-[56px]">
        {palaName(pala)}
      </h1>
      {/* Sin opiniones reales no se muestran estrellas ni número. */}
      {pala.reviewCount > 0 && (
        <p className="mt-2.5 flex items-center gap-2 text-sm">
          <Stars rating={pala.rating} className="text-base" />
          <strong aria-hidden="true">{formatRating(pala.rating)}</strong>
          <a href={reviewsHref} className="text-muted underline">
            {formatCount(pala.reviewCount)} opiniones
          </a>
        </p>
      )}
      {hasPrice && (
        <p className="mt-2.5 text-sm text-ink">
          Desde{" "}
          <a href={storesHref} className="text-lg font-bold whitespace-nowrap text-carbon tabular-nums">
            {formatEuro(price.current)}
          </a>{" "}
          en {pluralize(price.storeCount, "tienda", "tiendas")}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {hasPrice && (
          <a href={storesHref} className={buttonClass({})}>
            Ver precios
          </a>
        )}
        {alertHref && (
          <a href={alertHref} className={buttonClass({ variant: "outline" })}>
            {hasPrice ? "Crear alerta de precio" : "Avísame cuando esté disponible"}
          </a>
        )}
        {/* Sin precio y sin alertas, la ficha no se queda sin salida. */}
        {!hasPrice && !alertHref && (
          <Link href={onSale.href} className={buttonClass({ variant: "outline" })}>
            {onSale.label}
          </Link>
        )}
      </div>
    </header>
  );
}
