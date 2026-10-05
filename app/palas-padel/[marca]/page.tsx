import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandLinks } from "@/components/catalog/BrandLinks";
import { Pagination } from "@/components/catalog/CatalogToolbar";
import { PalaGrid } from "@/components/pala/PalaGrid";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeading } from "@/components/ui/PageHeading";
import { getBrandBySlug, getBrands, searchCatalog } from "@/data";
import {
  DEFAULT_QUERY,
  pageHref,
  parseCatalogQuery,
  type RawSearchParams,
} from "@/lib/catalog/query";
import { pageSuffix } from "@/lib/catalog/seo";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

interface BrandPageProps {
  params: Promise<{ marca: string }>;
  searchParams: Promise<RawSearchParams>;
}

/** De la URL de una página de marca solo se lee la paginación. */
async function readPage(searchParams: Promise<RawSearchParams>): Promise<number> {
  return parseCatalogQuery(await searchParams).page;
}

export async function generateMetadata({
  params,
  searchParams,
}: BrandPageProps): Promise<Metadata> {
  const { marca } = await params;
  const brand = await getBrandBySlug(marca);
  if (!brand) return {};

  const page = await readPage(searchParams);

  // Cada página es canónica de sí misma e indexable, como en el catálogo.
  return pageMetadata({
    title: `Palas de pádel ${brand.name}: características y precios${pageSuffix(page)}`,
    description: `Todas las palas ${brand.name} con sus características y su mejor precio en cada tienda. ${brand.description}`,
    path: pageHref(routes.brand(brand.slug), page),
  });
}

export default async function BrandPage({ params, searchParams }: BrandPageProps) {
  const { marca } = await params;
  const brand = await getBrandBySlug(marca);
  if (!brand) notFound();

  const page = await readPage(searchParams);
  const [result, brands] = await Promise.all([
    searchCatalog({ ...DEFAULT_QUERY, brands: [brand.slug], page }),
    getBrands(),
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
          <h2 id="palas-marca" className="text-sm font-normal text-muted">
            <strong className="text-carbon">{pluralize(result.total, "pala", "palas")}</strong> de{" "}
            {brand.name}, primero las que están en más tiendas
          </h2>
          <PalaGrid palas={result.items} columns={4} className="mt-5 lg:mt-6" />
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(number) => pageHref(brandPath, number)}
            className="mt-10"
          />
        </section>

        <BrandLinks
          id="otras-marcas"
          title="Otras marcas"
          brands={brands.filter((other) => other.slug !== brand.slug)}
          withCatalogLink
          className="mx-5 mt-12 border-t border-line pt-10 lg:mx-12 lg:mt-[72px]"
        />
      </div>
    </>
  );
}
