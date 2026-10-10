// Eventos de producto: qué se mide y con qué datos. Esta capa no envía nada por
// sí misma: define los eventos, limpia sus datos y los entrega al proveedor
// configurado (components/analytics/track.ts). Sin proveedor, no sale ningún
// dato del navegador.
//
// Reglas:
//   · nunca viajan correos, tokens ni texto libre largo: cada evento tiene una
//     lista cerrada de propiedades y cualquier otra se descarta;
//   · un clic de salida a una tienda es eso, un clic: no es una compra;
//   · no se usan cookies ni identificadores de persona.

export const ANALYTICS_EVENTS = {
  search: "busqueda",
  filter: "filtro",
  viewPala: "ficha_vista",
  compareStart: "comparacion_iniciada",
  compareAdd: "comparador_pala_anadida",
  compareView: "comparacion_vista",
  alternativeMode: "alternativa_consultada",
  favoriteAdd: "favorito_anadido",
  alertCreate: "alerta_creada",
  storePriceView: "precio_tienda_consultado",
  outboundClick: "clic_tienda",
  viewGuide: "guia_vista",
  quizComplete: "quiz_completado",
  shareComparison: "comparacion_compartida",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

type Props = Record<string, string | number | boolean>;

/** Propiedades que admite cada evento. Lo que no esté aquí no se envía. */
export const EVENT_PROPS: Record<AnalyticsEvent, readonly string[]> = {
  busqueda: ["termino", "resultados"],
  filtro: ["filtro", "valor", "resultados"],
  ficha_vista: ["pala", "marca", "con_precio"],
  comparacion_iniciada: ["origen"],
  comparador_pala_anadida: ["pala", "origen"],
  comparacion_vista: ["palas", "numero"],
  alternativa_consultada: ["pala", "modo"],
  favorito_anadido: ["pala", "origen"],
  alerta_creada: ["pala", "origen"],
  precio_tienda_consultado: ["pala"],
  clic_tienda: ["pala", "tienda", "precio", "posicion", "origen"],
  guia_vista: ["guia"],
  quiz_completado: ["nivel", "estilo", "presupuesto", "resultados"],
  comparacion_compartida: ["palas", "numero", "metodo"],
};

const MAX_TEXT = 80;
/** «palas» lleva hasta tres slugs separados por comas (una comparación): no se corta a medias */
const MAX_TEXT_BY_PROP: Record<string, number> = { palas: 240 };

/**
 * Páginas cuya dirección lleva un token (confirmar o cancelar una alerta, «Mis
 * alertas»): desde ellas no se envía ningún dato a la analítica, ni siquiera la
 * página vista.
 */
const PRIVATE_PREFIXES = ["/alertas/", "/mis-alertas/", "/api/"];

export function isPrivatePath(pathname: string): boolean {
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return PRIVATE_PREFIXES.some((prefix) => path.startsWith(prefix));
}
/** Cadenas largas de letras y números sin espacios: tienen pinta de token o identificador */
const TOKEN = /[A-Za-z0-9_]{32,}/;

/**
 * true si un texto puede contener un dato personal o un secreto y no debe
 * enviarse. Cualquier texto con una arroba se trata como un correo: ningún dato
 * que se mide la necesita.
 */
export function looksSensitive(text: string): boolean {
  return text.includes("@") || TOKEN.test(text);
}

/**
 * Deja de un evento solo sus propiedades admitidas, recorta los textos y descarta
 * cualquier valor con pinta de correo o de token.
 */
export function sanitizeEvent(event: AnalyticsEvent, props: Record<string, unknown> = {}): Props {
  const allowed = EVENT_PROPS[event];
  const clean: Props = {};
  for (const key of allowed) {
    const value = props[key];
    if (typeof value === "boolean") clean[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) clean[key] = value;
    else if (typeof value === "string" && value.trim() !== "" && !looksSensitive(value)) {
      clean[key] = value.trim().slice(0, MAX_TEXT_BY_PROP[key] ?? MAX_TEXT);
    }
  }
  return clean;
}

export type AnalyticsProviderId = "none" | "console" | "plausible";

/**
 * Proveedor configurado. Sin NEXT_PUBLIC_ANALYTICS_PROVIDER no hay analítica;
 * «console» solo escribe los eventos en la consola del navegador (desarrollo) y
 * «plausible» los entrega al script de Plausible si está cargado en la página.
 */
export function resolveAnalyticsProvider(value: string | undefined): AnalyticsProviderId {
  const id = (value ?? "").trim().toLowerCase();
  return id === "console" || id === "plausible" ? id : "none";
}
