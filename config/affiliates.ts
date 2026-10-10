// Programas de afiliación por tienda (slug de `stores`). Está vacío a propósito:
// no hay ningún acuerdo firmado y no se inventan códigos. Para activar uno, se
// añade aquí la tienda con los parámetros exactos que facilite su programa; los
// enlaces de salida los incorporan solos (lib/outbound.ts).
//
//   padelnuestro: { params: { utm_source: "palaradar", ref: "<código del programa>" } },

export interface AffiliateProgram {
  /** Parámetros que el programa pide añadir a la URL del producto */
  params: Record<string, string>;
}

export const affiliatePrograms: Record<string, AffiliateProgram> = {};
