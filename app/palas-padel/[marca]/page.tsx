import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandLinks } from "@/components/catalog/BrandLinks";
import { PalaGrid } from "@/components/pala/PalaGrid";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeading } from "@/components/ui/PageHeading";
import { getBrandBySlug, getBrands, getPalasByBrand } from "@/data";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

interface BrandPageProps {
  params: Promise<{ marca: string }>;
}

export async function generateStaticParams() {
  return (await getBrands()).map((brand) => ({ marca: brand.slug }));
}

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const { marca } = await params;
  const brand = await getBrandBySlug(marca);
  if (!brand) return {};

  return pageMetadata({
    title: `Palas de pádel ${brand.name}: opiniones y precios`,
    description: `Todas las palas ${brand.name} con opiniones de jugadores y su mejor precio en cada tienda. ${brand.description}`,
    path: routes.brand(brand.slug),
  });
}

export default async function BrandPage({ params }: BrandPageProps) {
  const { marca } = await params;
  const brand = await getBrandBySlug(marca);
  if (!brand) notFound();

  const [palas, brands] = await Promise.all([getPalasByBrand(brand.slug), getBrands()]);
  const otherBrands = brands.filter((other) => other.slug !== brand.slug);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Palas de pádel", href: routes.catalog },
          { label: brand.name, href: routes.brand(brand.slug) },
        ]}
      />

      <div className="mx-auto max-w-[1280px] pb-10 lg:pb-[72px]">
        <PageHeading title={`Palas de pádel ${brand.name}`} lead={brand.description} />

        <section aria-labelledby="palas-marca" className="px-5 pt-6 lg:px-12 lg:pt-8">
          <h2 id="palas-marca" className="text-sm font-normal text-muted">
            <strong className="text-carbon">{pluralize(palas.length, "pala", "palas")}</strong> de{" "}
            {brand.name}, de más a menos popular
          </h2>
          <PalaGrid palas={palas} columns={4} className="mt-5 lg:mt-6" />
        </section>

        <BrandLinks
          id="otras-marcas"
          title="Otras marcas"
          brands={otherBrands}
          withCatalogLink
          className="mx-5 mt-12 border-t border-line pt-10 lg:mx-12 lg:mt-[72px]"
        />
      </div>
    </>
  );
}
