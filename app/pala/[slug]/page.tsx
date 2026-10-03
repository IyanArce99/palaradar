import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alternatives } from "@/components/ficha/Alternatives";
import { AudienceFit } from "@/components/ficha/AudienceFit";
import { EditorialSummary } from "@/components/ficha/EditorialSummary";
import { Faq } from "@/components/ficha/Faq";
import { PalaHeader } from "@/components/ficha/PalaHeader";
import { PlayerOpinions } from "@/components/ficha/PlayerOpinions";
import { PlayFeel } from "@/components/ficha/PlayFeel";
import { PriceCard } from "@/components/ficha/PriceCard";
import { PriceInsight } from "@/components/ficha/PriceInsight";
import { SpecsTable } from "@/components/ficha/SpecsTable";
import { StickyPriceBar } from "@/components/ficha/StickyPriceBar";
import { StoreList } from "@/components/ficha/StoreList";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { getAllPalaSlugs, getPalaBySlug, hasTestPrices } from "@/data";
import { routes } from "@/lib/routes";
import { pageMetadata, productJsonLd } from "@/lib/seo";

// Precios y veredicto dependen de la fecha: la ficha se regenera cada hora.
export const revalidate = 3600;

const REVIEWS_ID = "opiniones";
const STORES_ID = "tiendas";

interface PalaPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return (await getAllPalaSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PalaPageProps): Promise<Metadata> {
  const { slug } = await params;
  const pala = await getPalaBySlug(slug);
  if (!pala) return {};

  const name = `${pala.brand.name} ${pala.model} ${pala.year}`;
  return pageMetadata({
    title: `${name}: opiniones y precios`,
    description: `${pala.description} Opiniones de jugadores, para quién es y precio de la ${name} en todas las tiendas.`,
    path: routes.pala(pala.slug),
  });
}

export default async function PalaPage({ params }: PalaPageProps) {
  const { slug } = await params;
  const pala = await getPalaBySlug(slug);
  if (!pala) notFound();

  const { price } = pala;
  const path = routes.pala(pala.slug);
  const fullName = `${pala.brand.name} ${pala.model} ${pala.year}`;

  return (
    <article>
      <JsonLd data={productJsonLd({ pala, path, includeOffers: !hasTestPrices })} />

      <Breadcrumbs
        mobileBack={{ label: "Palas", href: routes.catalog }}
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Palas de pádel", href: routes.catalog },
          { label: pala.brand.name, href: routes.brand(pala.brand.slug) },
          { label: `${pala.model} ${pala.year}`, href: path },
        ]}
      />

      {/* 1–4 · Foto, identidad, valoración y resumen editorial */}
      <div className="mx-auto max-w-[1280px] lg:grid lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:px-12 lg:pt-5">
        <div className="mx-4 lg:mx-0">
          <PalaPhoto
            src={pala.images[0] ?? null}
            alt={fullName}
            sizes="(min-width: 1024px) 600px, 100vw"
            placeholderLabel="foto pala · fondo neutro, recortada"
            className="h-[340px] rounded-3xl lg:h-[600px] lg:rounded-[28px]"
          />
        </div>
        <div className="px-5 pt-[18px] lg:px-0 lg:pt-2">
          <PalaHeader pala={pala} reviewsHref={`#${REVIEWS_ID}`} />
          <EditorialSummary editorial={pala.editorial} className="mt-8" />
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] pb-8 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-14 lg:px-12 lg:pt-[72px] lg:pb-20">
        {/* 5–6 · ¿Para quién es? y opiniones */}
        <div className="flex flex-col gap-9 px-5 pt-9 lg:col-start-1 lg:row-start-1 lg:gap-16 lg:px-0 lg:pt-0">
          <div className="grid gap-9 lg:grid-cols-2 lg:items-start lg:gap-10">
            <AudienceFit editorial={pala.editorial} />
            <PlayFeel editorial={pala.editorial} />
          </div>
          <PlayerOpinions pala={pala} id={REVIEWS_ID} />
        </div>

        {/* 7 · Precio: en línea en móvil, fijo a la derecha en escritorio */}
        {price && (
          <aside className="px-4 pt-9 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:px-0 lg:pt-0">
            <PriceCard price={price} storesHref={`#${STORES_ID}`} className="lg:sticky lg:top-5" />
          </aside>
        )}

        {/* 8–13 · Tiendas, histórico, alternativas, especificaciones y FAQ */}
        <div className="flex flex-col gap-9 px-5 pt-9 lg:col-start-1 lg:row-start-2 lg:gap-16 lg:px-0 lg:pt-16">
          {price && (
            <>
              <StoreList price={price} id={STORES_ID} />
              <PriceInsight price={price} history={pala.priceHistory} />
            </>
          )}
          <Alternatives alternatives={pala.alternatives} model={pala.model} />
          <div className="grid gap-9 lg:grid-cols-2 lg:items-start lg:gap-10">
            <SpecsTable pala={pala} />
            <Faq items={pala.faq} />
          </div>
        </div>
      </div>

      {price && <StickyPriceBar price={price} storesHref={`#${STORES_ID}`} />}
    </article>
  );
}
