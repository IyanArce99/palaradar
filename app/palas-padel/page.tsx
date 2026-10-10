import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackView } from "@/components/analytics/TrackView";
import { BrandLinks } from "@/components/catalog/BrandLinks";
import { SavedProfileLink } from "@/components/finder/ProfileMemory";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { CollectionLinks } from "@/components/catalog/CollectionLinks";
import {
  ActiveFilters,
  CollectionPills,
  Pagination,
  SortPills,
} from "@/components/catalog/CatalogToolbar";
import { NoResults } from "@/components/catalog/NoResults";
import { SearchInterpretation } from "@/components/catalog/SearchInterpretation";
import { SortSelect } from "@/components/catalog/SortSelect";
import { SearchForm } from "@/components/layout/SearchForm";
import { PalaGrid } from "@/components/pala/PalaGrid";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { buttonClass } from "@/components/ui/Button";
import { PageHeading } from "@/components/ui/PageHeading";
import { countPalas, getCatalogFacets, getSearchSuggestions, searchCatalog } from "@/data";
import {
  catalogHref,
  DEFAULT_QUERY,
  getActiveFilters,
  hasCatalogFilters,
  parseCatalogQuery,
  type RawSearchParams,
} from "@/lib/catalog/query";
import { applyIntent, interpretSearch, relaxations } from "@/lib/catalog/search-intent";
import { catalogSeo, pageSuffix } from "@/lib/catalog/seo";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

const FILTERS_FORM_ID = "filtros-catalogo";
const FILTERS_TOGGLE_ID = "filtros-abiertos";

interface CatalogPageProps {
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ searchParams }: CatalogPageProps): Promise<Metadata> {
  const query = parseCatalogQuery(await searchParams);
  const seo = catalogSeo(query);

  return pageMetadata({
    title: `Palas de pádel: características y comparador de precios${pageSuffix(query.page)}`,
    description: `Catálogo de palas de pádel con sus características y su precio en las tiendas que seguimos. Filtra por nivel, marca, forma y presupuesto${pageSuffix(query.page)}.`,
    path: seo.canonical,
    index: seo.index,
  });
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const facets = await getCatalogFacets();
  const parsed = parseCatalogQuery(await searchParams);
  // Lo escrito en el buscador se interpreta («redonda por menos de 120 €») y se suma a los
  // filtros elegidos a mano. Cada criterio deducido se enseña y se puede quitar.
  const intent = interpretSearch(parsed.q, {
    brands: facets.brands,
    years: facets.years,
    currentYear: new Date().getFullYear(),
  });
  const interpreted = applyIntent(parsed, intent);
  // El deslizador en su tope equivale a no filtrar por precio.
  const query = {
    ...interpreted,
    maxPrice:
      interpreted.maxPrice !== null && interpreted.maxPrice >= facets.priceCeiling ? null : interpreted.maxPrice,
  };

  const [result, catalogSize, suggestions] = await Promise.all([
    searchCatalog(query),
    countPalas(),
    getSearchSuggestions(5),
  ]);

  // Sin resultados: cuántas palas habría quitando un solo criterio, para decir cuál limita.
  const relaxed =
    result.total === 0
      ? (
          await Promise.all(
            relaxations(query).map(async (option) => ({ ...option, total: await countPalas(option.query) })),
          )
        ).filter((option) => option.total > 0)
      : [];
  // «Alternativas a …»: la pala a la que se refiere, si el texto apunta a una sola.
  const referencePala = intent.reference !== null && result.total > 0 ? result.items[0] : null;

  // Una página que no existe es un 404, no una copia de la última.
  if (query.page > result.pageCount) notFound();

  const brandNames = Object.fromEntries(facets.brands.map((brand) => [brand.slug, brand.name]));
  const activeFilters = getActiveFilters(query, brandNames);
  const filtersKey = catalogHref(query);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Palas de pádel", href: routes.catalog },
        ]}
      />

      <div className="mx-auto max-w-[1280px]">
        <PageHeading
          title="Palas de pádel"
          lead={`${pluralize(catalogSize, "pala", "palas")} de ${pluralize(facets.brands.length, "marca", "marcas")}. Compara características y precios en las tiendas que seguimos para encontrar la tuya.`}
        />

        {/* Una búsqueda se registra con su número de resultados: las que no dan ninguno dicen qué falta en el catálogo. */}
        {parsed.q !== "" && (
          <TrackView event={ANALYTICS_EVENTS.search} props={{ termino: parsed.q, resultados: result.total }} />
        )}
        <SearchInterpretation
          original={parsed.q}
          intent={intent}
          query={query}
          explicit={parsed}
          reference={referencePala}
          referenceMatches={intent.reference !== null ? result.total : 0}
          className="mx-5 mt-4 lg:mx-12"
        />
        <SavedProfileLink className="px-5 pt-3 lg:px-12" />

        <div className="px-5 pt-4 lg:hidden">
          {/* La caja conserva lo que se escribió, no el texto que queda tras interpretarlo. */}
          <SearchForm variant="page" id="buscar" defaultValue={parsed.q} key={parsed.q} />
        </div>

        <CollectionPills query={query} className="pt-4 lg:pt-6" />

        <div className="px-5 pt-3 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10 lg:px-12 lg:pt-8">
          {/* Interruptor sin JavaScript para abrir los filtros en móvil */}
          <input
            type="checkbox"
            id={FILTERS_TOGGLE_ID}
            aria-label="Mostrar filtros"
            className="peer sr-only"
          />
          <div className="grid grid-cols-2 gap-2 peer-focus-visible:[&>label]:outline-2 lg:hidden">
            <label
              htmlFor={FILTERS_TOGGLE_ID}
              className={buttonClass({ variant: "outline", className: "cursor-pointer" })}
            >
              Filtros{activeFilters.length > 0 && ` · ${activeFilters.length}`}
            </label>
            <SortSelect key={query.sort} formId={FILTERS_FORM_ID} value={query.sort} />
          </div>

          <div className="hidden pt-5 peer-checked:block lg:block lg:pt-0">
            <CatalogFilters
              key={filtersKey}
              formId={FILTERS_FORM_ID}
              query={query}
              facets={facets}
              total={result.total}
              toggleId={FILTERS_TOGGLE_ID}
            />
          </div>

          <section aria-labelledby="resultados" className="pt-3 lg:pt-0">
            <div className="flex items-center justify-between gap-4 text-sm">
              <h2 id="resultados" className="font-normal text-muted">
                <strong className="text-carbon">
                  {pluralize(result.total, "pala", "palas")}
                </strong>
                {activeFilters.length > 0 && " con estos filtros"}
              </h2>
              <SortPills query={query} className="hidden lg:flex" />
            </div>

            <ActiveFilters filters={activeFilters} className="mt-3" />

            {result.total > 0 ? (
              <>
                <PalaGrid palas={result.items} columns={4} dense className="mt-5 lg:mt-6" />
                <Pagination
                  page={result.page}
                  pageCount={result.pageCount}
                  hrefFor={(page) => catalogHref({ ...query, page })}
                  className="mt-10"
                />
              </>
            ) : (
              <div className="mt-7">
                {/* Qué criterio limita: cuántas palas hay quitando solo ese. Nunca se quita sin avisar. */}
                {relaxed.length > 0 && (
                  <div className="mb-7 rounded-3xl border border-line p-4 lg:p-5">
                    <h3 className="text-base font-extrabold">Ninguna pala cumple todo a la vez. Prueba a quitar una cosa:</h3>
                    <ul className="mt-2.5 flex flex-col gap-1.5">
                      {relaxed.map((option) => (
                        <li key={option.label}>
                          <Link href={catalogHref(option.query)} className="inline-flex min-h-11 items-center text-base font-bold underline lg:min-h-9">
                            {option.label}
                          </Link>
                          <span className="text-sm text-muted"> · {pluralize(option.total, "pala", "palas")}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <NoResults
                  searchTerm={query.q}
                  suggestions={suggestions}
                  // Sola, sin búsqueda ni filtros, está vacía porque aún no hay palas con veredicto.
                  awaitingHistory={
                    query.collection === "mejor-precio" &&
                    !hasCatalogFilters({ ...query, collection: DEFAULT_QUERY.collection, sort: DEFAULT_QUERY.sort })
                  }
                />
              </div>
            )}
          </section>
        </div>

        <div className="mx-5 mt-12 grid gap-10 border-t border-line pt-10 pb-10 lg:mx-12 lg:mt-[72px] lg:grid-cols-2 lg:gap-14 lg:pb-[72px]">
          <section>
            <h2 className="text-2xl leading-[1.1] font-black tracking-[-0.025em] text-balance lg:text-3xl">
              Cómo elegir una pala de pádel
            </h2>
            <p className="mt-3 text-base leading-normal text-pretty text-ink">
              Lo más importante es tu nivel y cómo juegas. Si estás empezando, una pala redonda y
              de balance bajo te perdonará más los golpes descentrados. Si ya rematas a menudo,
              una de lágrima o diamante te dará más potencia a cambio de exigir más técnica.
            </p>
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
              <Link href={routes.guide("como-elegir-pala-de-padel")} className="inline-flex min-h-11 items-center font-bold underline">
                Guía: cómo elegir pala de pádel
              </Link>
              <Link href={routes.idealPala} className="inline-flex min-h-11 items-center font-bold underline">
                Encontrar mi pala ideal
              </Link>
            </p>
          </section>
          <div className="flex flex-col gap-8">
            <CollectionLinks id="palas-por-tipo" title="Palas por tipo" />
            <BrandLinks id="palas-por-marca" title="Palas por marca" brands={facets.brands} />
          </div>
        </div>
      </div>
    </>
  );
}
