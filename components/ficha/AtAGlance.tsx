import { glanceItems } from "@/lib/pala-content";
import type { Pala } from "@/types/catalog";
import { SectionTitle } from "./SectionTitle";

interface AtAGlanceProps {
  pala: Pala;
  className?: string;
}

/**
 * «De un vistazo»: las características principales que la pala declara, a la
 * vista y con una explicación neutral de qué significa cada una. Un atributo
 * que la pala no declara no aparece.
 */
export function AtAGlance({ pala, className }: AtAGlanceProps) {
  const items = glanceItems(pala);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="vistazo" className={className}>
      <SectionTitle id="vistazo">De un vistazo</SectionTitle>
      <dl className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-3.5">
        {items.map((item) => (
          <div key={item.label} className="rounded-[18px] border border-line p-4 lg:p-[18px]">
            <dt className="font-mono text-[11px] leading-none font-bold tracking-[0.08em] text-muted uppercase">
              {item.label}
            </dt>
            <dd className="mt-2">
              <span className="block text-lg leading-[1.2] font-extrabold">{item.value}</span>
              <span className="mt-1.5 block text-[13px] leading-[1.45] text-pretty text-muted">
                {item.note}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
