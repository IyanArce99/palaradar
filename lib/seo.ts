import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import type { PriceSummary } from "@/lib/pricing";
import type { Pala } from "@/types/catalog";

export function absoluteUrl(path: string): string {
  return `${siteConfig.url}${path}`;
}

interface PageMetadataInput {
  title: string;
  description: string;
  /** Ruta canónica, con barra final */
  path: string;
  /** false para páginas que no deben indexarse (resultados filtrados, secciones en preparación) */
  index?: boolean;
}

export function pageMetadata({ title, description, path, index = true }: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "website",
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
  price: PriceSummary | null;
  path: string;
  /** Con datos de ejemplo no se publican valoraciones ni ofertas. */
  includeCommercialData: boolean;
}

export function productJsonLd({ pala, price, path, includeCommercialData }: ProductJsonLdInput) {
  const commercial =
    includeCommercialData && price
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: pala.rating,
            reviewCount: pala.reviewCount,
          },
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
    ...(pala.images.length > 0 ? { image: pala.images } : {}),
    ...commercial,
  };
}
