export const routes = {
  home: "/",
  catalog: "/palas-padel/",
  brand: (brandSlug: string) => `/palas-padel/${brandSlug}/`,
  pala: (slug: string) => `/pala/${slug}/`,
  deals: "/ofertas/",
  compare: "/comparar/",
  guides: "/guias/",
  scan: "/escanear/",
} as const;
