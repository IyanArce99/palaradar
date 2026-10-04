import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { isProductPhoto, palaAlt } from "@/lib/media";
import type { Pala } from "@/types/catalog";

export function absoluteUrl(path: string): string {
  return `${siteConfig.url}${path}`;
}

interface PageMetadataInput {
  title: string;
  description: string;
  /** Ruta canónica, con barra final; null si la página no debe declarar ninguna */
  path: string | null;
  /** false para páginas que no deben indexarse (resultados filtrados, secciones en preparación) */
  index?: boolean;
  /** Imagen para compartir (Open Graph): la foto real del producto, nunca una ilustración */
  image?: { url: string; width?: number; height?: number; alt: string } | null;
}

export function pageMetadata({
  title,
  description,
  path,
  index = true,
  image,
}: PageMetadataInput): Metadata {
  return {
    title,
    description,
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      title,
      description,
      ...(path ? { url: path } : {}),
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "website",
      ...(image ? { images: [image] } : {}),
    },
    // Si el sitio aún no es indexable, manda el noindex global del layout.
    ...(index || !siteConfig.allowIndexing ? {} : { robots: { index: false, follow: true } }),
  };
}

export function breadcrumbJsonLd(entries: { label: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: entries.map((entry, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: entry.label,
      item: absoluteUrl(entry.href),
    })),
  };
}

interface ProductJsonLdInput {
  pala: Pala;
  path: string;
  /** false mientras los precios sean de prueba: no se publican como ofertas. */
  includeOffers: boolean;
}

/**
 * Foto real de la pala para compartir la página, con sus dimensiones. null si
 * lo que se muestra es una ilustración: no se publica como imagen del producto.
 */
export function palaShareImage(pala: Pala) {
  const [main] = pala.images;
  if (!main || !isProductPhoto(main)) return null;
  return { url: main, ...pala.photoSize, alt: palaAlt(pala) };
}

export function productJsonLd({ pala, path, includeOffers }: ProductJsonLdInput) {
  const { price } = pala;
  // Las ilustraciones propias no son imagen del producto y no se publican como tal.
  const photos = pala.images.filter(isProductPhoto);

  // Sin opiniones no hay valoración que publicar.
  const rating =
    pala.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: pala.rating,
            reviewCount: pala.reviewCount,
          },
        }
      : {};

  // Un precio desactualizado tampoco se publica como oferta.
  const offers =
    includeOffers && price && price.freshness !== "stale"
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "EUR",
            lowPrice: price.current,
            highPrice: price.offers.at(-1)?.total ?? price.current,
            offerCount: price.storeCount,
          },
        }
      : {};

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${pala.brand.name} ${pala.model} ${pala.year}`,
    description: pala.editorial.summary,
    category: "Palas de pádel",
    brand: { "@type": "Brand", name: pala.brand.name },
    model: pala.model,
    url: absoluteUrl(path),
    ...(photos.length > 0 ? { image: photos } : {}),
    ...rating,
    ...offers,
  };
}
