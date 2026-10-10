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
      {/* En móvil, dos columnas de dato y valor: la explicación de cada atributo solo cabe en escritorio. */}
      <dl className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3 lg:gap-3.5">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-line p-3 lg:rounded-3xl lg:p-5">
            <dt className="font-mono text-xs leading-none font-bold tracking-[0.08em] text-muted uppercase">
              {item.label}
            </dt>
            <dd className="mt-1.5 lg:mt-2">
              <span className="block text-base leading-snug font-extrabold lg:text-lg">{item.value}</span>
              <span className="mt-1.5 hidden text-sm leading-normal text-pretty text-muted lg:block">
                {item.note}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
