import Link from "next/link";
import { PalaCard } from "@/components/pala/PalaCard";
import { ButtonLink } from "@/components/ui/Button";
import type { AlternativeGroup } from "@/lib/alternatives";
import { comparePath, compareSelectPath } from "@/lib/compare";
import { routes } from "@/lib/routes";
import type { PalaSummary } from "@/types/catalog";
import { AlternativeTabs } from "./AlternativeTabs";
import { SectionTitle } from "./SectionTitle";

interface RelatedItem {
  pala: PalaSummary;
  /** Motivo corto que va destacado en la tarjeta ("Misma forma") */
  reason?: string;
  /** Qué coincide, qué cambia y qué no se sabe, en frases */
  reasons?: string[];
}

interface AlternativesProps {
  /** Pala de la ficha */
  pala: { slug: string; model: string };
  title: string;
  lead: string;
  /** Palas relacionadas por defecto: las elegidas a mano o las parecidas */
  items: RelatedItem[];
  /** Alternativas por objetivo (más barata, más control…), solo los modos con resultados */
  groups?: AlternativeGroup[];
  className?: string;
}

const LIST = "scrollbar-none -mx-5 flex gap-3.5 overflow-x-auto px-5 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0";

function RelatedList({ pala, items }: { pala: AlternativesProps["pala"]; items: RelatedItem[] }) {
  return (
    <ul className={LIST}>
      {items.map((item) => (
        <li key={item.pala.id} className="w-[200px] flex-none lg:w-auto">
          <PalaCard pala={item.pala} variant="alternative" badge={item.reason} photoClassName="h-[170px]" />
          {/* El primer motivo ya va en la etiqueta de la tarjeta. */}
          {item.reasons && item.reasons.length > 1 && (
            <ul className="mt-1.5 text-sm leading-snug text-ink">
              {item.reasons.slice(1).map((reason) => (
                <li key={reason} className="mt-0.5">
                  {reason}
                </li>
              ))}
            </ul>
          )}
          <Link
            href={comparePath(pala.slug, item.pala.slug)}
            className="mt-1 flex min-h-11 items-center text-sm font-bold underline"
          >
            Comparar con la {pala.model}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Palas relacionadas, alternativas por objetivo y entrada al comparador. La
 * primera pestaña son las parecidas; las demás responden a «¿buscas algo
 * parecido, pero más barato o con otras características?» con la puntuación de
 * lib/alternatives.ts. Carrusel en móvil, cuadrícula en escritorio.
 */
export function Alternatives({ pala, title, lead, items, groups = [], className }: AlternativesProps) {
  const related = items.length > 0 ? <RelatedList pala={pala} items={items} /> : null;

  return (
    <section aria-labelledby="alternativas" className={className}>
      <SectionTitle id="alternativas">{title}</SectionTitle>
      <p className="mt-1.5 text-sm leading-normal text-pretty text-muted">{lead}</p>

      {groups.length === 0 ? (
        related && <div className="mt-4 lg:mt-5">{related}</div>
      ) : (
        <>
          <p className="mt-4 text-base font-extrabold lg:mt-5">
            Parecida, pero más barata o con otras características: elige qué buscas.
          </p>
          <AlternativeTabs
            pala={pala.slug}
            className="mt-2.5"
            tabs={[
              ...(related ? [{ id: "parecidas", label: "Parecidas", content: related }] : []),
              ...groups.map((group) => ({
                id: group.id,
                label: group.label,
                content: (
                  <>
                    <p className="mb-3.5 text-sm leading-normal text-pretty text-muted">{group.criterion}</p>
                    <RelatedList
                      pala={pala}
                      items={group.items.map((item) => ({ pala: item.pala, reason: item.reasons[0], reasons: item.reasons }))}
                    />
                  </>
                ),
              })),
            ]}
          />
          <p className="mt-3 text-xs leading-normal text-pretty text-muted">
            Las alternativas se ordenan por los datos declarados que comparten con esta pala; a igualdad, primero las
            que tienen foto y después por su precio de hoy. No son una valoración: lo que una pala no declara no se da
            por igual.
          </p>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1">
        <ButtonLink href={compareSelectPath({ a: pala.slug })} variant="outline">
          Comparar con otra pala
        </ButtonLink>
        {/* La misma búsqueda, pero eligiendo qué conservar y qué cambiar. */}
        <Link href={`${routes.upgrade}?pala=${pala.slug}`} className="inline-flex min-h-11 items-center text-sm font-bold underline">
          Tengo esta pala y quiero cambiar
        </Link>
      </div>
    </section>
  );
}
