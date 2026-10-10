"use client";

import { useState } from "react";
import { track } from "@/components/analytics/track";
import type { AnalyticsEvent } from "@/lib/analytics";
import { cn } from "@/lib/cn";

interface CopyLinkButtonProps {
  /** Ruta de la página que se comparte; se le antepone el dominio en el que está el visitante */
  path: string;
  /** Título para el menú de compartir del sistema, donde lo hay */
  title: string;
  label?: string;
  /** Evento que se registra al compartir, con sus datos */
  event?: { name: AnalyticsEvent; props: Record<string, string | number | boolean> };
  className?: string;
}

type Status = "idle" | "copied" | "error";

/**
 * Comparte la página: en móvil abre el menú de compartir del sistema y, donde no
 * lo hay, copia el enlace. El enlace es la dirección pública de la página, sin
 * ningún dato de quien la comparte.
 */
export function CopyLinkButton({ path, title, label = "Compartir", event, className }: CopyLinkButtonProps) {
  const [status, setStatus] = useState<Status>("idle");

  const share = async () => {
    const url = new URL(path, window.location.origin).toString();
    const done = (method: string, next: Status) => {
      if (event && next !== "error") track(event.name, { ...event.props, metodo: method });
      setStatus(next);
      if (next !== "idle") window.setTimeout(() => setStatus("idle"), 4000);
    };

    // El menú del sistema solo en pantallas táctiles: en escritorio copiar es más directo.
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, url });
        return done("sistema", "idle");
      } catch (error) {
        // Cerrar el menú no es un error; cualquier otro fallo cae a copiar.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      done("copiar", "copied");
    } catch {
      done("copiar", "error");
    }
  };

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <button
        type="button"
        onClick={share}
        className="inline-flex h-11 items-center gap-2 rounded-2xl border-[1.5px] border-carbon bg-white px-3.5 text-sm font-bold whitespace-nowrap text-carbon"
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
          <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
        </svg>
        {label}
      </button>
      <span aria-live="polite" className="text-sm font-bold">
        {status === "copied" && <span className="text-forest">Enlace copiado</span>}
        {status === "error" && (
          <span className="text-ink">No se ha podido copiar: copia la dirección de la barra del navegador.</span>
        )}
      </span>
    </span>
  );
}
