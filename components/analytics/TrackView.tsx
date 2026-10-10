"use client";

import { useEffect } from "react";
import type { AnalyticsEvent } from "@/lib/analytics";
import { track } from "./track";

// Un evento de vista se cuenta una vez por carga de página, aunque React monte
// el componente dos veces (modo estricto) o lo vuelva a pintar.
const sent = new Set<string>();

interface TrackViewProps {
  event: AnalyticsEvent;
  props?: Record<string, string | number | boolean>;
}

/** Registra un evento al mostrarse la página. No pinta nada. */
export function TrackView({ event, props }: TrackViewProps) {
  const key = `${event}:${JSON.stringify(props ?? {})}`;

  useEffect(() => {
    const id = `${window.location.pathname}${window.location.search}:${key}`;
    if (sent.has(id)) return;
    sent.add(id);
    track(event, props);
    // `props` es un literal nuevo en cada render: la clave ya recoge su contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, key]);

  return null;
}
