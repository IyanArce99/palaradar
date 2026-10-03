import { DisclosureMarker } from "@/components/ui/DisclosureMarker";
import type { FaqItem } from "@/types/catalog";
import { SectionTitle } from "./SectionTitle";

interface FaqProps {
  items: FaqItem[];
}

export function Faq({ items }: FaqProps) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="preguntas">
      <SectionTitle id="preguntas">Preguntas frecuentes</SectionTitle>
      <div className="mt-1.5">
        {items.map((item) => (
          <details key={item.question} className="group border-b border-line">
            <summary className="flex min-h-[58px] items-center justify-between gap-3">
              <h3 className="text-base font-bold">{item.question}</h3>
              <DisclosureMarker />
            </summary>
            <p className="mb-4 text-[15px] leading-[1.55] text-ink">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
