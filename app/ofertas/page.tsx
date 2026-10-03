import type { Metadata } from "next";
import { PalaGrid } from "@/components/pala/PalaGrid";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeading } from "@/components/ui/PageHeading";
import { getDeals } from "@/data";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Ofertas en palas de pádel: las mayores bajadas de precio",
  description:
    "Palas de pádel rebajadas hoy, ordenadas por descuento. Comprueba en cada ficha si de verdad es buen momento para comprar.",
  path: routes.deals,
});

export const revalidate = 3600;

const MAX_DEALS = 48;

export default async function DealsPage() {
  const deals = await getDeals(MAX_DEALS);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Ofertas", href: routes.deals },
        ]}
      />

      <div className="mx-auto max-w-[1280px] pb-10 lg:pb-[72px]">
        <PageHeading
          title="Ofertas en palas de pádel"
          lead="Las palas que más han bajado respecto a su precio anterior, de mayor a menor descuento."
        />
        <div className="px-5 pt-6 lg:px-12 lg:pt-8">
          {/* Las tarjetas usan h3: este titular mantiene la jerarquía de encabezados */}
          <h2 className="sr-only">Palas rebajadas</h2>
          {deals.length > 0 ? (
            <PalaGrid palas={deals} variant="offer" columns={4} />
          ) : (
            <>
              <p className="text-base text-ink">Ahora mismo no hay palas rebajadas.</p>
              <ButtonLink href={routes.catalog} variant="dark" className="mt-5">
                Ver todas las palas
              </ButtonLink>
            </>
          )}
          <DemoNotice className="mt-8">Precios y descuentos de ejemplo.</DemoNotice>
        </div>
      </div>
    </>
  );
}
