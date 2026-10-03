import { DemoNotice } from "@/components/ui/DemoNotice";
import { Stars } from "@/components/ui/Rating";
import { formatCount, formatMonthYear, formatRating } from "@/lib/format";
import { LEVEL_LABELS } from "@/lib/labels";
import type { Pala, Review } from "@/types/catalog";
import { SectionTitle } from "./SectionTitle";

function ReviewCard({ review }: { review: Review }) {
  return (
    <li className="rounded-[18px] border border-line p-[18px]">
      <div className="flex items-center justify-between">
        <Stars rating={review.rating} className="text-[15px]" />
        <time dateTime={review.createdAt} className="text-xs text-muted">
          {formatMonthYear(review.createdAt)}
        </time>
      </div>
      <blockquote className="mt-2.5 mb-3 text-base leading-[1.55] text-pretty">
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

interface PlayerOpinionsProps {
  pala: Pick<
    Pala,
    "rating" | "reviewCount" | "reviewAspects" | "reviewHighlights" | "reviews"
  >;
  id: string;
}

/** Qué opinan los jugadores: valoración global, aspectos, lo que más repiten y opiniones. */
export function PlayerOpinions({ pala, id }: PlayerOpinionsProps) {
  return (
    <section aria-labelledby={id}>
      <SectionTitle id={id}>Qué opinan los jugadores</SectionTitle>

      <div className="mt-4 flex items-center gap-3.5">
        <span className="text-[52px] leading-none font-black tracking-[-0.04em]">
          {formatRating(pala.rating)}
        </span>
        <div>
          <Stars rating={pala.rating} className="text-xl" />
          <p className="mt-0.5 text-[13px] text-muted">
            Basado en {formatCount(pala.reviewCount)} opiniones
          </p>
        </div>
      </div>

      {pala.reviewAspects.length > 0 && (
        <dl className="mt-5 grid max-w-[560px] gap-2.5">
          {pala.reviewAspects.map((aspect) => (
            <div
              key={aspect.label}
              className="grid grid-cols-[118px_1fr_30px] items-center gap-2.5 text-sm"
            >
              <dt>{aspect.label}</dt>
              <dd aria-hidden="true" className="h-2 overflow-hidden rounded bg-line-soft">
                <div className="h-full rounded bg-carbon" style={{ width: `${aspect.score * 10}%` }} />
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
          <h3 className="mt-6 mb-3 text-sm font-extrabold">Lo que más repiten los jugadores</h3>
          <ul className="flex flex-col gap-3">
            {pala.reviewHighlights.map((highlight) => (
              <li
                key={highlight}
                className="border-l-[3px] border-lime pl-3.5 text-[15px] leading-normal text-ink"
              >
                {highlight}
              </li>
            ))}
          </ul>
        </>
      )}

      {pala.reviews.length > 0 && (
        <>
          <h3 className="mt-6 mb-3 text-sm font-extrabold">Opiniones destacadas</h3>
          <ul className="grid gap-3 lg:grid-cols-3">
            {pala.reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </ul>
        </>
      )}

      <DemoNotice className="mt-3">
        Valoraciones y opiniones de ejemplo: todavía no proceden de jugadores reales.
      </DemoNotice>
    </section>
  );
}
