import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { collections } from "@/content/collections";
import { guides } from "@/content/guides";
import { countPalas, getAlternativePairs, getBrands, getIndexablePalas } from "@/data";
import { comparePath } from "@/lib/compare";
import { selectForSitemap } from "@/lib/indexability";
import { routes } from "@/lib/routes";
import { absoluteUrl } from "@/lib/seo";

// Solo las páginas indexables: /escanear/ entrará cuando funcione. Todo lo que
// cuelga de las fichas sale de las que pasan el criterio de lib/indexability.ts:
//   · fichas: las aptas; las demás siguen publicadas, pero en noindex;
//   · marcas: las que tienen al menos una ficha apta;
//   · comparaciones: las curadas (palas «parecidas») cuyas dos fichas son aptas;
//   · colecciones: las que tienen alguna pala; guías: todas.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Antes del lanzamiento no se anuncia ninguna dirección.
  if (!siteConfig.allowIndexing) return [];

  const [brands, indexable, curatedPairs, collectionSizes] = await Promise.all([
    getBrands(),
    getIndexablePalas(),
    getAlternativePairs(),
    Promise.all(collections.map((collection) => countPalas(collection.query))),
  ]);
  const { palaSlugs, brandSlugs, pairs } = selectForSitemap(
    indexable,
    brands.map((brand) => brand.slug),
    curatedPairs,
  );

  return [
    { url: absoluteUrl(routes.home), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl(routes.catalog), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl(routes.deals), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl(routes.compare), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl(routes.guides), changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl(routes.idealPala), changeFrequency: "monthly", priority: 0.6 },
    ...guides.map((guide) => ({
      url: absoluteUrl(routes.guide(guide.slug)),
      lastModified: guide.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...collections
      .filter((_, i) => collectionSizes[i] > 0)
      .map((collection) => ({
        url: absoluteUrl(routes.collection(collection.slug)),
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ...brandSlugs.map((slug) => ({
      url: absoluteUrl(routes.brand(slug)),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...palaSlugs.map((slug) => ({
      url: absoluteUrl(routes.pala(slug)),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...pairs.map(([a, b]) => ({
      url: absoluteUrl(comparePath(a, b)),
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
  ];
}
