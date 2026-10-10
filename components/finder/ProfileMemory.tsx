"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { parseSavedProfile, PROFILE_STORAGE_KEY } from "@/lib/recommender";

// El perfil de jugador se recuerda en este navegador para no repetir el test: se
// guarda solo la dirección del resultado (las seis respuestas), sin ningún dato
// personal. Sin almacenamiento disponible, simplemente no se recuerda.

function read(): string | null {
  try {
    return parseSavedProfile(window.localStorage.getItem(PROFILE_STORAGE_KEY));
  } catch {
    return null;
  }
}

const subscribe = (listener: () => void) => {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
};

/** Guarda el perfil al ver un resultado del quiz. No pinta nada. */
export function RememberProfile({ path }: { path: string }) {
  useEffect(() => {
    try {
      const valid = parseSavedProfile(path);
      if (valid) window.localStorage.setItem(PROFILE_STORAGE_KEY, valid);
    } catch {
      // Sin almacenamiento, el perfil no se recuerda.
    }
  }, [path]);
  return null;
}

/** Acceso al último resultado del quiz, solo si este navegador tiene uno guardado. */
export function SavedProfileLink({ className }: { className?: string }) {
  const path = useSyncExternalStore(subscribe, read, () => null);
  if (!path) return null;

  return (
    <p className={cn("text-sm text-ink", className)}>
      Ya hiciste el test de Pala ideal.{" "}
      <Link href={path} className="font-bold underline">
        Ver las palas de tu perfil
      </Link>
    </p>
  );
}
