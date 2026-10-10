import Link from "next/link";
import { Fragment } from "react";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { RecentPriceNote } from "@/components/ui/RecentPriceNote";
import { cn } from "@/lib/cn";
import { MAX_COMPARED, priceHeading, SLOT_IDS, type CompareSlotId } from "@/lib/compare";
import { priceFacts } from "@/lib/compare-insights";
import { formatEuro, formatTimeAgo, pluralize } from "@/lib/format";
import { SHAPE_LABELS } from "@/lib/labels";
import { palaAlt } from "@/lib/media";
import { routes } from "@/lib/routes";
import type { Pala } from "@/types/catalog";
import { SlotBadge, VsBadge } from "./Badges";

const STORES_ANCHOR = "#tiendas";

/** Enlace a las ofertas de una pala: sus tiendas en la ficha o, sin precio, la ficha. */
export function offersHref(pala: Pala): string {
  return `${routes.pala(pala.slug)}${pala.price ? STORES_ANCHOR : ""}`;
}

export const OFFERS_BUTTON =
  "flex items-center justify-center gap-2 rounded-full bg-lime px-[22px] text-base font-extrabold whitespace-nowrap text-carbon shadow-[0_2px_0_#9fc21f] hover:bg-[#bde52f]";

/** «Ahorras X € · ● en stock en N tiendas», con lo que haya de las dos cosas. */
function SavingLine({ pala, className }: { pala: Pala; className?: string }) {
  const { current, saving, inStock } = priceFacts(pala);
  if (current === null || (!saving && inStock === 0)) return null;

  return (
    <p className={cn("font-extrabold text-forest", className)}>
      {saving && <>Ahorras {formatEuro(saving.amount)}</>}
      {saving && inStock > 0 && " · "}
      {inStock > 0 && <>● en stock en {pluralize(inStock, "tienda", "tiendas")}</>}
    </p>
  );
}

/** Caja de precio de escritorio: mejor precio, PVPR tachado, ahorro, stock y «Ver ofertas». */
function PriceBox({ pala, stacked }: { pala: Pala; stacked: boolean }) {
  const { price } = pala;
  const { msrp } = priceFacts(pala);

  return (
    <div
      className={cn(
        "hidden gap-3 rounded-3xl bg-mist p-4 lg:flex",
        stacked ? "flex-col" : "items-end justify-between",
      )}
    >
      <div className="min-w-0">
        <p className={price ? "text-xs text-muted" : "text-sm font-bold text-ink"}>
          {priceHeading(price)}
          {price && ` · ${price.bestOffer.store.name}`}
        </p>
        {price && (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2.5">
              <span className="text-3xl leading-snug font-black tracking-[-0.02em] whitespace-nowrap tabular-nums">
                {formatEuro(price.current)}
              </span>
              {msrp !== null && (
                <s className="text-sm whitespace-nowrap text-muted tabular-nums">{formatEuro(msrp)}</s>
              )}
            </p>
            <SavingLine pala={pala} className="text-sm" />
            {price.freshness !== "current" && (
              <p className="text-xs text-muted">Comprobado {formatTimeAgo(price.checkedAt, price.asOf)}</p>
            )}
            {price.verdict.status === "recent" && <RecentPriceNote className="block" />}
          </>
        )}
      </div>
      <Link href={offersHref(pala)} className={cn(OFFERS_BUTTON, "h-[50px] flex-none")}>
        {price ? "Ver ofertas" : "Ver ficha"}
        <span className="sr-only"> de la {pala.model}</span>
      </Link>
    </div>
  );
}

/** Precio en móvil: cifra, PVPR tachado y ahorro, sin caja. */
function MobilePrice({ pala }: { pala: Pala }) {
  const { price } = pala;
  const { msrp, saving, current } = priceFacts(pala);

  if (!price) return <p className="mt-1.5 text-xs font-bold text-ink lg:hidden">{priceHeading(null)}</p>;

  return (
    <div className="lg:hidden">
      <p className="mt-1.5 text-xl leading-snug font-black whitespace-nowrap tabular-nums">
        {formatEuro(price.current)}
      </p>
      {price.freshness !== "current" && <p className="text-xs text-muted">{priceHeading(price)}</p>}
      {msrp !== null && (
        <p className="text-xs whitespace-nowrap text-muted tabular-nums">
          PVPR <s>{formatEuro(msrp)}</s>
        </p>
      )}
      {current !== null && saving && (
        <p className="mt-0.5 text-xs font-extrabold text-forest">Ahorras {formatEuro(saving.amount)}</p>
      )}
      {price.verdict.status === "recent" && <RecentPriceNote className="block" />}
    </div>
  );
}

function PalaColumn({ pala, slot, three }: { pala: Pala; slot: CompareSlotId; three: boolean }) {
  return (
    <article className="relative flex min-w-0 flex-col lg:gap-3.5">
      <PalaPhoto
        src={pala.images[0] ?? null}
        alt={palaAlt(pala)}
        sizes={three ? "(min-width: 1024px) 360px, 33vw" : "(min-width: 1024px) 440px, 50vw"}
        // Las fotos abren la página: se cargan con prioridad.
        priority
        className={cn("rounded-3xl lg:h-[300px] lg:rounded-3xl", three ? "h-[130px]" : "h-[170px]")}
      />
      <div>
        <p className="mt-2.5 flex items-center gap-1.5 lg:mt-0 lg:gap-2">
          <SlotBadge slot={slot} className="size-5 text-xs lg:size-6 lg:text-xs" />
          <span className="truncate text-xs text-muted lg:text-sm">
            {pala.brand.name}
            <span className="hidden lg:inline"> · {pala.year}</span> · {SHAPE_LABELS[pala.shape]}
          </span>
        </p>
        <h2 className="mt-1 min-h-9 text-base leading-[1.1] font-black lg:mt-1.5 lg:min-h-0 lg:text-3xl lg:leading-[1.1] lg:tracking-[-0.03em]">
          <Link href={routes.pala(pala.slug)} className="hover:underline">
            {pala.model}
          </Link>
        </h2>
      </div>
      <MobilePrice pala={pala} />
      <PriceBox pala={pala} stacked={three} />
    </article>
  );
}

interface CompareHeaderProps {
  /** Dos o tres palas, en el orden de la URL */
  palas: Pala[];
  /** Selección con estas palas y el tercer hueco abierto; null si ya hay tres */
  addHref: string | null;
}

/** Cabecera enfrentada: foto real, letra, marca y modelo, y el mejor precio de cada pala. */
export function CompareHeader({ palas, addHref }: CompareHeaderProps) {
  const three = palas.length === MAX_COMPARED;

  return (
    <>
      <div
        className={cn(
          "relative grid gap-2.5 lg:items-start lg:gap-6",
          three ? "grid-cols-3 lg:grid-cols-[1fr_56px_1fr_56px_1fr]" : "grid-cols-2 lg:grid-cols-[1fr_72px_1fr_200px]",
        )}
      >
        {palas.map((pala, i) => (
          <Fragment key={pala.id}>
            {i > 0 && (
              <div
                className={cn(
                  // El transform crea su propio contexto de apilamiento: el z-index va aquí.
                  "z-[2] lg:static lg:flex lg:translate-x-0 lg:justify-center lg:pt-[122px]",
                  three ? "hidden" : "absolute top-20 left-1/2 -translate-x-1/2",
                )}
              >
                <VsBadge
                  className={cn(
                    "size-10 text-xs shadow-[0_0_0_6px_#fff]",
                    three ? "lg:size-12 lg:text-sm" : "lg:size-[60px] lg:text-lg",
                  )}
                />
              </div>
            )}
            <PalaColumn pala={pala} slot={SLOT_IDS[i]} three={three} />
          </Fragment>
        ))}

        {addHref && (
          <Link
            href={addHref}
            className="hidden h-[300px] flex-col items-center justify-center gap-2 rounded-3xl border-[1.5px] border-dashed border-[#9a9f95] p-4 text-center hover:border-carbon lg:flex"
          >
            <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-mist text-2xl font-bold">
              +
            </span>
            <span className="text-sm font-extrabold">Añadir otra pala</span>
            <span className="text-xs text-muted">Hasta {MAX_COMPARED}</span>
          </Link>
        )}
      </div>

      {addHref && (
        <Link
          href={addHref}
          className="mt-3 flex h-[46px] items-center justify-center rounded-full border-[1.5px] border-dashed border-[#9a9f95] text-sm font-bold lg:hidden"
        >
          + Añadir otra pala
        </Link>
      )}
    </>
  );
}
