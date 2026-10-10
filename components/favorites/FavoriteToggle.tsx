"use client";

import { track } from "@/components/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { isFavoritePala, localDay, MAX_FAVORITES } from "@/lib/favorites";
import { toggleFavoritePala, useFavorites } from "./store";

interface FavoriteToggleProps {
  pala: { slug: string; name: string; price: number | null };
  /** icon: botón redondo sobre la foto · button: botón con texto (ficha) */
  variant?: "icon" | "button";
  /** Pantalla desde la que se guarda, para la analítica */
  origin: string;
  className?: string;
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
    </svg>
  );
}

/** Guarda la pala como favorita o la quita. Se guarda en este navegador, sin cuenta. */
export function FavoriteToggle({ pala, variant = "icon", origin, className }: FavoriteToggleProps) {
  const favorites = useFavorites();
  const saved = isFavoritePala(favorites, pala.slug);
  const full = !saved && favorites.length >= MAX_FAVORITES;

  const onClick = () => {
    if (!saved) track(ANALYTICS_EVENTS.favoriteAdd, { pala: pala.slug, origen: origin });
    toggleFavoritePala({
      slug: pala.slug,
      name: pala.name,
      // Solo un precio real: uno nulo o no positivo se guarda como «sin precio».
      savedPrice: pala.price !== null && pala.price > 0 ? pala.price : null,
      savedAt: localDay(new Date()),
    });
  };

  const common = {
    type: "button" as const,
    "aria-pressed": saved,
    disabled: full,
    title: full ? `Ya tienes ${MAX_FAVORITES} favoritas: quita alguna para guardar otra` : undefined,
    onClick,
  };

  if (variant === "button") {
    return (
      <button
        {...common}
        className={cn(
          "inline-flex h-12 items-center justify-center gap-2 rounded-[14px] border-[1.5px] px-5 text-[15px] font-extrabold whitespace-nowrap",
          saved ? "border-carbon bg-carbon text-white" : "border-carbon bg-white text-carbon",
          full && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <Heart filled={saved} />
        {saved ? "Guardada" : "Guardar"}
        <span className="sr-only"> {pala.name} en favoritas</span>
      </button>
    );
  }

  return (
    <button
      {...common}
      className={cn(
        // La posición la pone quien lo usa: debe quedar por encima del enlace que cubre la tarjeta.
        "z-10 grid size-9 place-items-center rounded-full border",
        saved ? "border-carbon bg-carbon text-lime" : "border-line bg-white text-carbon hover:border-carbon",
        full && "cursor-not-allowed opacity-50 hover:border-line",
        className,
      )}
    >
      <Heart filled={saved} />
      <span className="sr-only">
        {saved ? "Quitar" : "Guardar"} {pala.name} {saved ? "de" : "en"} favoritas
      </span>
    </button>
  );
}
