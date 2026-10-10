import { EmptyNote } from "@/components/ui/EmptyNote";
import { Stars } from "@/components/ui/Rating";
import { cn } from "@/lib/cn";
import { formatCount, formatMonthYear, formatRating } from "@/lib/format";
import { LEVEL_LABELS } from "@/lib/labels";
import type { Pala, Review } from "@/types/catalog";
import { SectionTitle } from "./SectionTitle";

// En el diseño las opiniones ocupan un solo bloque en escritorio y dos en
// móvil: el resumen va antes de «¿Para quién es?» y las opiniones destacadas,
// después de las tiendas. Por eso son dos componentes.

function ReviewCard({ review, className }: { review: Review; className?: string }) {
  return (
    <li className={cn("rounded-3xl border border-line p-5", className)}>
      <div className="flex items-center justify-between">
        <Stars rating={review.rating} className="text-base" />
        <time dateTime={review.createdAt} className="text-xs text-muted">
          {formatMonthYear(review.createdAt)}
        </time>
      </div>
      <blockquote className="mt-2.5 mb-3 text-base leading-normal text-pretty">
        “{review.body}”
      </blockquote>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-9 flex-none place-items-center rounded-full bg-mist text-sm font-extrabold"
        >
          {review.authorName.charAt(0)}
        </span>
        <div>
          <p className="text-sm font-extrabold">
            {review.authorName} · Nivel {LEVEL_LABELS[review.authorLevel].toLowerCase()}
          </p>
          {review.authorContext && <p className="text-xs text-muted">{review.authorContext}</p>}
        </div>
      </div>
    </li>
  );
}

type OpinionsPala = Pick<
  Pala,
  "rating" | "reviewCount" | "reviewAspects" | "reviewHighlights" | "reviews"
>;

interface OpinionsSummaryProps {
  pala: OpinionsPala;
  id: string;
  /** Ancla de las opiniones destacadas, para el enlace del resumen en móvil */
  highlightsHref: string;
  className?: string;
}

/** Qué opinan los jugadores: valoración global, aspectos y lo que más repiten. */
export function OpinionsSummary({ pala, id, highlightsHref, className }: OpinionsSummaryProps) {
  if (pala.reviewCount === 0) {
    return (
      <section aria-labelledby={id} className={className}>
        <SectionTitle id={id}>Qué opinan los jugadores</SectionTitle>
        <EmptyNote className="mt-3.5 lg:mt-4">
          Todavía estamos recopilando opiniones de jugadores sobre esta pala.
        </EmptyNote>
      </section>
    );
  }

  return (
    <section aria-labelledby={id} className={className}>
      <SectionTitle id={id}>Qué opinan los jugadores</SectionTitle>

      <div className="mt-3.5 flex items-center gap-3.5 lg:mt-4">
        <span className="text-[52px] leading-none font-black tracking-[-0.04em]">
          {formatRating(pala.rating)}
        </span>
        <div>
          <Stars rating={pala.rating} className="text-xl" />
          <p className="mt-0.5 text-sm text-muted">
            Basado en {formatCount(pala.reviewCount)} opiniones
          </p>
        </div>
      </div>

      {/* El desglose por aspecto solo está en la ficha de escritorio. */}
      {pala.reviewAspects.length > 0 && (
        <dl className="mt-5 hidden gap-2.5 lg:grid">
          {pala.reviewAspects.map((aspect) => (
            <div
              key={aspect.label}
              className="grid grid-cols-[118px_1fr_30px] items-center gap-2.5 text-sm"
            >
              <dt>{aspect.label}</dt>
              <dd aria-hidden="true" className="h-2 overflow-hidden rounded-md bg-line-soft">
                <div className="h-full rounded-md bg-carbon" style={{ width: `${aspect.score * 10}%` }} />
              </dd>
              <dd className="text-right font-extrabold tabular-nums">
                {formatRating(aspect.score)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {pala.reviewHighlights.length > 0 && (
        <>
          <h3 className="mt-5 mb-3 text-sm font-extrabold lg:mt-6">
            Lo que más repiten<span className="hidden lg:inline"> los jugadores</span>
          </h3>
          <ul className="flex flex-col gap-3">
            {pala.reviewHighlights.map((highlight) => (
              <li
                key={highlight}
                className="border-l-[3px] border-lime pl-3.5 text-base leading-normal text-ink"
              >
                {highlight}
              </li>
            ))}
          </ul>
        </>
      )}

      {pala.reviews.length > 0 && (
        <a href={highlightsHref} className="mt-3.5 inline-block text-sm font-bold underline lg:hidden">
          Ver todas las opiniones
        </a>
      )}
    </section>
  );
}

const MOBILE_REVIEWS = 2;

interface OpinionsHighlightsProps {
  reviews: Review[];
  id: string;
  className?: string;
}

/** Opiniones destacadas: dos en móvil, tres en escritorio. */
export function OpinionsHighlights({ reviews, id, className }: OpinionsHighlightsProps) {
  if (reviews.length === 0) return null;

  return (
    <section id={id} aria-label="Opiniones destacadas" className={className}>
      <h3 className="mb-3 text-sm font-extrabold lg:hidden">Opiniones destacadas</h3>
      <ul className="grid gap-3 lg:grid-cols-3">
        {reviews.slice(0, 3).map((review, index) => (
          <ReviewCard
            key={review.id}
            review={review}
            className={index >= MOBILE_REVIEWS ? "hidden lg:block" : undefined}
          />
        ))}
      </ul>
    </section>
  );
}
