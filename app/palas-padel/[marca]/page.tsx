import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLinks } from "@/components/catalog/BrandLinks";
import { Pagination } from "@/components/catalog/CatalogToolbar";
import { CollectionLinks } from "@/components/catalog/CollectionLinks";
import { CollectionPage } from "@/components/catalog/CollectionPage";
import { ListingFaq } from "@/components/catalog/ListingFaq";
import { PalaGrid } from "@/components/pala/PalaGrid";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeading } from "@/components/ui/PageHeading";
import { getCollection } from "@/content/collections";
import { countPalas, getBrandBySlug, getBrands, searchCatalog } from "@/data";
import {
  catalogHref,
  DEFAULT_QUERY,
  pageHref,
  parseCatalogQuery,
  type RawSearchParams,
} from "@/lib/catalog/query";
import { pageSuffix } from "@/lib/catalog/seo";
import { formatEuroCompact, pluralize } from "@/lib/format";
import { SHAPE_LABELS } from "@/lib/labels";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import type { Brand, FaqItem, PalaShape } from "@/types/catalog";

// Este nivel de la URL lo comparten las marcas (/palas-padel/bullpadel/) y las
// colecciones del catálogo (/palas-padel/redondas/). Ningún slug de marca
// coincide con el de una colección; si coincidiera, manda la colección.
interface ListingPageProps {
  params: Promise<{ marca: string }>;
  searchParams: Promise<RawSearchParams>;
}

/** Tope que equivale a «con precio vigente» en el filtro de precio del catálogo */
const ANY_PRICE = 100_000;
const SHAPES = Object.keys(SHAPE_LABELS) as PalaShape[];
const LONG_TITLE = 30;

/** De la URL de estas páginas solo se lee la paginación. */
async function readPage(searchParams: Promise<RawSearchParams>): Promise<number> {
  return parseCatalogQuery(await searchParams).page;
}

export async function generateMetadata({ params, searchParams }: ListingPageProps): Promise<Metadata> {
  const { marca } = await params;
  const page = await readPage(searchParams);

  const collection = getCollection(marca);
  if (collection) {
    // Los titulares largos llevan un remate corto para que el título no se corte en el buscador.
    const tail = collection.title.length > LONG_TITLE ? "precios" : "características y precios";
    return pageMetadata({
      title: `${collection.title}: ${tail}${pageSuffix(page)}`,
      description: collection.description,
      path: pageHref(routes.collection(collection.slug), page),
    });
  }

  const brand = await getBrandBySlug(marca);
  if (!brand) return {};

  // Cada página es canónica de sí misma e indexable, como en el catálogo.
  return pageMetadata({
    title: `Palas de pádel ${brand.name}: características y precios${pageSuffix(page)}`,
    description: `Todas las palas ${brand.name} con sus características y su mejor precio en cada tienda. ${brand.description}`,
    path: pageHref(routes.brand(brand.slug), page),
  });
}

/** Lo que el catálogo tiene hoy de una marca: cuántas a la venta, desde qué precio y de qué formas. */
async function brandFacts(brand: Brand) {
  const filter = { brands: [brand.slug] };
  const [priced, cheapest, shapes] = await Promise.all([
    countPalas({ ...filter, maxPrice: ANY_PRICE }),
    searchCatalog({ ...DEFAULT_QUERY, ...filter, sort: "precio" }, { pageSize: 1 }),
    Promise.all(SHAPES.map(async (shape) => ({ shape, count: await countPalas({ ...filter, shapes: [shape] }) }))),
  ]);
  return { priced, from: cheapest.items[0]?.price ?? null, shapes: shapes.filter(({ count }) => count > 0) };
}

/** Preguntas de la página de marca, respondidas con los datos del catálogo de hoy. */
function brandFaq(brand: Brand, total: number, facts: Awaited<ReturnType<typeof brandFacts>>): FaqItem[] {
  const items: FaqItem[] = [];
  if (facts.from !== null) {
    items.push({
      question: `¿Cuánto cuesta una pala ${brand.name}?`,
      answer: `Hoy hay ${pluralize(facts.priced, "pala", "palas")} ${brand.name} con precio en las tiendas que seguimos, desde ${formatEuroCompact(facts.from)}. El precio de cada una, tienda a tienda, está en su ficha.`,
    });
  }
  if (facts.shapes.length > 0) {
    const list = facts.shapes
      .map(({ shape, count }) => `${count} de forma ${SHAPE_LABELS[shape].toLowerCase()}`)
      .join(", ");
    items.push({
      question: `¿Qué tipos de pala tiene ${brand.name}?`,
      answer: `En el catálogo hay ${pluralize(total, "pala", "palas")} ${brand.name}: ${list}. Puedes filtrarlas por nivel, estilo de juego y presupuesto.`,
    });
  }
  items.push({
    question: `¿Dónde comprar una pala ${brand.name} al mejor precio?`,
    answer: `En la ficha de cada pala comparamos su precio en las tiendas que seguimos, de más barata a más cara, e indicamos si el envío está incluido. Los precios se comprueban varias veces al día.`,
  });
  return items;
}

export default async function ListingPage({ params, searchParams }: ListingPageProps) {
  const { marca } = await params;
  const page = await readPage(searchParams);

  const collection = getCollection(marca);
  if (collection) return <CollectionPage collection={collection} page={page} />;

  const brand = await getBrandBySlug(marca);
  if (!brand) notFound();

  const [result, brands, facts] = await Promise.all([
    searchCatalog({ ...DEFAULT_QUERY, brands: [brand.slug], page }),
    getBrands(),
    brandFacts(brand),
  ]);
  if (page > result.pageCount) notFound();

  const brandPath = routes.brand(brand.slug);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Palas de pádel", href: routes.catalog },
          { label: brand.name, href: brandPath },
        ]}
      />

      <div className="mx-auto max-w-[1280px] pb-10 lg:pb-[72px]">
        <PageHeading title={`Palas de pádel ${brand.name}`} lead={brand.description} />

        <section aria-labelledby="palas-marca" className="px-5 pt-6 lg:px-12 lg:pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="palas-marca" className="text-sm font-normal text-muted">
              <strong className="text-carbon">{pluralize(result.total, "pala", "palas")}</strong> de{" "}
              {brand.name}
              {facts.from !== null && (
                <>
                  {" "}
                  · {facts.priced} con precio hoy, desde {formatEuroCompact(facts.from)}
                </>
              )}
            </h2>
            <Link href={catalogHref({ brands: [brand.slug], sort: "precio" })} className="text-sm font-bold underline">
              Ordenar por precio
            </Link>
          </div>

          {/* Las formas que tiene la marca, como accesos al catálogo filtrado. */}
          {facts.shapes.length > 1 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {facts.shapes.map(({ shape, count }) => (
                <li key={shape}>
                  <Link
                    href={catalogHref({ brands: [brand.slug], shapes: [shape] })}
                    className="flex h-10 items-center rounded-full border border-line px-3.5 text-[13px] font-bold hover:bg-mist"
                  >
                    {SHAPE_LABELS[shape]} <span className="ml-1.5 font-normal text-muted">{count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <PalaGrid palas={result.items} columns={4} className="mt-5 lg:mt-6" />
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(number) => pageHref(brandPath, number)}
            className="mt-10"
          />
        </section>

        <ListingFaq
          id="preguntas"
          title={`Preguntas sobre las palas ${brand.name}`}
          items={brandFaq(brand, result.total, facts)}
          className="mx-5 mt-12 border-t border-line pt-10 lg:mx-12 lg:mt-[72px]"
        />

        <div className="mx-5 mt-10 grid gap-8 lg:mx-12 lg:grid-cols-2 lg:gap-14">
          <BrandLinks
            id="otras-marcas"
            title="Otras marcas"
            brands={brands.filter((other) => other.slug !== brand.slug)}
            withCatalogLink
          />
          <CollectionLinks id="palas-por-tipo" title="Palas por tipo" />
        </div>
      </div>
    </>
  );
}
