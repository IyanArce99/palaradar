import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackView } from "@/components/analytics/TrackView";
import { CollectionLinks } from "@/components/catalog/CollectionLinks";
import { ListingFaq } from "@/components/catalog/ListingFaq";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { RecentPriceNote } from "@/components/ui/RecentPriceNote";
import { siteConfig } from "@/config/site";
import { getCollection } from "@/content/collections";
import { getGuide, guides } from "@/content/guides";
import { getTopPalas } from "@/data";
import { resolveGuidePicks, type ResolvedPick } from "@/data/guides";
import { priceHeading } from "@/lib/compare";
import { formatDate, formatEuro, formatRating } from "@/lib/format";
import { pickHighlights, pickReason, pickTraits, readingMinutes } from "@/lib/guides";
import { isProductPhoto, palaAlt } from "@/lib/media";
import { routes } from "@/lib/routes";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

// Las palas seleccionadas y sus precios dependen del día: se regenera cada hora.
export const revalidate = 3600;

const HERO_PHOTOS = 3;
const H2 = "text-2xl leading-[1.08] font-black tracking-[-0.025em] text-balance lg:text-[30px]";
const BODY = "text-base leading-[1.65] text-pretty text-ink";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return {};

  return pageMetadata({
    title: guide.title,
    description: guide.description,
    path: routes.guide(guide.slug),
  });
}

/** Tarjeta de la pala de un apartado: foto real, datos declarados, precio de hoy y por qué sale. */
function PickCard({ resolved }: { resolved: ResolvedPick }) {
  const { pala, score } = resolved;
  const { price } = pala;
  const { best, weakest } = pickHighlights(pala);

  return (
    <>
      <article className="relative mt-4 grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-3 rounded-[20px] border border-line p-3 hover:border-carbon lg:grid-cols-[150px_minmax(0,1fr)_auto] lg:gap-x-5 lg:rounded-3xl lg:p-4">
        <PalaPhoto
          src={pala.images[0] ?? null}
          alt={palaAlt(pala)}
          sizes="(min-width: 1024px) 150px, 96px"
          className="h-[120px] rounded-[14px] lg:h-[170px] lg:rounded-2xl"
        />
        <div className="min-w-0">
          <p className="text-xs text-muted lg:text-[13px]">
            {pala.brand.name} · {pala.year}
          </p>
          <h3 className="text-lg leading-[1.15] font-black lg:text-[22px]">
            <Link href={routes.pala(pala.slug)} className="after:absolute after:inset-0">
              {pala.model}
            </Link>
          </h3>
          {score !== null && pala.sourceRatings && (
            <p className="mt-1 text-[13px] lg:text-sm">
              <strong className="tabular-nums">{formatRating(score)}</strong> sobre 10{" "}
              <span className="text-muted">· {pala.sourceRatings.source}</span>
            </p>
          )}
          <p className="mt-1 text-[13px] text-ink lg:text-sm">{pickTraits(pala)}</p>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-3 lg:col-span-1 lg:flex-col lg:items-end">
          <div className="lg:text-right">
            <p className="text-xs text-muted">{price ? "desde" : priceHeading(null)}</p>
            {price && (
              <p className="text-[22px] leading-tight font-black whitespace-nowrap tabular-nums lg:text-[26px]">
                {formatEuro(price.current)}
              </p>
            )}
            {price?.verdict.status === "recent" && <RecentPriceNote />}
          </div>
          <span className="flex h-11 items-center rounded-[14px] bg-lime px-5 text-[15px] font-extrabold lg:h-12">
            {price ? "Ver precios" : "Ver ficha"}
          </span>
        </div>
      </article>

      <p className={`${BODY} mt-4`}>{pickReason(pala, score)}</p>
      {(best.length > 0 || weakest) && (
        <dl className="mt-3 grid gap-x-10 gap-y-1.5 text-sm leading-normal lg:grid-cols-2 lg:text-[15px]">
          {best.length > 0 && (
            <div>
              <dt className="inline font-extrabold">Sus notas más altas: </dt>
              <dd className="inline text-ink">{best.join(" y ")}.</dd>
            </div>
          )}
          {weakest && (
            <div>
              <dt className="inline font-extrabold">La más baja: </dt>
              <dd className="inline text-ink">{weakest}.</dd>
            </div>
          )}
        </dl>
      )}
    </>
  );
}

export default async function GuidePage({ params }: GuidePageProps) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();

  const [picks, top] = await Promise.all([resolveGuidePicks(guide), getTopPalas(8)]);
  const path = routes.guide(guide.slug);

  // Fotos reales para la cabecera: las de las palas de la guía y, si faltan, otras del catálogo.
  const heroPhotos = [
    ...picks.map(({ pala }) => ({ image: pala.images[0] ?? null, name: palaAlt(pala) })),
    ...top.map((pala) => ({ image: pala.image, name: palaAlt(pala) })),
  ]
    .filter((photo): photo is { image: string; name: string } => photo.image !== null && isProductPhoto(photo.image))
    .filter((photo, i, all) => all.findIndex((other) => other.image === photo.image) === i)
    .slice(0, HERO_PHOTOS);

  const toc = [
    ...picks.map(({ pick }, i) => ({ id: pick.id, label: `${i + 1}. ${pick.eyebrow}` })),
    ...guide.blocks.map((block) => ({ id: block.id, label: block.title })),
    ...(guide.faq.length > 0 ? [{ id: "preguntas", label: "Preguntas frecuentes" }] : []),
  ];
  const related = guide.collections.flatMap((slug) => getCollection(slug) ?? []);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: guide.title,
          description: guide.description,
          dateModified: guide.updatedAt,
          inLanguage: "es",
          mainEntityOfPage: absoluteUrl(path),
          author: { "@type": "Organization", name: siteConfig.name },
          publisher: { "@type": "Organization", name: siteConfig.name },
          ...(heroPhotos.length > 0 ? { image: heroPhotos.map((photo) => photo.image) } : {}),
        }}
      />
      <TrackView event={ANALYTICS_EVENTS.viewGuide} props={{ guia: guide.slug }} />
      <Breadcrumbs
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Guías", href: routes.guides },
          { label: guide.title, href: path },
        ]}
      />

      <div className="mx-auto max-w-[1280px] px-5 pt-1 pb-10 lg:grid lg:grid-cols-[220px_minmax(0,720px)] lg:gap-12 lg:px-12 lg:pt-8 lg:pb-20">
        <nav aria-labelledby="en-esta-guia" className="hidden lg:block">
          <div className="sticky top-6">
            <p id="en-esta-guia" className="text-[15px] font-extrabold">
              En esta guía
            </p>
            <ul className="mt-3 flex flex-col gap-2.5 text-sm text-muted">
              {toc.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="hover:text-carbon hover:underline">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <article>
          <h1 className="text-[34px] leading-none font-black tracking-[-0.04em] text-balance lg:text-[56px]">
            {guide.title}
          </h1>
          <p className="mt-3 text-[13px] text-muted">
            Por el equipo de {siteConfig.name} · actualizada el {formatDate(guide.updatedAt)} ·{" "}
            {readingMinutes(guide)} min de lectura
          </p>
          {guide.intro.map((paragraph) => (
            <p key={paragraph} className="mt-4 text-[17px] leading-[1.6] text-pretty text-ink lg:mt-5 lg:text-[19px]">
              {paragraph}
            </p>
          ))}

          {heroPhotos.length > 0 && (
            <div aria-hidden="true" className="mt-6 flex h-[200px] items-center justify-center gap-1 overflow-hidden rounded-3xl bg-mist px-3 lg:mt-8 lg:h-[340px] lg:gap-4 lg:rounded-[28px] lg:px-8">
              {heroPhotos.map((photo, i) => (
                <PalaPhoto
                  key={photo.image}
                  src={photo.image}
                  alt=""
                  sizes="(min-width: 1024px) 240px, 33vw"
                  // La pala del centro, algo mayor; sin el margen de las tarjetas para que llenen el bloque.
                  imageClassName="object-contain mix-blend-multiply"
                  className={i === 1 ? "h-[96%] flex-1 !bg-transparent" : "h-[80%] flex-1 !bg-transparent"}
                />
              ))}
            </div>
          )}
          {picks.length > 0 && (
            <p className="mt-2.5 text-xs leading-normal text-muted">
              Las palas de esta guía se eligen solas con los datos de hoy: en cada apartado, la mejor
              puntuada por PadelZoom entre las que tienen precio en las tiendas que seguimos. Las
              puntuaciones son de PadelZoom, no de {siteConfig.name}.
            </p>
          )}

          {picks.map((resolved, i) => (
            <section key={resolved.pick.id} id={resolved.pick.id} aria-labelledby={`${resolved.pick.id}-titulo`} className="mt-10 scroll-mt-6 lg:mt-16">
              <p className="text-[13px] font-extrabold tracking-[0.02em] text-muted uppercase">
                {i + 1} · {resolved.pick.eyebrow}
              </p>
              <h2 id={`${resolved.pick.id}-titulo`} className={`${H2} mt-1`}>
                {resolved.pick.title}
              </h2>
              <p className={`${BODY} mt-3`}>{resolved.pick.why}</p>
              <PickCard resolved={resolved} />
            </section>
          ))}

          {guide.blocks.map((block) => (
            <section key={block.id} id={block.id} aria-labelledby={`${block.id}-titulo`} className="mt-10 scroll-mt-6 lg:mt-14">
              <h2 id={`${block.id}-titulo`} className={H2}>
                {block.title}
              </h2>
              {block.paragraphs.map((paragraph) => (
                <p key={paragraph} className={`${BODY} mt-3`}>
                  {paragraph}
                </p>
              ))}
              {block.links && (
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                  {block.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="inline-flex min-h-11 items-center font-bold underline">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <aside className="mt-10 flex flex-col gap-4 rounded-[22px] bg-lime p-[22px] lg:mt-12 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div>
              <p className="text-xl leading-[1.1] font-black lg:text-2xl">¿Aún con dudas?</p>
              <p className="mt-1 text-sm leading-[1.45] text-forest lg:text-[15px]">
                6 preguntas y te recomendamos las palas que mejor encajan contigo, con su mejor precio.
              </p>
            </div>
            <Link
              href={routes.idealPala}
              className="flex h-[50px] flex-none items-center justify-center rounded-[14px] bg-carbon px-5 text-[15px] font-extrabold whitespace-nowrap text-white"
            >
              Encontrar mi pala ideal
            </Link>
          </aside>

          <ListingFaq id="preguntas" items={guide.faq} className="mt-10 scroll-mt-6 lg:mt-14" />

          {related.length > 0 && (
            <CollectionLinks id="palas-relacionadas" title="Palas relacionadas con esta guía" items={related} className="mt-10 lg:mt-14" />
          )}

          <nav aria-labelledby="otras-guias" className="mt-10 border-t border-line pt-8 lg:mt-14">
            <h2 id="otras-guias" className="text-[15px] font-extrabold">
              Otras guías
            </h2>
            <ul className="mt-2">
              {guides
                .filter((other) => other.slug !== guide.slug)
                .map((other) => (
                  <li key={other.slug}>
                    <Link href={routes.guide(other.slug)} className="inline-flex min-h-11 items-center text-[15px] font-bold underline">
                      {other.title}
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>
        </article>
      </div>
    </>
  );
}
