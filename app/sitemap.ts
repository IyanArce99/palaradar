import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getAllPalaSlugs, getAlternativePairs, getBrands } from "@/data";
import { comparePath, uniquePairs } from "@/lib/compare";
import { routes } from "@/lib/routes";
import { absoluteUrl } from "@/lib/seo";

// Solo las páginas indexables: /guias/ y /escanear/ entrarán cuando tengan
// contenido propio. Del comparador entran la portada y las comparaciones
// curadas (palas «parecidas»); el resto de combinaciones no se indexan.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Antes del lanzamiento no se anuncia ninguna dirección.
  if (!siteConfig.allowIndexing) return [];

  const [brands, slugs, pairs] = await Promise.all([
    getBrands(),
    getAllPalaSlugs(),
    getAlternativePairs(),
  ]);

  return [
    { url: absoluteUrl(routes.home), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl(routes.catalog), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl(routes.deals), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl(routes.compare), changeFrequency: "weekly", priority: 0.6 },
    ...brands.map((brand) => ({
      url: absoluteUrl(routes.brand(brand.slug)),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...slugs.map((slug) => ({
      url: absoluteUrl(routes.pala(slug)),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...uniquePairs(pairs).map(([a, b]) => ({
      url: absoluteUrl(comparePath(a, b)),
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
  ];
}
