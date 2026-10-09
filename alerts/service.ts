// Alertas de precio: crear (con doble confirmación), confirmar, dar de baja y
// avisar cuando una pala alcanza el precio pedido. Sin cuentas de usuario: el
// enlace con su token es lo único que identifica cada alerta.
import { createHmac, randomBytes } from "node:crypto";
import { pricingConfig } from "@/config/pricing";
import { ACCESS_LINK_DAYS, createAccessToken } from "./access";
import {
  accessEmail,
  confirmationEmail,
  notificationEmail,
  resultsEmail,
  type Mailer,
  type SavedResult,
} from "./email";
import type { Alert, AlertRacket, AlertRepository } from "./repository";

const HOUR_MS = 3_600_000;
/** Alertas nuevas por correo y por conexión en una hora */
export const MAX_PER_EMAIL = 5;
export const MAX_PER_IP = 10;
/** Tiempo mínimo entre dos correos de confirmación de la misma alerta */
const RESEND_AFTER_MS = 5 * 60_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAIL_LENGTH = 254;

/** Paso del selector de precio y descuento que se propone de entrada */
const PRICE_STEP = 5;
const SUGGESTED_DISCOUNT = 0.08;

/** Precio objetivo que se propone: algo por debajo del actual, redondeado a 5 €. */
export function suggestedTarget(currentPrice: number): number {
  const target = Math.floor((currentPrice * (1 - SUGGESTED_DISCOUNT)) / PRICE_STEP) * PRICE_STEP;
  return Math.max(PRICE_STEP, Math.min(target, maxTarget(currentPrice)));
}

/** El objetivo más alto que tiene sentido: el múltiplo de 5 € justo por debajo del precio actual. */
export function maxTarget(currentPrice: number): number {
  return Math.max(PRICE_STEP, Math.ceil(currentPrice / PRICE_STEP) * PRICE_STEP - PRICE_STEP);
}

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL.test(email) ? email : null;
}

/** Huella de la IP, con clave: sirve para limitar abusos sin guardar la IP. */
export function hashIp(ip: string | null, secret = process.env.ALERTS_SECRET ?? "palaradar-alertas"): string | null {
  return ip ? createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32) : null;
}

export interface AlertRequest {
  racket: AlertRacket;
  /** Mejor precio vigente de la pala; null si ahora no tiene */
  currentPrice: number | null;
  email: string;
  /** Precio objetivo tal y como llega del formulario */
  targetPrice: string;
  consent: boolean;
  /** Campo trampa: una persona lo deja vacío */
  honeypot: string;
  ip: string | null;
}

export type AlertResult =
  /** Correo de confirmación enviado (o petición descartada sin dar pistas) */
  | { status: "pending" }
  /** Ya había una alerta activa de ese correo para esa pala */
  | { status: "exists" }
  | { status: "invalid"; field: "email" | "targetPrice" | "consent"; message: string }
  | { status: "rate-limited" }
  /** No se puede enviar correo ahora (sin configurar o fallo del proveedor) */
  | { status: "unavailable" };

interface Deps {
  repository: AlertRepository;
  /** null si el envío de correo no está configurado */
  mailer: Mailer | null;
  now?: () => Date;
}

/** Precio objetivo válido para esa pala, o el motivo por el que no lo es. */
function parseTarget(raw: string, currentPrice: number | null): number | null | { error: string } {
  // Sin precio actual no hay umbral que fijar: la alerta es de disponibilidad.
  if (currentPrice === null) return null;

  const target = Math.round(Number(raw.replace(",", ".")) * 100) / 100;
  if (!Number.isFinite(target) || target <= 0) return { error: "Indica un precio objetivo." };
  if (target >= currentPrice) return { error: "Elige un precio por debajo del actual." };
  return target;
}

/** Crea una alerta sin confirmar y envía el correo de confirmación. */
export async function createAlert(request: AlertRequest, { repository, mailer, now = () => new Date() }: Deps): Promise<AlertResult> {
  // Un bot que rellena el campo trampa recibe la misma respuesta que una persona.
  if (request.honeypot.trim() !== "") return { status: "pending" };

  const email = normalizeEmail(request.email);
  if (!email) return { status: "invalid", field: "email", message: "Escribe un correo válido." };
  if (!request.consent) {
    return { status: "invalid", field: "consent", message: "Necesitamos tu permiso para enviarte el aviso." };
  }
  const target = parseTarget(request.targetPrice, request.currentPrice);
  if (target !== null && typeof target === "object") {
    return { status: "invalid", field: "targetPrice", message: target.error };
  }
  if (!mailer) return { status: "unavailable" };

  const at = now();
  const existing = await repository.findOpen(request.racket.id, email);
  if (existing?.status === "active") return { status: "exists" };

  let alert: Alert;
  if (existing) {
    // Pendiente de confirmar: se actualiza el precio y, si ha pasado un rato, se reenvía el correo.
    await repository.updateTarget(existing.id, target);
    const lastSent = existing.confirmationSentAt ? Date.parse(existing.confirmationSentAt) : 0;
    if (at.getTime() - lastSent < RESEND_AFTER_MS) return { status: "pending" };
    alert = { ...existing, targetPrice: target };
  } else {
    const since = new Date(at.getTime() - HOUR_MS).toISOString();
    const ipHash = hashIp(request.ip);
    const [byEmail, byIp] = await Promise.all([
      repository.countRecent({ email }, since),
      ipHash ? repository.countRecent({ ipHash }, since) : 0,
    ]);
    if (byEmail >= MAX_PER_EMAIL || byIp >= MAX_PER_IP) return { status: "rate-limited" };

    alert = await repository.create({
      racketId: request.racket.id,
      email,
      targetPrice: target,
      token: randomBytes(24).toString("base64url"),
      consentAt: at.toISOString(),
      ipHash,
    });
  }

  try {
    await mailer.send(confirmationEmail(alert));
  } catch (error) {
    console.error("Alertas: no se pudo enviar el correo de confirmación:", error instanceof Error ? error.message : error);
    // Sin correo no hay forma de confirmarla: no se deja una alerta huérfana.
    if (!existing) await repository.remove(alert.id);
    return { status: "unavailable" };
  }
  await repository.markConfirmationSent(alert.id, at.toISOString());
  return { status: "pending" };
}

/** Palas que se guardan como mucho con «Guarda tus resultados»: caben en el límite por correo */
export const MAX_SAVED_RESULTS = 4;

/** Objetivo de «avísame si baja»: cualquier precio por debajo del de hoy. */
export function anyDropTarget(currentPrice: number): number {
  return Math.round((currentPrice - 0.01) * 100) / 100;
}

export interface SaveResultsRequest {
  /** Palas recomendadas, la mejor primero, con su precio vigente y su afinidad */
  items: { racket: AlertRacket; currentPrice: number; affinity: number }[];
  /** Ruta del resultado (con las respuestas), para volver a verlo desde el correo */
  resultsPath: string;
  email: string;
  consent: boolean;
  honeypot: string;
  ip: string | null;
}

export type SaveResultsResult =
  | { status: "pending" }
  /** Ese correo ya vigila todas estas palas */
  | { status: "exists" }
  | { status: "invalid"; field: "email" | "consent"; message: string }
  | { status: "rate-limited" }
  | { status: "unavailable" };

/**
 * «Guarda tus resultados»: envía las palas recomendadas por correo y deja, sin
 * confirmar, un aviso de bajada para cada una. Un solo enlace del correo los
 * activa todos; sin pulsarlo no se envía nada más y se borran a los pocos días.
 */
export async function saveResults(
  request: SaveResultsRequest,
  { repository, mailer, now = () => new Date() }: Deps,
): Promise<SaveResultsResult> {
  if (request.honeypot.trim() !== "") return { status: "pending" };

  const email = normalizeEmail(request.email);
  if (!email) return { status: "invalid", field: "email", message: "Escribe un correo válido." };
  if (!request.consent) {
    return { status: "invalid", field: "consent", message: "Necesitamos tu permiso para enviarte el correo." };
  }
  const items = request.items.slice(0, MAX_SAVED_RESULTS);
  if (!mailer || items.length === 0) return { status: "unavailable" };

  const at = now();
  const since = new Date(at.getTime() - HOUR_MS).toISOString();
  const ipHash = hashIp(request.ip);
  const [byEmail, byIp] = await Promise.all([
    repository.countRecent({ email }, since),
    ipHash ? repository.countRecent({ ipHash }, since) : 0,
  ]);
  if (byEmail >= MAX_PER_EMAIL || byIp >= MAX_PER_IP) return { status: "rate-limited" };

  // Una alerta por pala; las que ese correo ya tiene activas no se tocan.
  const created: Alert[] = [];
  const saved: SavedResult[] = [];
  for (const item of items) {
    const target = anyDropTarget(item.currentPrice);
    const existing = await repository.findOpen(item.racket.id, email);
    if (existing?.status === "active") continue;

    let alert = existing;
    if (alert) {
      await repository.updateTarget(alert.id, target);
      alert = { ...alert, targetPrice: target };
    } else {
      alert = await repository.create({
        racketId: item.racket.id,
        email,
        targetPrice: target,
        token: randomBytes(24).toString("base64url"),
        consentAt: at.toISOString(),
        ipHash,
      });
      created.push(alert);
    }
    saved.push({ alert, price: item.currentPrice, affinity: item.affinity });
  }
  if (saved.length === 0) return { status: "exists" };

  try {
    await mailer.send(resultsEmail(email, request.resultsPath, saved));
  } catch (error) {
    console.error("Alertas: no se pudo enviar el correo de resultados:", error instanceof Error ? error.message : error);
    // Sin correo no hay forma de confirmarlas: no se dejan alertas huérfanas.
    await Promise.all(created.map((alert) => repository.remove(alert.id)));
    return { status: "unavailable" };
  }
  await Promise.all(saved.map(({ alert }) => repository.markConfirmationSent(alert.id, at.toISOString())));
  return { status: "pending" };
}

/** Tiempo mínimo entre dos enlaces de acceso al mismo correo */
const ACCESS_LINK_EVERY_MS = 5 * 60_000;
const lastAccessLink = new Map<string, number>();

export type AccessLinkResult =
  /** Si ese correo tiene alertas, se le ha enviado el enlace. No se dice si las tiene. */
  | { status: "sent" }
  | { status: "invalid"; message: string }
  | { status: "unavailable" };

/**
 * «Mis alertas»: envía al correo un enlace firmado para ver y gestionar sus
 * alertas. La respuesta es la misma tenga o no alertas, para no revelar a nadie
 * qué correos están apuntados; solo se envía si las tiene, y no más de una vez
 * cada pocos minutos.
 */
export async function requestAccessLink(
  rawEmail: string,
  { repository, mailer, secret, now = () => new Date() }: Deps & { secret: string | null },
): Promise<AccessLinkResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { status: "invalid", message: "Escribe un correo válido." };
  if (!mailer || !secret) return { status: "unavailable" };

  const at = now();
  const last = lastAccessLink.get(email) ?? 0;
  if (at.getTime() - last < ACCESS_LINK_EVERY_MS) return { status: "sent" };
  if ((await repository.listByEmail(email)).length === 0) return { status: "sent" };

  try {
    await mailer.send(accessEmail(email, createAccessToken(email, at, secret), ACCESS_LINK_DAYS));
    lastAccessLink.set(email, at.getTime());
  } catch (error) {
    console.error("Alertas: no se pudo enviar el enlace de acceso:", error instanceof Error ? error.message : error);
    return { status: "unavailable" };
  }
  return { status: "sent" };
}

export type TokenResult =
  | { status: "not-found" }
  /** `changed`: false si ya estaba en ese estado */
  | { status: "ok"; alert: Alert; changed: boolean }
  /** La alerta ya no admite esa acción (avisada o dada de baja) */
  | { status: "closed"; alert: Alert };

/** Confirma el correo de una alerta: pasa a estar activa. */
export async function confirmAlert(token: string, { repository, now = () => new Date() }: Pick<Deps, "repository" | "now">): Promise<TokenResult> {
  const alert = await repository.findByToken(token);
  if (!alert) return { status: "not-found" };
  if (alert.status === "active") return { status: "ok", alert, changed: false };
  if (alert.status !== "pending") return { status: "closed", alert };

  await repository.confirm(alert.id, now().toISOString());
  return { status: "ok", alert: { ...alert, status: "active" }, changed: true };
}

/** Da de baja una alerta: deja de vigilarse y no se envía nada más. */
export async function cancelAlert(token: string, { repository, now = () => new Date() }: Pick<Deps, "repository" | "now">): Promise<TokenResult> {
  const alert = await repository.findByToken(token);
  if (!alert) return { status: "not-found" };
  if (alert.status === "cancelled") return { status: "ok", alert, changed: false };
  if (alert.status === "notified") return { status: "closed", alert };

  await repository.cancel(alert.id, now().toISOString());
  return { status: "ok", alert: { ...alert, status: "cancelled" }, changed: true };
}

const DAY_MS = 24 * HOUR_MS;
/** Días que se conserva una alerta ya cerrada (avisada o dada de baja) antes de borrarla */
export const CLOSED_RETENTION_DAYS = 30;
/** Días que se conserva una alerta que nunca se confirmó */
export const UNCONFIRMED_RETENTION_DAYS = 7;

/**
 * Borra las alertas que ya no hacen falta, según los plazos que cuenta la
 * política de privacidad. Devuelve cuántas se han borrado.
 */
export async function purgeOldAlerts({ repository, now = () => new Date() }: Pick<Deps, "repository" | "now">): Promise<number> {
  const at = now().getTime();
  return repository.purge(
    new Date(at - CLOSED_RETENTION_DAYS * DAY_MS).toISOString(),
    new Date(at - UNCONFIRMED_RETENTION_DAYS * DAY_MS).toISOString(),
  );
}

export interface NotifyReport {
  /** Alertas cuya condición se cumple */
  due: number;
  sent: number;
  failed: number;
}

/**
 * Tras una ingestión de precios: avisa a las alertas activas cuya pala ha
 * alcanzado el precio pedido. Cada alerta avisa una sola vez; si un envío falla,
 * la alerta sigue activa y se reintenta en la siguiente ingestión.
 */
export async function notifyDueAlerts({ repository, mailer, now = () => new Date() }: Deps): Promise<NotifyReport> {
  const at = now();
  // Solo cuentan los precios que la web todavía presenta como vigentes.
  const staleBefore = new Date(at.getTime() - pricingConfig.staleAfterHours * HOUR_MS).toISOString();
  const due = await repository.listDue(staleBefore);
  const report: NotifyReport = { due: due.length, sent: 0, failed: 0 };
  if (!mailer) return { ...report, failed: due.length };

  for (const alert of due) {
    try {
      await mailer.send(notificationEmail(alert));
      await repository.markNotified(alert.id, at.toISOString(), alert.price);
      report.sent++;
    } catch (error) {
      console.error(`Alertas: fallo al avisar la alerta ${alert.id}:`, error instanceof Error ? error.message : error);
      report.failed++;
    }
  }
  return report;
}
