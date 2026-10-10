import Link from "next/link";
import { CompareToggle } from "@/components/compare/CompareSelection";
import { FavoriteToggle } from "@/components/favorites/FavoriteToggle";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { PriceDropBadge } from "@/components/ui/PriceDropBadge";
import { RatingInline } from "@/components/ui/Rating";
import { cn } from "@/lib/cn";
import { formatEuro, formatRating, pluralize } from "@/lib/format";
import { SHAPE_LABELS } from "@/lib/labels";
import { palaAlt } from "@/lib/media";
import { routes } from "@/lib/routes";
import type { PalaSummary } from "@/types/catalog";

type Variant = "catalog" | "offer" | "alternative";

interface PalaCardProps {
  pala: PalaSummary;
  /** catalog: descripción y tiendas · offer: precio anterior y bajada · alternative: motivo y forma */
  variant?: Variant;
  /** Motivo destacado en la variante alternative ("Más control") */
  badge?: string;
  /** Alto y radio de la foto */
  photoClassName?: string;
  /** Destino de la tarjeta; por defecto, la ficha de la pala */
  href?: string;
  /** Enseña los botones de guardar y de comparar sobre la foto (listados del catálogo) */
  compare?: boolean;
  className?: string;
}

const priceClass = "font-black tabular-nums whitespace-nowrap";
const cardLinkClass = "outline-none group-hover:underline after:absolute after:inset-0";

function CardPrice({ pala, variant }: { pala: PalaSummary; variant: Variant }) {
  if (pala.price === null) {
    return <p className="mt-2 text-sm text-muted">Sin precio disponible ahora</p>;
  }

  // Un precio todavía sin veredicto («precio reciente») no se anuncia en las tarjetas:
  // cuando lo son casi todos, la etiqueta no distingue ninguna. Se explica en la ficha.
  if (variant === "offer") {
    return (
      <p className="mt-1.5 flex flex-wrap items-baseline gap-2">
        <span className={cn(priceClass, "text-xl")}>{formatEuro(pala.price)}</span>
        {pala.previousPrice !== null && pala.dropPercent !== null && (
          <>
            <s className="text-sm whitespace-nowrap text-muted tabular-nums">
              <span className="sr-only">Antes </span>
              {formatEuro(pala.previousPrice)}
            </s>
            <PriceDropBadge percent={pala.dropPercent} />
          </>
        )}
      </p>
    );
  }

  if (variant === "alternative") {
    return <p className={cn(priceClass, "mt-1.5 text-lg")}>{formatEuro(pala.price)}</p>;
  }

  return (
    <>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <span className={cn(priceClass, "text-xl tracking-[-0.01em] lg:text-2xl")}>{formatEuro(pala.price)}</span>
        <span className="text-xs whitespace-nowrap text-muted">
          en {pluralize(pala.storeCount, "tienda", "tiendas")}
        </span>
      </p>
      {pala.priceNote && (
        <p className="mt-0.5 text-xs font-bold text-forest">
          <span aria-hidden="true">● </span>
          {pala.priceNote}
        </p>
      )}
    </>
  );
}

/** Tarjeta de pala reutilizable: catálogo, ofertas y alternativas. */
export function PalaCard({
  pala,
  variant = "catalog",
  badge,
  photoClassName = "h-[170px] lg:h-[260px]",
  href = routes.pala(pala.slug),
  compare = false,
  className,
}: PalaCardProps) {
  const fullName = `${pala.brand.name} ${pala.model}`;

  return (
    <article
      className={cn(
        // El enlace cubre toda la tarjeta, así que el foco se dibuja sobre ella.
        // Con `h-full` (lo pasan las cuadrículas donde la tarjeta es lo único de su celda) el
        // precio va al pie: en una fila quedan alineados aunque un nombre ocupe dos líneas.
        "group relative flex flex-col gap-2.5 rounded-2xl has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-carbon",
        className,
      )}
    >
      <PalaPhoto
        src={pala.image}
        alt={palaAlt(pala)}
        className={cn("rounded-2xl transition-[filter] group-hover:brightness-[0.97]", photoClassName)}
      />
      {compare && (
        <>
          <FavoriteToggle
            pala={{ slug: pala.slug, name: fullName, price: pala.price }}
            origin="listado"
            className="absolute top-2 left-2"
          />
          <CompareToggle pala={{ slug: pala.slug, name: fullName }} className="absolute top-2 right-2" />
        </>
      )}
      <div className="flex flex-1 flex-col">
        {variant === "alternative" ? (
          <>
            {badge && (
              <span className="mb-2 self-start rounded-2xl bg-lime-soft px-2 py-1 text-xs font-extrabold text-forest">
                {badge}
              </span>
            )}
            <h3 className="text-base leading-snug font-extrabold">
              <Link href={href} className={cardLinkClass}>
                {fullName}
              </Link>
            </h3>
            <p className="mt-0.5 text-sm text-muted">
              {pala.reviewCount > 0 && (
                <>
                  <span aria-hidden="true">★ </span>
                  {formatRating(pala.rating)} ·{" "}
                </>
              )}
              {SHAPE_LABELS[pala.shape]}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-1.5 text-xs">
              <span className="text-muted">
                {pala.brand.name} · {pala.year}
              </span>
              {pala.reviewCount > 0 && (
                <RatingInline rating={pala.rating} reviewCount={pala.reviewCount} />
              )}
            </div>
            <h3 className="mt-0.5 text-base leading-snug font-extrabold lg:text-lg">
              <Link href={href} className={cardLinkClass}>
                {pala.model}
              </Link>
            </h3>
            {variant === "catalog" && (
              <p className="mt-[3px] min-h-[35px] text-sm leading-snug text-ink">
                {pala.description}
              </p>
            )}
          </>
        )}
        <div className="mt-auto">
          <CardPrice pala={pala} variant={variant} />
        </div>
      </div>
    </article>
  );
}
