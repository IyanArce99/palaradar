import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { isProductPhoto, palaAlt } from "@/lib/media";
import { describePala, fullSpecs } from "@/lib/pala-content";
import type { FaqItem, Pala } from "@/types/catalog";

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
  // Antes del lanzamiento no se declara canónica: iría con noindex y apuntando al
  // dominio definitivo, que todavía no sirve este sitio. Serían señales contradictorias.
  const canonical = siteConfig.allowIndexing ? path : null;

  return {
    title,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      title,
      description,
      ...(canonical ? { url: canonical } : {}),
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
    description: describePala(pala),
    category: "Palas de pádel",
    brand: { "@type": "Brand", name: pala.brand.name },
    model: pala.model,
    url: absoluteUrl(path),
    ...gtinProperty(pala.gtin),
    ...(pala.manufacturerRef ? { mpn: pala.manufacturerRef } : {}),
    ...(photos.length > 0 ? { image: photos } : {}),
    // Las características declaradas, las mismas que enseña la tabla de la ficha.
    additionalProperty: fullSpecs(pala)
      .filter((spec) => !IDENTIFIER_SPECS.has(spec.label))
      .map((spec) => ({ "@type": "PropertyValue", name: spec.label, value: spec.value })),
    ...rating,
    ...offers,
  };
}

/** Filas de la tabla que ya van como identificadores del producto */
const IDENTIFIER_SPECS = new Set(["EAN", "Referencia del fabricante"]);

/** El EAN se guarda con 14 dígitos; si empieza por 0 es un EAN-13 con relleno. */
function gtinProperty(gtin: string | null) {
  if (!gtin || !/^\d{8,14}$/.test(gtin)) return {};
  return gtin.length === 14 && gtin.startsWith("0") ? { gtin13: gtin.slice(1) } : { gtin };
}

/** Preguntas frecuentes de la página; solo si hay alguna. */
export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
