export const routes = {
  home: "/",
  catalog: "/palas-padel/",
  brand: (brandSlug: string) => `/palas-padel/${brandSlug}/`,
  pala: (slug: string) => `/pala/${slug}/`,
  deals: "/ofertas/",
  compare: "/comparar/",
  guides: "/guias/",
  scan: "/escanear/",
  idealPala: "/pala-ideal/",
  /** Sugerencias del buscador de palas (JSON) */
  searchApi: "/api/palas/",
} as const;
