import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las URLs canónicas del proyecto terminan en barra: /palas-padel/, /pala/[slug]/
  trailingSlash: true,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
