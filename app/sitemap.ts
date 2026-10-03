import type { MetadataRoute } from "next";
import { getAllPalaSlugs, getBrands } from "@/data";
import { routes } from "@/lib/routes";
import { absoluteUrl } from "@/lib/seo";

// Solo las páginas indexables: /comparar/, /guias/ y /escanear/ entrarán
// cuando tengan contenido propio.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [brands, slugs] = await Promise.all([getBrands(), getAllPalaSlugs()]);

  return [
    { url: absoluteUrl(routes.home), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl(routes.catalog), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl(routes.deals), changeFrequency: "daily", priority: 0.8 },
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
  ];
}
