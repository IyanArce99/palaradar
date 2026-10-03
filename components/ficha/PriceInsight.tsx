import type { PricePoint } from "@/types/catalog";
import type { PriceSummary } from "@/types/pricing";
import { PriceHistory } from "./PriceHistory";
import { SectionTitle } from "./SectionTitle";

interface PriceInsightProps {
  price: PriceSummary;
  history: PricePoint[];
}

/** ¿Está barata ahora? El precio explicado en una frase, con su histórico. */
export function PriceInsight({ price, history }: PriceInsightProps) {
  return (
    <section aria-labelledby="precio-historico">
      <PriceHistory
        title={<SectionTitle id="precio-historico">¿Está barata ahora?</SectionTitle>}
        history={history}
        price={price}
      >
        <p className="mt-2.5 mb-4 text-base leading-[1.6] text-pretty text-ink lg:mb-0">
          {price.verdict.answer}
        </p>
      </PriceHistory>
    </section>
  );
}
