import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLinks } from "@/components/catalog/BrandLinks";
import { Pagination } from "@/components/catalog/CatalogToolbar";
import { CollectionLinks } from "@/components/catalog/CollectionLinks";
import { ListingFaq } from "@/components/catalog/ListingFaq";
import { PalaGrid } from "@/components/pala/PalaGrid";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeading } from "@/components/ui/PageHeading";
import { getCollection, type Collection } from "@/content/collections";
import { getGuide } from "@/content/guides";
import { countPalas, getBrands, searchCatalog } from "@/data";
import { catalogHref, DEFAULT_QUERY, pageHref } from "@/lib/catalog/query";
import { formatEuroCompact, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";

/** Tope que equivale a «con precio vigente» en el filtro de precio del catálogo */
const ANY_PRICE = 100_000;

interface CollectionPageProps {
  collection: Collection;
  page: number;
}

/** Lo que el catálogo tiene hoy de una colección: cuántas palas, cuántas a la venta y desde qué precio. */
export async function collectionFacts(collection: Collection) {
  const query = { ...DEFAULT_QUERY, ...collection.query };
  const [total, priced, cheapest] = await Promise.all([
    countPalas(collection.query),
    countPalas({ ...collection.query, maxPrice: collection.query.maxPrice ?? ANY_PRICE }),
    searchCatalog({ ...query, sort: "precio" }, { pageSize: 1 }),
  ]);
  return { total, priced, from: cheapest.items[0]?.price ?? null };
}

/**
 * Página de una colección del catálogo: titular, texto que explica el criterio,
 * las palas que lo cumplen, preguntas frecuentes y enlaces a colecciones afines.
 */
export async function CollectionPage({ collection, page }: CollectionPageProps) {
  const path = routes.collection(collection.slug);
  const [result, facts, brands] = await Promise.all([
    searchCatalog({ ...DEFAULT_QUERY, ...collection.query, page }),
    collectionFacts(collection),
    getBrands(),
  ]);
  if (page > result.pageCount) notFound();

  const [lead, ...rest] = collection.intro;
  const guide = collection.guide ? getGuide(collection.guide) : null;
  const related = collection.related.flatMap((slug) => getCollection(slug) ?? []);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Palas de pádel", href: routes.catalog },
          { label: collection.label, href: path },
        ]}
      />

      <div className="mx-auto max-w-[1280px] pb-10 lg:pb-[72px]">
        <PageHeading title={collection.title} lead={lead} />

        <section aria-labelledby="palas-coleccion" className="px-5 pt-6 lg:px-12 lg:pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="palas-coleccion" className="text-sm font-normal text-muted">
              <strong className="text-carbon">{pluralize(facts.total, "pala", "palas")}</strong>
              {facts.priced > 0 && facts.from !== null && (
                <>
                  {" "}
                  · {facts.priced} con precio hoy, desde {formatEuroCompact(facts.from)}
                </>
              )}
            </h2>
            <Link href={catalogHref(collection.query)} className="text-sm font-bold underline">
              Afinar con más filtros
            </Link>
          </div>
          <PalaGrid palas={result.items} columns={4} className="mt-5 lg:mt-6" />
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(number) => pageHref(path, number)}
            className="mt-10"
          />
        </section>

        <div className="mx-5 mt-12 grid gap-10 border-t border-line pt-10 lg:mx-12 lg:mt-[72px] lg:grid-cols-2 lg:gap-14">
          <section aria-labelledby="sobre-coleccion">
            <h2 id="sobre-coleccion" className="text-[22px] leading-[1.08] font-black tracking-[-0.025em] text-balance lg:text-[26px]">
              Cómo elegir entre {collection.title.charAt(0).toLowerCase() + collection.title.slice(1)}
            </h2>
            {rest.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-base leading-[1.6] text-pretty text-ink">
                {paragraph}
              </p>
            ))}
            <p className="mt-3 text-base leading-[1.6] text-pretty text-ink">
              Las características de cada pala son las que declaran fabricantes y tiendas; el precio
              es el más bajo que hemos comprobado hoy en las tiendas que seguimos.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
              {guide && (
                <Link href={routes.guide(guide.slug)} className="inline-flex min-h-11 items-center font-bold underline">
                  Guía: {guide.title}
                </Link>
              )}
              <Link href={routes.idealPala} className="inline-flex min-h-11 items-center font-bold underline">
                Encontrar mi pala ideal
              </Link>
            </div>
          </section>
          <ListingFaq id="preguntas" items={collection.faq} />
        </div>

        <div className="mx-5 mt-10 grid gap-8 lg:mx-12 lg:grid-cols-2 lg:gap-14">
          <CollectionLinks id="colecciones-afines" title="También te puede interesar" items={related} />
          <BrandLinks id="palas-por-marca" title="Palas por marca" brands={brands} withCatalogLink />
        </div>
      </div>
    </>
  );
}
