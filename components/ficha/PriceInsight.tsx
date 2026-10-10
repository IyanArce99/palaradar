import { EmptyNote } from "@/components/ui/EmptyNote";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { chartSeries, MAX_CHART_RANGE } from "@/lib/pricing";
import type { PricePoint } from "@/types/catalog";
import type { PriceSummary } from "@/types/pricing";
import { PriceHistory } from "./PriceHistory";
import { PriceStatsPanel } from "./PriceStatsPanel";
import { SectionTitle } from "./SectionTitle";

const TITLE_ID = "precio-historico";
/** Con menos puntos no hay línea que dibujar. */
const MIN_CHART_POINTS = 2;

interface PriceInsightProps {
  price: PriceSummary | null;
  history: PricePoint[];
  className?: string;
}

/** ¿Está barata ahora? El precio explicado en una frase, con su histórico. */
export function PriceInsight({ price, history, className }: PriceInsightProps) {
  const title = <SectionTitle id={TITLE_ID}>¿Está barata ahora?</SectionTitle>;

  if (!price) {
    return (
      <section aria-labelledby={TITLE_ID} className={className}>
        {title}
        <EmptyNote className="mt-2.5">
          Ahora mismo no tenemos el precio de esta pala en ninguna tienda, así que no podemos
          decirte si es buen momento para comprarla.
        </EmptyNote>
      </section>
    );
  }

  const answer = (
    <p className="mt-2.5 text-base leading-normal text-pretty text-ink">{price.verdict.answer}</p>
  );

  if (chartSeries(history, price, MAX_CHART_RANGE).length < MIN_CHART_POINTS) {
    const since = price.trackedSince ?? price.checkedAt;
    return (
      <section aria-labelledby={TITLE_ID} className={className}>
        {title}
        {answer}
        <EmptyNote className="mt-4 lg:mt-5">
          {/* Con «Precio reciente» la respuesta ya dice desde cuándo se sigue. */}
          {price.verdict.status === "recent"
            ? "La evolución de su precio aparecerá aquí cuando tengamos más días de histórico."
            : `Seguimos el precio de esta pala desde el ${formatDate(since)}. Su evolución aparecerá aquí cuando tengamos más días de histórico.`}
        </EmptyNote>
      </section>
    );
  }

  return (
    <section aria-labelledby={TITLE_ID} className={cn(className)}>
      <PriceHistory title={title} history={history} price={price}>
        {answer}
      </PriceHistory>
      <PriceStatsPanel price={price} history={history} className="mt-5 lg:mt-6" />
    </section>
  );
}
