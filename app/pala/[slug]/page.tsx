import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertBox } from "@/components/ficha/AlertBox";
import { CompareAction } from "@/components/ficha/CompareAction";
import { Alternatives } from "@/components/ficha/Alternatives";
import { AudienceFit } from "@/components/ficha/AudienceFit";
import { EditorialSummary } from "@/components/ficha/EditorialSummary";
import { Faq } from "@/components/ficha/Faq";
import { PalaHeader } from "@/components/ficha/PalaHeader";
import { OpinionsHighlights, OpinionsSummary } from "@/components/ficha/PlayerOpinions";
import { PlayFeel } from "@/components/ficha/PlayFeel";
import { PriceCard } from "@/components/ficha/PriceCard";
import { PriceInsight } from "@/components/ficha/PriceInsight";
import { SpecsTable } from "@/components/ficha/SpecsTable";
import { StickyPriceBar } from "@/components/ficha/StickyPriceBar";
import { StoreList } from "@/components/ficha/StoreList";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { getPalaBySlug, getPricedPalaSlugs, hasTestPrices } from "@/data";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import { pageMetadata, productJsonLd } from "@/lib/seo";

// Precios y veredicto dependen de la fecha: la ficha se regenera cada hora.
export const revalidate = 3600;

const REVIEWS_ID = "opiniones";
const HIGHLIGHTS_ID = "opiniones-destacadas";
const STORES_ID = "tiendas";
const ALERT_ID = "alerta";

// La ficha tiene el mismo contenido en dos órdenes distintos (diseño V3):
//   · móvil (1c): opiniones → para quién → sensaciones → precio → ¿está barata? → tiendas →
//     opiniones destacadas → especificaciones → parecidas → preguntas → alerta
//   · escritorio (2c): columna izquierda con para quién | sensaciones → ¿está barata? → tiendas →
//     opiniones → parecidas → especificaciones | preguntas, y a la derecha el precio fijo.
// Cada bloque es un hijo directo del contenedor: en móvil se ordena con `order`
// y en escritorio se coloca en su fila y columna de la rejilla.
const BLOCK = "px-5 pt-9 lg:px-0 lg:pt-0";
const BLOCK_WIDE = "px-4 pt-9 lg:px-0 lg:pt-0";
const FULL = "lg:col-span-2 lg:col-start-1";

interface PalaPageProps {
  params: Promise<{ slug: string }>;
}

// Solo se generan por adelantado las palas con precio; el resto del catálogo
// se genera la primera vez que se pide y queda en caché igual.
export async function generateStaticParams() {
  return (await getPricedPalaSlugs()).map((slug) => ({ slug }));
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
  const hasReviews = pala.reviews.length > 0;
  const hasAlternatives = pala.alternatives.length > 0;

  // Filas de la columna izquierda en escritorio. Un bloque que no se muestra no ocupa fila.
  let lastRow = 0;
  const nextRow = () => ++lastRow;
  const rows = {
    fit: nextRow(),
    insight: nextRow(),
    stores: nextRow(),
    opinions: nextRow(),
    highlights: hasReviews ? nextRow() : 0,
    alternatives: hasAlternatives ? nextRow() : 0,
    specs: nextRow(),
  };

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
        actions={<CompareAction slug={pala.slug} className="lg:hidden" />}
      />

      {/* Foto, identidad, valoración y resumen editorial */}
      <div className="mx-auto max-w-[1280px] lg:grid lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:px-12 lg:pt-5">
        <div className="mx-4 lg:mx-0">
          <PalaPhoto
            src={pala.images[0] ?? null}
            alt={`${pala.brand.name} ${pala.model} ${pala.year}`}
            sizes="(min-width: 1024px) 600px, 100vw"
            placeholderLabel="foto pala · fondo neutro, recortada"
            className="h-[340px] rounded-3xl lg:h-[600px] lg:rounded-[28px]"
          />
          {/* Miniaturas (escritorio) e indicador (móvil): solo si hay más de una imagen. */}
          {pala.images.length > 1 && (
            <>
              <ul className="mt-2.5 hidden grid-cols-4 gap-2.5 lg:grid">
                {pala.images.slice(0, 4).map((src, index) => (
                  <li key={src}>
                    <PalaPhoto
                      src={src}
                      alt=""
                      sizes="140px"
                      className={cn("h-24 rounded-[14px]", index === 0 && "border-2 border-carbon")}
                    />
                  </li>
                ))}
              </ul>
              <div aria-hidden="true" className="mt-2.5 flex justify-center gap-1.5 lg:hidden">
                {pala.images.slice(0, 4).map((src, index) => (
                  <span
                    key={src}
                    className={cn("h-1.5 rounded-[3px]", index === 0 ? "w-[18px] bg-carbon" : "w-1.5 bg-ash")}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="px-5 pt-[18px] lg:px-0 lg:pt-2">
          <PalaHeader pala={pala} reviewsHref={`#${REVIEWS_ID}`} storesHref={`#${STORES_ID}`} />
          <EditorialSummary editorial={pala.editorial} className="mt-8" />
        </div>
      </div>

      <div className="mx-auto flex max-w-[1280px] flex-col pb-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_380px] lg:gap-x-10 lg:gap-y-16 lg:px-12 lg:pt-[72px] lg:pb-20">
        <AudienceFit
          editorial={pala.editorial}
          className={cn(BLOCK, "order-2 lg:col-start-1")}
        />
        <PlayFeel editorial={pala.editorial} className={cn(BLOCK, "order-3 lg:col-start-2")} />

        <div className={cn(BLOCK, FULL, "order-5")} style={{ gridRow: rows.insight }}>
          <PriceInsight price={price} history={pala.priceHistory} />
        </div>

        <div className={cn(BLOCK_WIDE, FULL, "order-6")} style={{ gridRow: rows.stores }}>
          <StoreList price={price} id={STORES_ID} />
        </div>

        <div className={cn(BLOCK, FULL, "order-1")} style={{ gridRow: rows.opinions }}>
          <OpinionsSummary pala={pala} id={REVIEWS_ID} highlightsHref={`#${HIGHLIGHTS_ID}`} />
        </div>

        {hasReviews && (
          // En escritorio forma un solo bloque con el resumen: se acerca a él.
          <div className={cn(BLOCK, FULL, "order-7 lg:-mt-[42px]")} style={{ gridRow: rows.highlights }}>
            <OpinionsHighlights reviews={pala.reviews} id={HIGHLIGHTS_ID} />
          </div>
        )}

        {hasAlternatives && (
          <div className={cn(BLOCK, FULL, "order-9")} style={{ gridRow: rows.alternatives }}>
            <Alternatives alternatives={pala.alternatives} model={pala.model} />
          </div>
        )}

        <div className={cn(BLOCK_WIDE, "order-8 lg:col-start-1")} style={{ gridRow: rows.specs }}>
          <SpecsTable pala={pala} />
        </div>
        {pala.faq.length > 0 && (
          <div className={cn(BLOCK, "order-10 lg:col-start-2")} style={{ gridRow: rows.specs }}>
            <Faq items={pala.faq} />
          </div>
        )}

        {/* Precio y alerta: fijos a la derecha en escritorio; en móvil, cada uno en su sitio del recorrido. */}
        <aside
          className="contents lg:col-start-3 lg:ml-4 lg:block"
          style={{ gridRow: `1 / span ${lastRow}` }}
        >
          <div className="contents lg:sticky lg:top-5 lg:flex lg:flex-col lg:gap-3.5">
            <div className={cn(BLOCK_WIDE, "order-4")}>
              <PriceCard price={price} storesHref={`#${STORES_ID}`} alertHref={`#${ALERT_ID}`} />
            </div>
            <div className={cn(BLOCK_WIDE, "order-11")}>
              <AlertBox id={ALERT_ID} hasPrice={price !== null} />
            </div>
          </div>
        </aside>
      </div>

      {price && <StickyPriceBar price={price} storesHref={`#${STORES_ID}`} />}
    </article>
  );
}
