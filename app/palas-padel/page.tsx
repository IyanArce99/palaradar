import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLinks } from "@/components/catalog/BrandLinks";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import {
  ActiveFilters,
  CollectionPills,
  Pagination,
  SortPills,
} from "@/components/catalog/CatalogToolbar";
import { NoResults } from "@/components/catalog/NoResults";
import { SortSelect } from "@/components/catalog/SortSelect";
import { SearchForm } from "@/components/layout/SearchForm";
import { PalaGrid } from "@/components/pala/PalaGrid";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { buttonClass } from "@/components/ui/Button";
import { PageHeading } from "@/components/ui/PageHeading";
import { countPalas, getCatalogFacets, getPopularSearches, searchCatalog } from "@/data";
import {
  catalogHref,
  getActiveFilters,
  parseCatalogQuery,
  type RawSearchParams,
} from "@/lib/catalog/query";
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
    title: `Palas de pádel: opiniones y comparador de precios${pageSuffix(query.page)}`,
    description: `Catálogo de palas de pádel con opiniones de jugadores y precios en todas las tiendas. Filtra por nivel, marca, forma y presupuesto${pageSuffix(query.page)}.`,
    path: seo.canonical,
    index: seo.index,
  });
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const facets = await getCatalogFacets();
  const parsed = parseCatalogQuery(await searchParams);
  // El deslizador en su tope equivale a no filtrar por precio.
  const query = {
    ...parsed,
    maxPrice:
      parsed.maxPrice !== null && parsed.maxPrice >= facets.priceCeiling ? null : parsed.maxPrice,
  };

  const [result, catalogSize, popularSearches] = await Promise.all([
    searchCatalog(query),
    countPalas(),
    getPopularSearches(5),
  ]);

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
          lead={`${pluralize(catalogSize, "pala", "palas")} de ${pluralize(facets.brands.length, "marca", "marcas")}. Compara opiniones de jugadores y precios en todas las tiendas para encontrar la tuya.`}
        />

        <div className="px-5 pt-4 lg:hidden">
          <SearchForm variant="page" id="buscar" defaultValue={query.q} key={query.q} />
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
                <PalaGrid palas={result.items} className="mt-5 lg:mt-6" />
                <Pagination
                  page={result.page}
                  pageCount={result.pageCount}
                  hrefFor={(page) => catalogHref({ ...query, page })}
                  className="mt-10"
                />
              </>
            ) : (
              <div className="mt-7">
                <NoResults searchTerm={query.q} popularSearches={popularSearches} />
              </div>
            )}
          </section>
        </div>

        <div className="mx-5 mt-12 grid gap-10 border-t border-line pt-10 pb-10 lg:mx-12 lg:mt-[72px] lg:grid-cols-2 lg:gap-14 lg:pb-[72px]">
          <section>
            <h2 className="text-[26px] leading-[1.08] font-black tracking-[-0.025em] text-balance">
              Cómo elegir una pala de pádel
            </h2>
            <p className="mt-3 text-base leading-[1.6] text-pretty text-ink">
              Lo más importante es tu nivel y cómo juegas. Si estás empezando, una pala redonda y
              de balance bajo te perdonará más los golpes descentrados. Si ya rematas a menudo,
              una de lágrima o diamante te dará más potencia a cambio de exigir más técnica.
            </p>
            <Link href={routes.guides} className="mt-3 inline-block font-bold underline">
              Ver las guías
            </Link>
          </section>
          <BrandLinks id="palas-por-marca" title="Palas por marca" brands={facets.brands} />
        </div>
      </div>
    </>
  );
}
