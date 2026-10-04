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
  privacy: "/privacidad/",
  /** Confirmación y baja de una alerta de precio (enlaces de los correos) */
  alertConfirm: "/alertas/confirmar/",
  alertCancel: "/alertas/baja/",
  alertCancelApi: "/api/alertas/baja/",
  /** Sugerencias del buscador de palas (JSON) */
  searchApi: "/api/palas/",
} as const;
