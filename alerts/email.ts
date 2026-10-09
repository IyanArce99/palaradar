// Correos de las alertas de precio y su envío por Resend.
//
// SEGURIDAD: RESEND_API_KEY es secreta y solo se lee en servidor (acciones de
// servidor y scripts). Nunca lleva el prefijo NEXT_PUBLIC_.
import { siteConfig } from "@/config/site";
import { formatEuro, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { Alert, DueAlert } from "./repository";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Dirección de baja en un clic, para la cabecera List-Unsubscribe */
  unsubscribeUrl: string;
}

export interface Mailer {
  send(email: Email): Promise<void>;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * true si está configurado el envío de correo: RESEND_API_KEY y ALERTS_FROM_EMAIL.
 * Sin él no se puede confirmar ni avisar una alerta, así que la web no las ofrece
 * (ver alerts/availability.ts). No dice nada del valor de la clave: solo que existe.
 */
export function isMailerConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return isResendConfigured(env) || usesConsoleMailer(env);
}

function isResendConfigured(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.ALERTS_FROM_EMAIL?.trim());
}

/**
 * Buzón de desarrollo: sin Resend configurado, en `next dev` (o con
 * ALERTS_MAILER=console fuera de Vercel) los correos se escriben en la terminal
 * en vez de enviarse. Sirve para ver y probar las alertas en local de principio
 * a fin. Nunca se usa en el despliegue: allí, sin Resend, las alertas no se ofrecen.
 */
export function usesConsoleMailer(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isResendConfigured(env) || env.VERCEL) return false;
  return env.NODE_ENV === "development" || env.ALERTS_MAILER === "console";
}

const LOCAL_BASE_URL = "http://localhost:3000";

function createConsoleMailer(env: NodeJS.ProcessEnv): Mailer {
  // Los enlaces del correo apuntan al dominio público: en local se abren en este servidor.
  const base = env.ALERTS_DEV_BASE_URL?.trim() || LOCAL_BASE_URL;
  return {
    async send(email) {
      console.info(
        [
          "",
          "──────── Correo de PalaRadar (no enviado: buzón de desarrollo) ────────",
          `Para: ${email.to}`,
          `Asunto: ${email.subject}`,
          "",
          email.text.replaceAll(siteConfig.url, base),
          "────────────────────────────────────────────────────────────────────────",
          "",
        ].join("\n"),
      );
    },
  };
}

/**
 * Envío por Resend, o null si falta la configuración: RESEND_API_KEY y
 * ALERTS_FROM_EMAIL (un remitente de un dominio verificado en Resend). En
 * desarrollo, sin Resend, devuelve el buzón de la terminal.
 */
export function createMailerFromEnv(env: NodeJS.ProcessEnv = process.env): Mailer | null {
  if (usesConsoleMailer(env)) return createConsoleMailer(env);

  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.ALERTS_FROM_EMAIL?.trim();
  if (!apiKey || !from) return null;

  return {
    async send(email) {
      const response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [email.to],
          subject: email.subject,
          text: email.text,
          html: email.html,
          headers: {
            "List-Unsubscribe": `<${email.unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`Resend: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
      }
    },
  };
}

const absolute = (path: string) => `${siteConfig.url}${path}`;

export function confirmUrl(token: string): string {
  return confirmAllUrl([token]);
}

/** Un solo enlace que confirma varias alertas a la vez (resultados guardados del quiz). */
export function confirmAllUrl(tokens: string[]): string {
  const params = new URLSearchParams(tokens.map((token) => ["token", token]));
  return absolute(`${routes.alertConfirm}?${params}`);
}

/** Página de baja: el enlace que ve la persona. */
export function unsubscribeUrl(token: string): string {
  return absolute(`${routes.alertCancel}?token=${encodeURIComponent(token)}`);
}

/** Baja en un clic para los programas de correo (cabecera List-Unsubscribe): acepta POST. */
export function oneClickUnsubscribeUrl(token: string): string {
  return absolute(`${routes.alertCancelApi}?token=${encodeURIComponent(token)}`);
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);

interface Layout {
  title: string;
  paragraphs: string[];
  action: { label: string; url: string };
  footer: string[];
  /** Enlace de baja; null en los correos que no son de una alerta concreta */
  unsubscribe: string | null;
}

/** Texto plano y HTML del mismo contenido. */
function render({ title, paragraphs, action, footer, unsubscribe }: Layout): Pick<Email, "text" | "html"> {
  const text = [
    title,
    ...paragraphs,
    `${action.label}: ${action.url}`,
    ...footer,
    ...(unsubscribe ? [`Darte de baja de esta alerta: ${unsubscribe}`] : []),
    `${siteConfig.name} · ${siteConfig.url}`,
  ].join("\n\n");

  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f4f5f1;font-family:Arial,Helvetica,sans-serif;color:#15171a">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;padding:28px">
<p style="margin:0 0 18px;font-size:18px;font-weight:900">${escapeHtml(siteConfig.name)}</p>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.2">${escapeHtml(title)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#3f443c">${escapeHtml(p)}</p>`).join("\n")}
<p style="margin:22px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#c6ef3a;color:#15171a;font-weight:800;text-decoration:none">${escapeHtml(action.label)}</a></p>
${footer.map((p) => `<p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:#5b6058">${escapeHtml(p)}</p>`).join("\n")}
${unsubscribe ? `<p style="margin:18px 0 0;font-size:13px;color:#5b6058"><a href="${escapeHtml(unsubscribe)}" style="color:#5b6058">Darte de baja de esta alerta</a></p>` : ""}
</div></body></html>`;

  return { text, html };
}

function racketName(alert: Alert): string {
  return `${alert.racket.name} ${alert.racket.year}`;
}

/** Correo de confirmación (doble opt-in): la alerta no se activa hasta pulsar el enlace. */
export function confirmationEmail(alert: Alert): Email {
  const name = racketName(alert);
  const wish =
    alert.targetPrice === null
      ? `Has pedido que te avisemos cuando la ${name} vuelva a estar a la venta en alguna de las tiendas que seguimos.`
      : `Has pedido que te avisemos cuando la ${name} baje a ${formatEuro(alert.targetPrice)} o menos en alguna de las tiendas que seguimos.`;

  return {
    to: alert.email,
    subject: `Confirma tu alerta de precio: ${name}`,
    unsubscribeUrl: oneClickUnsubscribeUrl(alert.token),
    ...render({
      title: "Confirma tu alerta de precio",
      paragraphs: [wish, "Para activarla, confirma que este correo es tuyo."],
      action: { label: "Confirmar la alerta", url: confirmUrl(alert.token) },
      footer: [
        "Si no la confirmas, no te enviaremos nada más. Si no has pedido esta alerta, puedes ignorar este correo.",
        `Usaremos tu correo solo para enviarte este aviso. Política de privacidad: ${absolute(routes.privacy)}`,
      ],
      unsubscribe: unsubscribeUrl(alert.token),
    }),
  };
}

/** Página «Mis alertas» con el acceso de ese correo. */
export function myAlertsUrl(accessToken: string): string {
  return absolute(`${routes.myAlerts}?acceso=${encodeURIComponent(accessToken)}`);
}

/** Enlace para ver y gestionar las alertas de un correo. Solo se envía a quien tiene alguna. */
export function accessEmail(email: string, accessToken: string, days: number): Email {
  const url = myAlertsUrl(accessToken);
  return {
    to: email,
    subject: "Tus alertas de precio en PalaRadar",
    // No es un correo periódico: la «baja» es la propia página, donde se quita cada alerta.
    unsubscribeUrl: url,
    ...render({
      title: "Tus alertas de precio",
      paragraphs: [
        "Has pedido ver tus alertas de precio. Desde este enlace puedes consultarlas y quitar las que ya no quieras.",
        `El enlace vale ${days} días. No lo reenvíes: quien lo tenga puede ver y quitar tus alertas.`,
      ],
      action: { label: "Ver mis alertas", url },
      footer: ["Si no has pedido este correo, puedes ignorarlo: nadie ha accedido a tus alertas."],
      unsubscribe: null,
    }),
  };
}

export interface SavedResult {
  alert: Alert;
  /** Mejor precio de la pala al guardar los resultados */
  price: number;
  /** Afinidad con las respuestas del quiz, de 0 a 100 */
  affinity: number;
}

/**
 * «Guarda tus resultados»: las palas recomendadas, el enlace para volver a verlas
 * y un único botón que activa el aviso de bajada de todas (doble opt-in).
 */
export function resultsEmail(email: string, resultsPath: string, items: SavedResult[]): Email {
  const [first] = items;
  const list = items.map(
    ({ alert, price, affinity }) =>
      `${racketName(alert)} · ${affinity} % de afinidad · hoy desde ${formatEuro(price)} · ${absolute(routes.pala(alert.racket.slug))}`,
  );

  return {
    to: email,
    subject: "Tus palas recomendadas en PalaRadar",
    unsubscribeUrl: oneClickUnsubscribeUrl(first.alert.token),
    ...render({
      title: "Tus resultados de «Pala ideal»",
      paragraphs: [
        "Estas son las palas que mejor encajan con tus respuestas:",
        ...list,
        `Puedes volver a ver el resultado completo aquí: ${absolute(resultsPath)}`,
        "Si quieres que te avisemos cuando alguna baje de precio, confírmalo con este botón. Sin confirmarlo no te enviaremos nada más.",
      ],
      action: { label: "Avisarme si bajan de precio", url: confirmAllUrl(items.map(({ alert }) => alert.token)) },
      footer: [
        "Recibirás un único correo por cada pala que baje, y nada más. Si no has pedido este correo, puedes ignorarlo.",
        `Usaremos tu correo solo para estos avisos. Política de privacidad: ${absolute(routes.privacy)}`,
        ...items.map(({ alert }) => `Dejar de vigilar la ${racketName(alert)}: ${unsubscribeUrl(alert.token)}`),
      ],
      unsubscribe: unsubscribeUrl(first.alert.token),
    }),
  };
}

/** Aviso: la pala ha alcanzado el precio objetivo (o vuelve a estar a la venta). */
export function notificationEmail(alert: DueAlert): Email {
  const name = racketName(alert);
  const price = formatEuro(alert.price);
  const stores = pluralize(alert.storeCount, "tienda", "tiendas");
  const reached =
    alert.targetPrice === null
      ? `La ${name} vuelve a estar a la venta: su mejor precio ahora es de ${price} en ${alert.storeName}.`
      : `La ${name} está ahora a ${price} en ${alert.storeName}. Pediste que te avisáramos cuando bajara a ${formatEuro(alert.targetPrice)} o menos.`;

  return {
    to: alert.email,
    subject:
      alert.targetPrice === null ? `La ${name} vuelve a estar a la venta` : `La ${name} ha bajado a ${price}`,
    unsubscribeUrl: oneClickUnsubscribeUrl(alert.token),
    ...render({
      title: alert.targetPrice === null ? "Tu pala vuelve a estar a la venta" : "Tu pala ha bajado de precio",
      paragraphs: [
        reached,
        `Lo hemos comprobado en ${stores}. Los precios cambian: confírmalo en la tienda antes de comprar. El envío puede no estar incluido.`,
      ],
      action: { label: "Ver los precios de hoy", url: absolute(`${routes.pala(alert.racket.slug)}#tiendas`) },
      footer: ["Esta alerta ya ha cumplido su función y queda cerrada: no recibirás más avisos por ella."],
      unsubscribe: unsubscribeUrl(alert.token),
    }),
  };
}
