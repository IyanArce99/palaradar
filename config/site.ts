export const siteConfig = {
  name: "PalaRadar",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://palaradar.es").replace(/\/$/, ""),
  locale: "es_ES",
  tagline: "Encuentra tu pala. Y no pagues de más.",
  description:
    "Compara palas de pádel, consulta sus características y encuentra el mejor precio entre las tiendas que seguimos.",
  // Correo de contacto público (política de privacidad). Sin él, la página lo dice.
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null,
  // Interruptor de lanzamiento: hasta activarlo, el sitio se sirve con noindex.
  allowIndexing: process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true",
} as const;
