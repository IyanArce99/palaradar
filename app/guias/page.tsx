import type { Metadata } from "next";
import Link from "next/link";
import { CollectionLinks } from "@/components/catalog/CollectionLinks";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeading } from "@/components/ui/PageHeading";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { getGuideCovers } from "@/data/guides";
import { readingMinutes } from "@/lib/guides";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

// Las fotos salen de las palas que cada guía selecciona hoy.
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Guías para elegir pala de pádel",
  description:
    "Guías para elegir pala de pádel según tu nivel, tu forma de jugar y tu presupuesto: cómo elegir, formas, palas para empezar y las mejor puntuadas a la venta.",
  path: routes.guides,
});

export default async function GuidesPage() {
  const covers = await getGuideCovers();

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Guías", href: routes.guides },
        ]}
      />
      <div className="mx-auto max-w-[1280px] pb-10 lg:pb-[72px]">
        <PageHeading
          title="Guías para elegir bien"
          lead="No existe la mejor pala para todo el mundo, pero sí la mejor para cómo juegas tú. Estas guías explican en qué fijarse y enseñan, con los precios de hoy, las palas mejor puntuadas de cada tipo."
        />
        <ul className="grid gap-x-6 gap-y-8 px-5 pt-6 lg:grid-cols-3 lg:gap-y-12 lg:px-12 lg:pt-10">
          {covers.map(({ guide, image }) => (
            <li key={guide.slug}>
              <article className="group relative">
                <PalaPhoto
                  src={image}
                  alt=""
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="h-[180px] rounded-3xl transition-[filter] group-hover:brightness-[0.97] lg:h-[220px]"
                />
                <p className="mt-3.5 text-sm text-muted">{readingMinutes(guide)} min de lectura</p>
                <h2 className="mt-1 text-xl leading-snug font-black">
                  <Link href={routes.guide(guide.slug)} className="after:absolute after:inset-0 group-hover:underline">
                    {guide.title}
                  </Link>
                </h2>
                <p className="mt-1 text-base leading-normal text-muted">{guide.subtitle}</p>
              </article>
            </li>
          ))}
        </ul>

        <CollectionLinks
          id="palas-por-tipo"
          title="Palas por tipo"
          className="mx-5 mt-12 border-t border-line pt-10 lg:mx-12 lg:mt-[72px]"
        />
      </div>
    </>
  );
}
