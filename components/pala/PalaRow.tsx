import Link from "next/link";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { RatingInline } from "@/components/ui/Rating";
import { formatEuro } from "@/lib/format";
import { palaAlt } from "@/lib/media";
import { routes } from "@/lib/routes";
import type { PalaSummary } from "@/types/catalog";

interface PalaRowProps {
  pala: PalaSummary;
}

/** Pala en formato fila, para listas editoriales («En más tiendas»). */
export function PalaRow({ pala }: PalaRowProps) {
  return (
    <article className="relative grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3.5 border-b border-line py-3">
      <PalaPhoto
        src={pala.image}
        alt={palaAlt(pala)}
        sizes="84px"
        className="h-24 rounded-2xl"
      />
      <div>
        <p className="text-xs text-muted">
          {pala.brand.name} · {pala.year}
        </p>
        <h3 className="text-base leading-snug font-extrabold">
          <Link href={routes.pala(pala.slug)} className="after:absolute after:inset-0">
            {pala.model}
          </Link>
        </h3>
        <p className="mt-[3px] text-sm leading-snug text-ink">{pala.description}</p>
        <div className="mt-1.5 flex items-baseline justify-between text-sm">
          {/* A la izquierda del precio, la valoración si hay opiniones. */}
          <span>
            {pala.reviewCount > 0 && <RatingInline rating={pala.rating} reviewCount={pala.reviewCount} />}
          </span>
          {pala.price !== null && (
            <span className="whitespace-nowrap text-muted">
              desde{" "}
              <strong className="text-base text-carbon tabular-nums">
                {formatEuro(pala.price)}
              </strong>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
