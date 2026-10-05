import Link from "next/link";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { RecentPriceNote } from "@/components/ui/RecentPriceNote";
import { priceHeading } from "@/lib/compare";
import { formatEuro, formatTimeAgo, pluralize } from "@/lib/format";
import { palaAlt } from "@/lib/media";
import { routes } from "@/lib/routes";
import type { Pala } from "@/types/catalog";

/** Precio de una pala en la cabecera, con la misma lectura de frescura que la ficha. */
function HeaderPrice({ pala }: { pala: Pala }) {
  const { price } = pala;

  return (
    <div className="mt-2 lg:mt-0 lg:shrink-0 lg:text-right">
      <p className={price ? "text-xs text-muted" : "text-sm font-bold text-ink"}>
        {priceHeading(price)}
      </p>
      {price && (
        <>
          <p className="text-[21px] font-black whitespace-nowrap tabular-nums lg:text-[28px]">
            {formatEuro(price.current)}
          </p>
          <p className="text-xs leading-[1.4] text-muted">
            en {pluralize(price.storeCount, "tienda", "tiendas")}
            {price.bestOffer.shipping === null && " · envío no incluido"}
            {price.freshness !== "current" &&
              ` · comprobado ${formatTimeAgo(price.checkedAt, price.asOf)}`}
          </p>
          {price.verdict.status === "recent" && <RecentPriceNote className="block leading-[1.4]" />}
        </>
      )}
    </div>
  );
}

/** Las dos palas frente a frente: foto, marca y año, modelo y mejor precio. */
export function CompareHeader({ palas }: { palas: [Pala, Pala] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:gap-10">
      {palas.map((pala) => (
        <article key={pala.id} className="relative">
          <PalaPhoto
            src={pala.images[0] ?? null}
            alt={palaAlt(pala)}
            sizes="(min-width: 1024px) 440px, 50vw"
            // Las dos fotos abren la página: se cargan con prioridad.
            priority
            className="h-[170px] rounded-2xl lg:h-[360px] lg:rounded-3xl"
          />
          <div className="mt-2.5 lg:mt-4 lg:flex lg:items-end lg:justify-between lg:gap-4">
            <div>
              <p className="text-xs text-muted lg:text-sm">
                {pala.brand.name} · {pala.year}
              </p>
              <h2 className="text-base leading-[1.15] font-extrabold lg:text-[26px] lg:font-black lg:tracking-[-0.02em]">
                <Link href={routes.pala(pala.slug)} className="after:absolute after:inset-0">
                  {pala.model}
                </Link>
              </h2>
            </div>
            <HeaderPrice pala={pala} />
          </div>
        </article>
      ))}
    </div>
  );
}
