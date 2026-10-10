// Entrega de eventos al proveedor de analítica configurado. Sin
// NEXT_PUBLIC_ANALYTICS_PROVIDER no hace nada: ningún dato sale del navegador.
// Nunca lanza: un fallo de la analítica no puede romper la interfaz.
import { isPrivatePath, resolveAnalyticsProvider, sanitizeEvent, type AnalyticsEvent } from "@/lib/analytics";

const provider = resolveAnalyticsProvider(process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER);

type PlausibleOptions = { props?: Record<string, string | number | boolean>; u?: string };
type Plausible = ((event: string, options?: PlausibleOptions) => void) & { q?: unknown[] };
type PlausibleWindow = Window & { plausible?: Plausible };

/**
 * La función de Plausible o, si su script aún no ha cargado, la cola en la que
 * este deja los eventos pendientes. Sin ella, los eventos lanzados al abrir la
 * página (antes de que cargue el script) se perderían.
 */
function plausible(): Plausible {
  const target = window as PlausibleWindow;
  target.plausible ??= Object.assign(
    (...args: unknown[]) => {
      const queue = (target.plausible as Plausible).q ?? [];
      queue.push(args);
      (target.plausible as Plausible).q = queue;
    },
    {},
  ) as Plausible;
  return target.plausible;
}

export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  if (provider === "none" || typeof window === "undefined") return;
  try {
    // Desde una página con un token en la dirección no se envía nada.
    if (isPrivatePath(window.location.pathname)) return;
    const clean = sanitizeEvent(event, props);
    if (provider === "console") console.info("[analítica]", event, clean);
    // La dirección se envía sin parámetros: pueden llevar una búsqueda o un token.
    else plausible()(event, { props: clean, u: `${window.location.origin}${window.location.pathname}` });
  } catch {
    // La analítica es accesoria.
  }
}

/**
 * Página vista. Se envía a mano (el script se carga en su variante manual) para
 * mandar solo la ruta, sin parámetros, y para no enviar nada desde las páginas
 * de alertas, cuya dirección lleva un token.
 */
export function trackPageview(pathname: string): void {
  if (provider === "none" || typeof window === "undefined" || isPrivatePath(pathname)) return;
  try {
    if (provider === "console") console.info("[analítica]", "pageview", pathname);
    else plausible()("pageview", { u: `${window.location.origin}${pathname}` });
  } catch {
    // La analítica es accesoria.
  }
}
