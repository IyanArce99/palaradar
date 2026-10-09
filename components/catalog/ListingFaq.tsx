import { JsonLd } from "@/components/seo/JsonLd";
import { DisclosureMarker } from "@/components/ui/DisclosureMarker";
import { cn } from "@/lib/cn";
import { faqJsonLd } from "@/lib/seo";
import type { FaqItem } from "@/types/catalog";

interface ListingFaqProps {
  id: string;
  title?: string;
  items: FaqItem[];
  className?: string;
}

/** Preguntas frecuentes de un listado o una guía, con su JSON-LD. Sin preguntas no aparece. */
export function ListingFaq({ id, title = "Preguntas frecuentes", items, className }: ListingFaqProps) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={id} className={cn("max-w-[820px]", className)}>
      <JsonLd data={faqJsonLd(items)} />
      <h2 id={id} className="text-[22px] leading-[1.08] font-black tracking-[-0.025em] text-balance lg:text-[30px]">
        {title}
      </h2>
      <div className="mt-1 lg:mt-1.5">
        {items.map((item) => (
          <details key={item.question} className="group border-b border-line">
            <summary className="flex min-h-[58px] items-center justify-between gap-3">
              <h3 className="text-[15px] font-bold lg:text-[17px]">{item.question}</h3>
              <DisclosureMarker />
            </summary>
            <p className="mb-4 text-[15px] leading-[1.55] text-ink">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
