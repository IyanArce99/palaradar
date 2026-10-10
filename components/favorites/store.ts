// Almacén de las palas favoritas en el navegador: un estado compartido mínimo
// sobre localStorage, sin contexto. Si el navegador no deja usar el
// almacenamiento (modo privado estricto, cookies bloqueadas), las favoritas
// viven en memoria mientras dure la página y la interfaz lo avisa.
import { useSyncExternalStore } from "react";
import { FAVORITES_STORAGE_KEY, parseFavorites, toggleFavorite, type FavoritePala } from "@/lib/favorites";

const EMPTY: FavoritePala[] = [];
const listeners = new Set<() => void>();
let favorites: FavoritePala[] | null = null;
let persistent = true;

function read(): FavoritePala[] {
  if (favorites === null) {
    try {
      favorites = parseFavorites(window.localStorage.getItem(FAVORITES_STORAGE_KEY));
    } catch {
      favorites = [];
      persistent = false;
    }
  }
  return favorites;
}

/**
 * Lo guardado ahora mismo, sin la copia en memoria: otra pestaña puede haber
 * cambiado las favoritas sin que esta se haya enterado (pestaña congelada), y
 * escribir sobre la copia vieja las perdería. Sin almacenamiento, la memoria es
 * lo único que hay y se conserva.
 */
function readFresh(): FavoritePala[] {
  if (persistent) favorites = null;
  return read();
}

function write(next: FavoritePala[]): void {
  favorites = next;
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    persistent = false;
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Otra pestaña ha cambiado las favoritas, o ha vaciado el almacenamiento (clave nula): se vuelven a leer.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== FAVORITES_STORAGE_KEY) return;
    favorites = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Las favoritas guardadas; vacío en el servidor y hasta que el navegador las lee. */
export function useFavorites(): FavoritePala[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** false si el navegador no permite guardar: las favoritas se perderán al cerrar la página. */
export function useFavoritesPersistent(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      read();
      return persistent;
    },
    () => true,
  );
}

export function toggleFavoritePala(pala: FavoritePala): void {
  write(toggleFavorite(readFresh(), pala));
}

export function removeFavoritePala(slug: string): void {
  write(readFresh().filter((item) => item.slug !== slug));
}
