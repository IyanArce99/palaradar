import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertBox } from "@/components/ficha/AlertBox";
import { Alternatives } from "@/components/ficha/Alternatives";
import { AtAGlance } from "@/components/ficha/AtAGlance";
import { AudienceFit } from "@/components/ficha/AudienceFit";
import { CollectionLinks } from "@/components/catalog/CollectionLinks";
import { collectionsForPala } from "@/lib/catalog/collections";
import { CompareAction } from "@/components/ficha/CompareAction";
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
import { ModelSeasons } from "@/components/ficha/ModelSeasons";
import {
  alertsAvailable,
  getPalaBySlug,
  getPricedPalaSlugs,
  getSimilarPalas,
  hasTestPrices,
  searchCatalog,
} from "@/data";
import { sameModelSeasons, similarityReason, similarityTarget } from "@/lib/similar";
import { catalogHref, DEFAULT_QUERY, type CatalogQuery } from "@/lib/catalog/query";
import { cn } from "@/lib/cn";
import { isIndexablePala } from "@/lib/indexability";
import { SHAPE_LABELS } from "@/lib/labels";
import { palaAlt } from "@/lib/media";
import { buildFaq, describePala, metaDescription, palaTitle } from "@/lib/pala-content";
import { routes } from "@/lib/routes";
import { faqJsonLd, pageMetadata, palaShareImage, productJsonLd } from "@/lib/seo";
import type { Pala, PalaSummary } from "@/types/catalog";

// Precios y veredicto dependen de la fecha: la ficha se regenera cada hora.
export const revalidate = 3600;

const REVIEWS_ID = "opiniones";
const HIGHLIGHTS_ID = "opiniones-destacadas";
const STORES_ID = "tiendas";
const ALERT_ID = "alerta";
const RELATED_COUNT = 4;
/** Resultados de la búsqueda por modelo entre los que se buscan sus otras temporadas */
const SEASONS_POOL = 24;

// La ficha se recorre como quien decide una compra: qué es → precio y tiendas →
// características → cómo se siente → evolución del precio → otras temporadas y
// parecidas → especificaciones → preguntas. Solo aparece cada bloque si tiene
// datos reales detrás.
//
// En móvil es una sola columna y el orden lo fija `max-lg:order-*`; en
// escritorio, el contenido va a la izquierda y el precio y la alerta, fijos a
// la derecha.
const BLOCK = "px-5 pt-9 lg:px-0 lg:pt-0";
const BLOCK_WIDE = "px-4 pt-9 lg:px-0 lg:pt-0";

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

  return pageMetadata({
    title: palaTitle(pala),
    description: metaDescription(pala),
    path: routes.pala(pala.slug),
    // Las fichas pobres siguen publicadas, pero en noindex y fuera del sitemap (lib/indexability.ts).
    index: isIndexablePala(pala),
    image: palaShareImage(pala),
  });
}

/** Otras palas del catálogo que cumplen un filtro, sin la de la ficha. */
async function otherPalas(pala: Pala, query: Partial<CatalogQuery>): Promise<PalaSummary[]> {
  const { items } = await searchCatalog({ ...DEFAULT_QUERY, ...query }, { pageSize: RELATED_COUNT + 1 });
  return items.filter((item) => item.slug !== pala.slug).slice(0, RELATED_COUNT);
}

interface Related {
  title: string;
  lead: string;
  items: { pala: PalaSummary; reason?: string }[];
}

/**
 * Palas relacionadas de la ficha: las elegidas a mano si las hay; si no, las
 * parecidas calculadas con datos declarados (lib/similar.ts), que siempre están
 * a la venta; y, si no hay ninguna de su forma con precio, otras de la marca.
 */
async function relatedPalas(pala: Pala): Promise<Related> {
  if (pala.alternatives.length > 0) {
    return {
      title: "¿Buscas algo parecido?",
      lead: `Palas con características próximas a las de la ${pala.model}.`,
      items: pala.alternatives.map(({ pala: other, reason }) => ({ pala: other, reason })),
    };
  }

  const similar = await getSimilarPalas(similarityTarget(pala), RELATED_COUNT);
  if (similar.length > 0) {
    return {
      title: `Palas parecidas a la ${pala.model}`,
      lead: "Tienen su misma forma y, donde se indica, el mismo balance, estilo o nivel, según los datos declarados. Todas tienen precio hoy.",
      items: similar.map(({ pala: other, shared }) => ({ pala: other, reason: similarityReason(shared) })),
    };
  }

  return {
    title: `Más palas de ${pala.brand.name}`,
    lead: `Otros modelos de ${pala.brand.name} en el catálogo, para comparar con la ${pala.model}.`,
    items: (await otherPalas(pala, { brands: [pala.brand.slug] })).map((other) => ({ pala: other })),
  };
}

/** Otras temporadas del mismo modelo que están en el catálogo. */
async function modelSeasons(pala: Pala): Promise<PalaSummary[]> {
  const { items } = await searchCatalog(
    { ...DEFAULT_QUERY, q: pala.model, brands: [pala.brand.slug] },
    { pageSize: SEASONS_POOL },
  );
  return sameModelSeasons(pala, items);
}

export default async function PalaPage({ params }: PalaPageProps) {
  const { slug } = await params;
  const pala = await getPalaBySlug(slug);
  if (!pala) notFound();

  const { price } = pala;
  const path = routes.pala(pala.slug);
  // Solo un precio vigente sirve de referencia para una alerta de bajada.
  const currentPrice = price && price.freshness !== "stale" ? price.current : null;
  const faq = [...pala.faq, ...buildFaq(pala)];
  const hasReviews = pala.reviews.length > 0;
  const [related, seasons] = await Promise.all([relatedPalas(pala), modelSeasons(pala)]);

  // Las alertas solo se ofrecen si funcionan de principio a fin (alerts/availability.ts).
  const alertHref = alertsAvailable() ? `#${ALERT_ID}` : null;
  // Sin precio y sin alertas, la salida de la ficha son palas de su forma que sí están a la venta.
  const shape = SHAPE_LABELS[pala.shape].toLowerCase();
  const onSale = {
    label: `Ver palas de forma ${shape} a la venta`,
    href: catalogHref({ shapes: [pala.shape], sort: "precio" }),
  };

  return (
    <article>
      <JsonLd data={productJsonLd({ pala, path, includeOffers: !hasTestPrices })} />
      {faq.length > 0 && <JsonLd data={faqJsonLd(faq)} />}

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

      {/* Cabecera: foto, nombre, precio de partida, acciones y descripción */}
      <div className="mx-auto max-w-[1280px] lg:grid lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:px-12 lg:pt-5">
        <div className="mx-4 lg:mx-0">
          <PalaPhoto
            src={pala.images[0] ?? null}
            alt={palaAlt(pala)}
            sizes="(min-width: 1024px) 600px, 100vw"
            priority
            placeholderLabel="foto pala · fondo neutro, recortada"
            className="h-[320px] rounded-3xl lg:h-[520px] lg:rounded-[28px]"
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
          <PalaHeader
            pala={pala}
            reviewsHref={`#${REVIEWS_ID}`}
            storesHref={`#${STORES_ID}`}
            alertHref={alertHref}
            onSale={onSale}
          />
          {/* Con un resumen editorial revisado se enseña ese; si no, la descripción con sus datos. */}
          {pala.editorial.status === "reviewed" ? (
            <EditorialSummary editorial={pala.editorial} className="mt-8" />
          ) : (
            <section aria-labelledby="descripcion" className="mt-8">
              <h2 id="descripcion" className="text-[22px] leading-[1.08] font-black tracking-[-0.025em]">
                Cómo es la {pala.model}
              </h2>
              <p className="mt-2.5 text-[17px] leading-[1.6] text-pretty text-ink">{describePala(pala)}</p>
            </section>
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-[1280px] flex-col pb-8 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-14 lg:px-12 lg:pt-[72px] lg:pb-20">
        <div className="contents lg:flex lg:flex-col lg:gap-16">
          <AtAGlance pala={pala} className={cn(BLOCK, "max-lg:order-3")} />

          <div className="contents lg:grid lg:grid-cols-2 lg:items-start lg:gap-10 lg:empty:hidden">
            {/* «¿Para quién es?» (paso 4 del recorrido del diseño). Sin datos no aparece; si
                solo hay uno de los dos bloques, ocupa todo el ancho. */}
            <AudienceFit
              editorial={pala.editorial}
              className={cn(BLOCK, "max-lg:order-4 lg:only:col-span-2")}
            />
            <PlayFeel pala={pala} className={cn(BLOCK, "max-lg:order-4 lg:only:col-span-2")} />
          </div>

          {price && (
            <>
              <PriceInsight
                price={price}
                history={pala.priceHistory}
                className={cn(BLOCK, "max-lg:order-5")}
              />
              {/* En móvil las tiendas van justo debajo del precio: es lo que busca quien quiere comprar. */}
              <StoreList price={price} id={STORES_ID} className={cn(BLOCK_WIDE, "max-lg:order-2")} />
            </>
          )}

          {hasReviews && (
            <div className={cn(BLOCK, "max-lg:order-8")}>
              <OpinionsSummary pala={pala} id={REVIEWS_ID} highlightsHref={`#${HIGHLIGHTS_ID}`} />
              <OpinionsHighlights reviews={pala.reviews} id={HIGHLIGHTS_ID} className="mt-6" />
            </div>
          )}

          <ModelSeasons pala={pala} seasons={seasons} className={cn(BLOCK, "max-lg:order-9")} />
          <Alternatives pala={pala} {...related} className={cn(BLOCK, "max-lg:order-9")} />
          <SpecsTable pala={pala} className={cn(BLOCK, "max-lg:order-10")} />
          {faq.length > 0 && (
            <div className={cn(BLOCK, "max-lg:order-11")}>
              <Faq items={faq} />
            </div>
          )}
          {/* Las colecciones en las que entra esta pala: enlaces a listados de palas del mismo tipo. */}
          <CollectionLinks
            id="mas-palas-como-esta"
            title="Más palas como esta"
            items={collectionsForPala({
              shape: pala.shape,
              playStyle: pala.playStyle,
              levels: pala.levels,
              year: pala.year,
              price: currentPrice,
            })}
            className={cn(BLOCK, "max-lg:order-12")}
          />
        </div>

        {/* Precio y alerta: fijos a la derecha en escritorio; en móvil, cada uno en su sitio del recorrido. */}
        <aside className="contents lg:sticky lg:top-5 lg:flex lg:flex-col lg:gap-3.5">
          <div className={cn(BLOCK_WIDE, "max-lg:order-1")}>
            <PriceCard
              price={price}
              msrp={pala.msrp}
              storesHref={`#${STORES_ID}`}
              alertHref={alertHref}
              onSale={onSale}
            />
          </div>
          {alertHref && (
            <div className={cn(BLOCK_WIDE, "max-lg:order-7")}>
              <AlertBox id={ALERT_ID} slug={pala.slug} currentPrice={currentPrice} />
            </div>
          )}
        </aside>
      </div>

      {price && <StickyPriceBar price={price} storesHref={`#${STORES_ID}`} />}
    </article>
  );
}
