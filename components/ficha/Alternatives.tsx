import { PalaCard } from "@/components/pala/PalaCard";
import type { Alternative } from "@/types/catalog";
import { SectionTitle } from "./SectionTitle";

interface AlternativesProps {
  alternatives: Alternative[];
  /** Modelo de la pala de la ficha */
  model: string;
}

/** ¿Buscas algo parecido? Carrusel en móvil, cuadrícula en escritorio. */
export function Alternatives({ alternatives, model }: AlternativesProps) {
  if (alternatives.length === 0) return null;

  return (
    <section aria-labelledby="alternativas">
      <SectionTitle id="alternativas">¿Buscas algo parecido?</SectionTitle>
      <p className="mt-1.5 text-sm leading-[1.45] text-pretty text-muted">
        Palas que suelen comparar quienes miran la {model}.
      </p>
      <ul className="scrollbar-none -mx-5 mt-4 flex gap-3.5 overflow-x-auto px-5 pb-1 lg:mx-0 lg:mt-[18px] lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0">
        {alternatives.map(({ pala, reason }) => (
          <li key={pala.id} className="w-[200px] flex-none lg:w-auto">
            <PalaCard pala={pala} variant="alternative" badge={reason} photoClassName="h-[170px]" />
          </li>
        ))}
      </ul>
    </section>
  );
}
