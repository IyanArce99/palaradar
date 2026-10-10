import Script from "next/script";
import { resolveAnalyticsProvider } from "@/lib/analytics";
import { Pageviews } from "./Pageviews";

/** Dominio con el que el sitio está dado de alta en Plausible; sin él no se carga nada */
const DOMAIN = /^[a-z0-9.-]+\.[a-z]{2,}$/;

/**
 * Script del proveedor de analítica. Solo se carga con Plausible elegido
 * (NEXT_PUBLIC_ANALYTICS_PROVIDER=plausible) y su dominio configurado
 * (NEXT_PUBLIC_ANALYTICS_DOMAIN). Plausible no usa cookies ni identifica a
 * personas. Sin esa configuración, que es el estado por defecto, la web no
 * carga ningún script de terceros.
 *
 * Se usa la variante manual del script: no envía la página vista por su cuenta
 * (mandaría la dirección completa, con sus parámetros). La envía `Pageviews`,
 * solo con la ruta y nunca desde las páginas de alertas, que llevan un token en
 * la dirección. Antes de activarlo hay que comprobar en el panel de Plausible
 * que las direcciones llegan sin parámetros.
 */
export function AnalyticsScript() {
  const provider = resolveAnalyticsProvider(process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER);
  const domain = (process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN ?? "").trim().toLowerCase();
  if (provider === "console") return <Pageviews />;
  if (provider !== "plausible" || !DOMAIN.test(domain)) return null;

  return (
    <>
      <Script defer data-domain={domain} src="https://plausible.io/js/script.manual.js" strategy="afterInteractive" />
      <Pageviews />
    </>
  );
}
