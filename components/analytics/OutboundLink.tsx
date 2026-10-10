"use client";

import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { OUTBOUND_REL } from "@/lib/outbound";
import { track } from "./track";

interface OutboundLinkProps {
  /** Destino real: la página del producto en la tienda */
  href: string;
  /** Slug de la tienda y de la pala, para medir el clic */
  store: string;
  pala: string;
  price: number;
  /** Puesto de la oferta en la lista, empezando en 1 */
  position?: number;
  /** Pantalla desde la que se sale: «ficha», «comparador»… */
  origin: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Enlace a una tienda. Es un enlace normal al producto, sin redirección
 * intermedia: el destino se ve al pasar el ratón. Solo añade el registro del
 * clic de salida, que no es una compra ni lleva datos de quien lo hace.
 */
export function OutboundLink({ href, store, pala, price, position, origin, className, children }: OutboundLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel={OUTBOUND_REL}
      className={className}
      onClick={() =>
        track(ANALYTICS_EVENTS.outboundClick, { tienda: store, pala, precio: price, posicion: position, origen: origin })
      }
    >
      {children}
    </a>
  );
}
