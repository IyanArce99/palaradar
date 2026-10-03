import { cn } from "@/lib/cn";
import { formatCount, formatRating } from "@/lib/format";

const MAX_STARS = 5;

interface StarsProps {
  rating: number;
  className?: string;
}

export function Stars({ rating, className }: StarsProps) {
  const filled = Math.min(MAX_STARS, Math.max(0, Math.floor(rating)));

  return (
    <span
      role="img"
      aria-label={`${formatRating(rating)} de ${MAX_STARS}`}
      className={cn("tracking-[1px] whitespace-nowrap", className)}
    >
      <span aria-hidden="true">{"★".repeat(filled)}</span>
      <span aria-hidden="true" className="text-ash">
        {"★".repeat(MAX_STARS - filled)}
      </span>
    </span>
  );
}

interface RatingInlineProps {
  rating: number;
  reviewCount: number;
  className?: string;
}

/** Valoración compacta para tarjetas: ★ 4,6 (1.180) */
export function RatingInline({ rating, reviewCount, className }: RatingInlineProps) {
  return (
    <span className={cn("whitespace-nowrap", className)}>
      <span aria-hidden="true">★ </span>
      <span className="sr-only">Valoración: </span>
      {formatRating(rating)}{" "}
      <span className="text-muted">
        ({formatCount(reviewCount)}
        <span className="sr-only"> opiniones</span>)
      </span>
    </span>
  );
}
