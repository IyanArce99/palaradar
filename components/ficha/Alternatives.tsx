import Link from "next/link";
import { PalaCard } from "@/components/pala/PalaCard";
import { ButtonLink } from "@/components/ui/Button";
import { comparePath, compareSelectPath } from "@/lib/compare";
import type { PalaSummary } from "@/types/catalog";
import { SectionTitle } from "./SectionTitle";

interface AlternativesProps {
  /** Pala de la ficha */
  pala: { slug: string; model: string };
  title: string;
  lead: string;
  /** Palas relacionadas, con el motivo si lo hay ("Misma forma") */
  items: { pala: PalaSummary; reason?: string }[];
  className?: string;
}

/**
 * Palas relacionadas y entrada al comparador. Carrusel en móvil, cuadrícula en
 * escritorio; cada pala enlaza a su ficha y a su comparación con la de la página.
 */
export function Alternatives({ pala, title, lead, items, className }: AlternativesProps) {
  return (
    <section aria-labelledby="alternativas" className={className}>
      <SectionTitle id="alternativas">{title}</SectionTitle>
      <p className="mt-1.5 text-sm leading-[1.45] text-pretty text-muted">{lead}</p>
      {items.length > 0 && (
        <ul className="scrollbar-none -mx-5 mt-4 flex gap-3.5 overflow-x-auto px-5 pb-1 lg:mx-0 lg:mt-[18px] lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0">
          {items.map((item) => (
            <li key={item.pala.id} className="w-[200px] flex-none lg:w-auto">
              <PalaCard pala={item.pala} variant="alternative" badge={item.reason} photoClassName="h-[170px]" />
              <Link
                href={comparePath(pala.slug, item.pala.slug)}
                className="mt-1 flex min-h-11 items-center text-[13px] font-bold underline"
              >
                Comparar con la {pala.model}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ButtonLink href={compareSelectPath({ a: pala.slug })} variant="outline" className="mt-4">
        Comparar con otra pala
      </ButtonLink>
    </section>
  );
}
