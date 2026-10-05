import type { NextConfig } from "next";

// Las fotos de las palas se sirven desde el bucket público de Supabase Storage
// (config/media.ts). Sin SUPABASE_URL no hay imágenes remotas que permitir.
const storageUrl = process.env.SUPABASE_URL?.trim();
const storageHost = storageUrl ? new URL(storageUrl) : null;

// El mismo interruptor de lanzamiento que config/site.ts: mientras no valga "true",
// el sitio no debe indexarse.
const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

const nextConfig: NextConfig = {
  // Las URLs canónicas del proyecto terminan en barra: /palas-padel/, /pala/[slug]/
  trailingSlash: true,
  // Antes del lanzamiento, todas las respuestas llevan noindex en la cabecera: también
  // las que no son HTML (imágenes, sitemap, API) y no pueden llevar la etiqueta meta.
  headers: () =>
    Promise.resolve(
      allowIndexing
        ? []
        : [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }],
    ),
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: storageHost
      ? [
          {
            protocol: storageHost.protocol === "http:" ? "http" : "https",
            hostname: storageHost.hostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
