// Enlaces de salida a las tiendas. Hoy el enlace es la URL del producto tal cual
// la publica la tienda. Cuando exista un acuerdo de afiliación, la tienda se da
// de alta en config/affiliates.ts con los parámetros que haya facilitado y este
// es el único sitio que los añade: el destino sigue siendo la página del
// producto, a la vista, sin redirecciones intermedias.
import { affiliatePrograms, type AffiliateProgram } from "@/config/affiliates";

/** rel de todo enlace a tienda: comercial, sin traspasar autoridad y sin acceso a la ventana de origen */
export const OUTBOUND_REL = "noopener nofollow sponsored";

export interface OutboundLink {
  href: string;
  /** true si el enlace lleva los parámetros de un programa de afiliación */
  affiliated: boolean;
}

function isHttpUrl(url: URL): boolean {
  return url.protocol === "https:" || url.protocol === "http:";
}

/**
 * Enlace de salida de una oferta. null si la URL no es válida: antes que un
 * enlace roto, la interfaz enseña «Sin enlace».
 */
export function outboundLink(
  productUrl: string | null,
  storeSlug: string,
  programs: Record<string, AffiliateProgram> = affiliatePrograms,
): OutboundLink | null {
  if (!productUrl) return null;
  let url: URL;
  try {
    url = new URL(productUrl);
  } catch {
    return null;
  }
  if (!isHttpUrl(url)) return null;

  const program = programs[storeSlug];
  if (!program) return { href: url.toString(), affiliated: false };

  // Los parámetros del programa no pisan los que ya traiga la URL del producto.
  for (const [key, value] of Object.entries(program.params)) {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  return { href: url.toString(), affiliated: true };
}
