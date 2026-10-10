"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackPageview } from "./track";

/** Registra cada página vista con su ruta, sin parámetros. No pinta nada. */
export function Pageviews() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageview(pathname);
  }, [pathname]);

  return null;
}
