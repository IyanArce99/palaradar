"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import { useFavorites } from "./store";

/** Acceso a las favoritas desde la cabecera, con el número de palas guardadas. */
export function FavoritesLink({ className }: { className?: string }) {
  const count = useFavorites().length;

  return (
    <Link
      href={routes.favorites}
      className={cn("relative grid size-11 flex-none place-items-center rounded-full bg-mist hover:bg-[#e6e8e1]", className)}
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
      </svg>
      <span className="sr-only">Mis palas favoritas{count > 0 ? ` (${count})` : ""}</span>
      {count > 0 && (
        <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-carbon px-1 text-xs font-extrabold text-white tabular-nums">
          {count}
        </span>
      )}
    </Link>
  );
}
