import type { NextConfig } from "next";

// Las fotos de las palas se sirven desde el bucket público de Supabase Storage
// (config/media.ts). Sin SUPABASE_URL no hay imágenes remotas que permitir.
const storageUrl = process.env.SUPABASE_URL?.trim();
const storageHost = storageUrl ? new URL(storageUrl) : null;

const nextConfig: NextConfig = {
  // Las URLs canónicas del proyecto terminan en barra: /palas-padel/, /pala/[slug]/
  trailingSlash: true,
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
