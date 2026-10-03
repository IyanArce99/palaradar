import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeading } from "@/components/ui/PageHeading";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { getGuides } from "@/data";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Guías para elegir pala de pádel",
  description:
    "Guías para elegir pala de pádel según tu nivel, tu forma de jugar y tu presupuesto.",
  path: routes.guides,
  // Se indexará cuando las guías tengan contenido propio.
  index: false,
});

export default async function GuidesPage() {
  const guides = await getGuides();

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
          lead="No existe la mejor pala para todo el mundo, pero sí la mejor para cómo juegas tú."
        />
        <ul className="grid gap-6 px-5 pt-6 lg:grid-cols-3 lg:px-12 lg:pt-8">
          {guides.map((guide) => (
            <li key={guide.slug}>
              <PalaPhoto
                src={guide.image}
                alt=""
                fit="cover"
                sizes="(min-width: 1024px) 33vw, 100vw"
                placeholderLabel="foto guía"
                className="h-[180px] rounded-[20px] lg:h-[220px]"
              />
              <p className="mt-3.5 text-[13px] font-bold text-muted">En preparación</p>
              <h2 className="mt-1 text-xl leading-[1.2] font-black">{guide.title}</h2>
              <p className="mt-1 text-[15px] text-muted">{guide.subtitle}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
