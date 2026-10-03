export const siteConfig = {
  name: "PalaRadar",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://palaradar.es").replace(/\/$/, ""),
  locale: "es_ES",
  tagline: "Encuentra tu pala. Y no pagues de más.",
  description:
    "Compara palas de pádel, descubre qué opinan otros jugadores y encuentra el mejor precio en todas las tiendas.",
  // Interruptor de lanzamiento: hasta activarlo, el sitio se sirve con noindex.
  allowIndexing: process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true",
} as const;
