"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { buttonClass } from "@/components/ui/Button";
import { compareSetPath, MAX_COMPARED } from "@/lib/compare";
import { favoritePriceChange, SLUGS_PARAM, type FavoritePala } from "@/lib/favorites";
import { formatDate, formatEuro, formatEuroCompact, formatPercent } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { PalaSuggestion } from "@/types/catalog";
import { removeFavoritePala, useFavorites, useFavoritesPersistent } from "./store";

type Status = "loading" | "ready" | "error";

/** Precios actuales de las favoritas, por slug. */
function useCurrentData(slugs: string[]): { status: Status; bySlug: Map<string, PalaSuggestion> } {
  const key = slugs.join(",");
  const [state, setState] = useState<{ key: string; status: Status; items: PalaSuggestion[] }>({
    key: "",
    status: "loading",
    items: [],
  });

  useEffect(() => {
    if (key === "") return;
    const controller = new AbortController();
    fetch(`${routes.searchApi}?${SLUGS_PARAM}=${encodeURIComponent(key)}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<PalaSuggestion[]>) : Promise.reject(new Error("respuesta no válida"))))
      .then((items) => setState({ key, status: "ready", items }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, status: "error", items: [] });
      });
    return () => controller.abort();
  }, [key]);

  // Mientras llega la respuesta de la lista actual, se sigue enseñando lo último que se sabía.
  const status = state.key === key ? state.status : "loading";
  return { status, bySlug: new Map(state.items.map((item) => [item.slug, item])) };
}

function PriceLine({ favorite, current, status }: { favorite: FavoritePala; current: PalaSuggestion | undefined; status: Status }) {
  if (status === "loading") return <p className="text-sm text-muted">Comprobando el precio…</p>;
  if (status === "error") return <p className="text-sm text-muted">No hemos podido comprobar el precio ahora.</p>;
  if (!current) return <p className="text-sm text-muted">Esta pala ya no está en el catálogo.</p>;
  if (current.price === null) return <p className="text-sm text-muted">Sin precio disponible ahora</p>;

  const change = favoritePriceChange(favorite.savedPrice, current.price);
  return (
    <>
      <p className="text-lg font-black whitespace-nowrap tabular-nums">{formatEuro(current.price)}</p>
      {change ? (
        <p className={change.difference < 0 ? "text-sm font-bold text-forest" : "text-sm text-muted"}>
          {change.difference < 0 ? "Ha bajado" : "Ha subido"} {formatEuroCompact(Math.abs(change.difference))} (
          {formatPercent(Math.abs(change.percent))}) desde que la guardaste
        </p>
      ) : (
        favorite.savedPrice !== null && <p className="text-sm text-muted">Mismo precio que cuando la guardaste</p>
      )}
    </>
  );
}

/** Las palas guardadas en este navegador, con su precio de hoy y lo que ha cambiado. */
export function FavoritesList() {
  const favorites = useFavorites();
  const persistent = useFavoritesPersistent();
  const { status, bySlug } = useCurrentData(favorites.map((item) => item.slug));

  if (favorites.length === 0) {
    return (
      <div className="rounded-3xl border border-line p-6 lg:p-8">
        <h2 className="text-xl font-black tracking-[-0.02em]">Todavía no has guardado ninguna pala</h2>
        <p className="mt-2 max-w-[560px] text-base leading-normal text-ink">
          Pulsa el corazón de cualquier pala para guardarla aquí. Se guardan en este navegador, sin cuenta ni correo, y
          cada vez que vuelvas verás su precio de ese día.
        </p>
        <Link href={routes.catalog} className={buttonClass({ className: "mt-5" })}>
          Ver el catálogo
        </Link>
      </div>
    );
  }

  // De una pala que ya se conoce se sigue enseñando su precio mientras se recarga la lista;
  // solo las que aún no han llegado aparecen como «comprobando».
  const rowStatus = (slug: string): Status => (bySlug.has(slug) ? "ready" : status);
  // Solo se comparan palas que siguen en el catálogo: una que ya no existe daría un 404.
  const comparable = favorites
    .filter((item) => bySlug.has(item.slug))
    .slice(0, MAX_COMPARED)
    .map((item) => item.slug);
  const dropped = favorites.filter((item) => {
    const change = favoritePriceChange(item.savedPrice, bySlug.get(item.slug)?.price ?? null);
    return change !== null && change.difference < 0;
  }).length;

  return (
    <div>
      {!persistent && (
        <p role="status" className="mb-4 rounded-2xl bg-mist px-4 py-3 text-sm leading-normal text-ink">
          Tu navegador no nos deja guardar datos, así que estas favoritas se perderán al cerrar la página.
        </p>
      )}
      <p aria-live="polite" className="text-sm text-muted">
        {favorites.length === 1 ? "1 pala guardada" : `${favorites.length} palas guardadas`}
        {status === "ready" && dropped > 0 && ` · ${dropped === 1 ? "1 ha bajado" : `${dropped} han bajado`} de precio`}
      </p>

      <ul className="mt-4 grid gap-3 lg:grid-cols-2 lg:gap-4">
        {favorites.map((favorite) => {
          const current = bySlug.get(favorite.slug);
          return (
            <li key={favorite.slug} className="flex gap-4 rounded-3xl border border-line p-4 lg:p-4">
              <PalaPhoto
                src={current?.image ?? null}
                alt=""
                sizes="110px"
                className="h-[110px] w-[92px] flex-none rounded-2xl"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                {/* Una pala que ya no está en el catálogo no tiene ficha a la que enlazar. */}
                {status === "ready" && !current ? (
                  <p className="text-base leading-snug font-extrabold">{favorite.name}</p>
                ) : (
                  <Link href={routes.pala(favorite.slug)} className="text-base leading-snug font-extrabold underline-offset-2 hover:underline">
                    {favorite.name}
                  </Link>
                )}
                <p className="text-xs text-muted">Guardada el {formatDate(favorite.savedAt)}</p>
                <div className="mt-1.5">
                  <PriceLine favorite={favorite} current={current} status={rowStatus(favorite.slug)} />
                </div>
                <button
                  type="button"
                  onClick={() => removeFavoritePala(favorite.slug)}
                  className="mt-auto flex min-h-11 items-center self-start text-sm font-bold underline"
                >
                  Quitar<span className="sr-only"> {favorite.name} de favoritas</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {comparable.length >= 2 && (
        <Link href={compareSetPath(comparable)} className={buttonClass({ variant: "outline", className: "mt-6" })}>
          {comparable.length === favorites.length ? `Comparar las ${comparable.length}` : `Comparar las ${comparable.length} primeras`}
        </Link>
      )}
    </div>
  );
}
