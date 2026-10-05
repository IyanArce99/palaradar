import Link from "next/link";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { RecentPriceNote } from "@/components/ui/RecentPriceNote";
import { compareSelectPath, priceHeading, type CompareSlotId } from "@/lib/compare";
import { formatEuro } from "@/lib/format";
import { palaAlt } from "@/lib/media";
import type { Pala, PalaSuggestion } from "@/types/catalog";
import { PalaPicker } from "./PalaPicker";
import { SuggestionList } from "./SuggestionList";

interface CompareSlotProps {
  slot: CompareSlotId;
  /** Pala elegida en este hueco */
  pala: Pala | null;
  /** Slug de la pala del otro hueco */
  other: string | null;
  /** Búsqueda enviada desde este hueco y sus resultados (camino sin JavaScript) */
  search: string;
  results: PalaSuggestion[];
}

/** Un hueco del comparador: vacío (buscador) o con su pala y «Cambiar». */
export function CompareSlot({ slot, pala, other, search, results }: CompareSlotProps) {
  const otherSlot: CompareSlotId = slot === "a" ? "b" : "a";
  const title = `Pala ${slot.toUpperCase()}`;

  if (pala) {
    return (
      <section aria-label={title}>
        <PalaPhoto
          src={pala.images[0] ?? null}
          alt={palaAlt(pala)}
          sizes="(min-width: 1024px) 440px, 50vw"
          className="h-[170px] rounded-2xl lg:h-[360px] lg:rounded-3xl"
        />
        <p className="mt-2.5 text-xs text-muted lg:mt-4 lg:text-sm">
          {pala.brand.name} · {pala.year}
        </p>
        <h2 className="text-base leading-[1.15] font-extrabold lg:text-[26px] lg:font-black lg:tracking-[-0.02em]">
          {pala.model}
        </h2>
        <p className="mt-2 text-xs text-muted">{priceHeading(pala.price)}</p>
        {pala.price && (
          <p className="text-[21px] font-black whitespace-nowrap tabular-nums lg:text-[28px]">
            {formatEuro(pala.price.current)}
          </p>
        )}
        {pala.price?.verdict.status === "recent" && <RecentPriceNote className="block" />}
        <Link
          href={compareSelectPath({ [otherSlot]: other })}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-bold underline"
        >
          Cambiar
        </Link>
      </section>
    );
  }

  return (
    <section aria-label={title}>
      <h2 className="mb-2.5 text-base font-extrabold lg:text-xl lg:font-black">{title}</h2>
      <PalaPicker slot={slot} other={other} defaultQuery={search} />
      {search &&
        (results.length > 0 ? (
          <SuggestionList
            suggestions={results}
            hrefFor={(slug) => compareSelectPath({ [otherSlot]: other, [slot]: slug })}
          />
        ) : (
          <p className="mt-2 text-sm text-muted">No encontramos ninguna pala con ese nombre.</p>
        ))}
    </section>
  );
}
