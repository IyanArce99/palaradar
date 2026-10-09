import Link from "next/link";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { cn } from "@/lib/cn";
import { priceHeading, type CompareSlotId } from "@/lib/compare";
import { priceFacts } from "@/lib/compare-insights";
import { formatEuro, formatPercent } from "@/lib/format";
import { SHAPE_LABELS } from "@/lib/labels";
import { palaAlt } from "@/lib/media";
import type { Pala } from "@/types/catalog";
import { SlotBadge } from "./Badges";

interface CompareSlotProps {
  slot: CompareSlotId;
  /** Pala elegida en este hueco */
  pala: Pala;
  /** Selección sin esta pala: a donde lleva «Cambiar» */
  changeHref: string;
  /** Con tres palas, las tarjetas son más estrechas y la foto más baja */
  compact: boolean;
}

/** Un hueco del comparador con su pala: foto real, marca, modelo y mejor precio. */
export function CompareSlot({ slot, pala, changeHref, compact }: CompareSlotProps) {
  const title = `Pala ${slot.toUpperCase()}`;
  const { current, saving } = priceFacts(pala);
  const photo = pala.images[0] ?? null;

  return (
    <section aria-label={title} className="rounded-[22px] border-2 border-carbon bg-white p-3 lg:rounded-3xl lg:p-4">
      {/* Móvil: fila con miniatura, datos y «×». */}
      <div
        className={cn(
          "grid items-center gap-3 lg:hidden",
          compact ? "grid-cols-[67px_minmax(0,1fr)_auto]" : "grid-cols-[83px_minmax(0,1fr)_auto]",
        )}
      >
        <PalaPhoto
          src={photo}
          alt={palaAlt(pala)}
          sizes="84px"
          className={cn("rounded-[14px]", compact ? "h-[84px]" : "h-[104px]")}
        />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5">
            <SlotBadge slot={slot} className="size-5 text-[9px]" />
            <span className="truncate text-xs text-muted">
              {pala.brand.name} · {pala.year}
            </span>
          </p>
          <h2 className="mt-1 text-[17px] leading-[1.1] font-black">{pala.model}</h2>
          <p className="mt-1.5 text-xs text-muted">{priceHeading(pala.price)}</p>
          {pala.price && (
            <p className="text-lg leading-tight font-black whitespace-nowrap tabular-nums">
              {formatEuro(pala.price.current)}
            </p>
          )}
        </div>
        <Link
          href={changeHref}
          aria-label={`Quitar la ${pala.model}`}
          className="grid size-9 place-items-center self-start rounded-full bg-mist text-base font-bold"
        >
          <span aria-hidden="true">×</span>
        </Link>
      </div>

      {/* Escritorio: tarjeta vertical con la foto grande. */}
      <div className="hidden h-full flex-col gap-3.5 lg:flex">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2.5">
            <SlotBadge slot={slot} />
            <span className="text-sm font-extrabold">{title}</span>
          </p>
          <Link
            href={changeHref}
            className="flex h-9 items-center rounded-full bg-mist px-3 text-[13px] font-bold hover:bg-line-soft"
          >
            Cambiar<span className="sr-only"> la {pala.model}</span>
          </Link>
        </div>
        <PalaPhoto
          src={photo}
          alt={palaAlt(pala)}
          sizes={compact ? "360px" : "420px"}
          className={cn("flex-none rounded-2xl", compact ? "h-[190px]" : "h-[230px]")}
        />
        <div>
          <p className="text-[13px] text-muted">
            {pala.brand.name} · {pala.year} · {SHAPE_LABELS[pala.shape]}
          </p>
          <h2
            className={cn(
              "mt-0.5 leading-[1.1] font-black tracking-[-0.02em]",
              compact ? "text-xl" : "text-2xl",
            )}
          >
            {pala.model}
          </h2>
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-line pt-3">
          <div>
            <p className="text-xs text-muted">{priceHeading(pala.price)}</p>
            {pala.price && (
              <p className={cn("font-black whitespace-nowrap tabular-nums", compact ? "text-xl" : "text-2xl")}>
                {formatEuro(pala.price.current)}
              </p>
            )}
          </div>
          {current !== null && saving && (
            <span className="rounded-md bg-lime-soft px-2 py-1 text-xs font-extrabold whitespace-nowrap text-forest">
              ▼ {formatPercent(saving.percent)} vs PVPR
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
