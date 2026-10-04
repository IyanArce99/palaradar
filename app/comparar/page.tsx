import type { Metadata } from "next";
import { CompareSlot } from "@/components/compare/CompareSlot";
import { PalaCard } from "@/components/pala/PalaCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { buttonClass, ButtonLink } from "@/components/ui/Button";
import { PageHeading } from "@/components/ui/PageHeading";
import { getPalaBySlug, searchCatalog } from "@/data";
import { DEFAULT_QUERY } from "@/lib/catalog/query";
import { COMPARE_PARAMS, comparePath, compareSelectPath } from "@/lib/compare";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import type { PalaSuggestion } from "@/types/catalog";

const RESULT_COUNT = 6;
const MAX_QUERY_LENGTH = 80;

type RawParams = Record<string, string | string[] | undefined>;

interface CompareSelectPageProps {
  searchParams: Promise<RawParams>;
}

function first(params: RawParams, key: string): string {
  const value = params[key];
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

export async function generateMetadata({ searchParams }: CompareSelectPageProps): Promise<Metadata> {
  const hasParams = Object.keys(await searchParams).length > 0;

  return pageMetadata({
    title: "Comparador de palas de pádel",
    description:
      "Compara dos palas de pádel cara a cara: forma, balance, peso, materiales y mejor precio en las tiendas.",
    path: routes.compare,
    // La selección a medias (?a=…&b=…) no es una página que indexar.
    index: !hasParams,
  });
}

/** Resultados de la búsqueda enviada desde un hueco (camino sin JavaScript). */
async function searchSuggestions(q: string): Promise<PalaSuggestion[]> {
  if (!q) return [];
  const { items } = await searchCatalog(
    { ...DEFAULT_QUERY, q: q.slice(0, MAX_QUERY_LENGTH) },
    { pageSize: RESULT_COUNT },
  );
  return items.map((pala) => ({
    slug: pala.slug,
    brand: pala.brand.name,
    model: pala.model,
    year: pala.year,
    image: pala.image,
  }));
}

export default async function CompareSelectPage({ searchParams }: CompareSelectPageProps) {
  const params = await searchParams;
  const slugA = first(params, COMPARE_PARAMS.a);
  const slugB = first(params, COMPARE_PARAMS.b);
  const searchA = first(params, COMPARE_PARAMS.searchA);
  const searchB = first(params, COMPARE_PARAMS.searchB);

  const [palaA, palaB, resultsA, resultsB] = await Promise.all([
    slugA ? getPalaBySlug(slugA) : null,
    slugB ? getPalaBySlug(slugB) : null,
    searchSuggestions(searchA),
    searchSuggestions(searchB),
  ]);

  const a = palaA?.slug ?? null;
  const b = palaB?.slug ?? null;
  const ready = a !== null && b !== null && a !== b;

  // Con una sola pala elegida se proponen sus «parecidas» para el otro hueco.
  const chosen = palaA && !palaB ? palaA : palaB && !palaA ? palaB : null;
  const emptySlot = palaA ? "b" : "a";

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Comparar", href: routes.compare },
        ]}
      />
      <div className="mx-auto max-w-[1280px] pb-10 lg:pb-[72px]">
        <PageHeading
          title="Comparar palas"
          lead="Elige dos palas y ponlas cara a cara: en qué se diferencian y cuál está a mejor precio."
        />

        <div className="mx-auto max-w-[920px] px-5 pt-6 lg:px-0 lg:pt-10">
          <div className="grid grid-cols-2 gap-3 lg:gap-10">
            <CompareSlot slot="a" pala={palaA} other={b} search={searchA} results={resultsA} />
            <CompareSlot slot="b" pala={palaB} other={a} search={searchB} results={resultsB} />
          </div>

          <div className="mt-6 border-t border-line pt-5 lg:mt-8 lg:text-center">
            {ready ? (
              <ButtonLink href={comparePath(a, b)} variant="dark" size="lg" className="w-full lg:w-auto">
                Comparar
              </ButtonLink>
            ) : (
              <>
                <span
                  aria-disabled="true"
                  className={buttonClass({
                    variant: "dark",
                    size: "lg",
                    className: "w-full cursor-default opacity-40 lg:w-auto",
                  })}
                >
                  Comparar
                </span>
                <p className="mt-2.5 text-sm text-muted">
                  {a !== null && a === b
                    ? "Has elegido la misma pala dos veces: cambia una de las dos."
                    : "Elige dos palas distintas para compararlas."}
                </p>
              </>
            )}
          </div>

          {chosen && chosen.alternatives.length > 0 && (
            <section aria-labelledby="parecidas" className="mt-9 lg:mt-14">
              <h2 id="parecidas" className="text-xl font-black lg:text-2xl">
                Palas parecidas a la {chosen.model}
              </h2>
              <p className="mt-1.5 text-sm leading-[1.45] text-muted">
                Elige una para compararla con ella.
              </p>
              <ul className="scrollbar-none -mx-5 mt-4 flex gap-3.5 overflow-x-auto px-5 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0">
                {chosen.alternatives.map(({ pala, reason }) => (
                  <li key={pala.id} className="w-[200px] flex-none lg:w-auto">
                    <PalaCard
                      pala={pala}
                      variant="alternative"
                      badge={reason}
                      photoClassName="h-[170px]"
                      href={compareSelectPath({ a, b, [emptySlot]: pala.slug })}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
