import { Stars } from "@/components/ui/Rating";
import { formatCount, formatRating } from "@/lib/format";
import { SHAPE_LABELS } from "@/lib/labels";
import type { Pala } from "@/types/catalog";

interface PalaHeaderProps {
  pala: Pala;
  /** Ancla de la sección de opiniones */
  reviewsHref: string;
}

/** Marca + modelo + año y valoración. */
export function PalaHeader({ pala, reviewsHref }: PalaHeaderProps) {
  return (
    <header>
      <h1>
        <span className="block text-sm text-muted">
          {pala.brand.name} · {pala.year} · {SHAPE_LABELS[pala.shape]}
        </span>
        <span className="mt-1 block text-[40px] leading-none font-black tracking-[-0.035em] lg:text-[64px]">
          {pala.model}
        </span>
      </h1>
      {pala.reviewCount > 0 && (
        <p className="mt-2.5 flex items-center gap-2 text-sm">
          <Stars rating={pala.rating} className="text-base" />
          <strong aria-hidden="true">{formatRating(pala.rating)}</strong>
          <a href={reviewsHref} className="text-muted underline">
            {formatCount(pala.reviewCount)} opiniones
          </a>
        </p>
      )}
    </header>
  );
}
