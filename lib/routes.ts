export const routes = {
  home: "/",
  catalog: "/palas-padel/",
  brand: (brandSlug: string) => `/palas-padel/${brandSlug}/`,
  /** Colección del catálogo (por forma, juego, nivel, precio): comparte nivel con las marcas */
  collection: (slug: string) => `/palas-padel/${slug}/`,
  guide: (slug: string) => `/guias/${slug}/`,
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
  /** Alertas de un correo, con el acceso que se le envía */
  myAlerts: "/mis-alertas/",
  /** Sugerencias del buscador de palas (JSON) */
  searchApi: "/api/palas/",
} as const;
