// Acceso a «Mis alertas» sin cuentas de usuario: un enlace firmado que se envía
// al correo. Quien tiene el enlace ve y gestiona las alertas de ese correo
// durante unos días; no hay contraseñas ni sesiones.
//
// La firma necesita ALERTS_SECRET. Sin él no hay enlaces (una clave por defecto
// permitiría falsificarlos), salvo en el buzón de desarrollo, que usa una fija.
import { createHmac, timingSafeEqual } from "node:crypto";
import { usesConsoleMailer } from "./email";

const DAY_MS = 86_400_000;
/** Días que vale un enlace de acceso */
export const ACCESS_LINK_DAYS = 7;
const DEV_SECRET = "palaradar-solo-desarrollo";

/** Clave con la que se firman los enlaces, o null si no se pueden ofrecer. */
export function accessSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = env.ALERTS_SECRET?.trim();
  if (secret) return secret;
  return usesConsoleMailer(env) ? DEV_SECRET : null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Token de acceso para ese correo: correo, caducidad y firma. */
export function createAccessToken(email: string, now: Date, secret: string): string {
  const payload = `${Buffer.from(email).toString("base64url")}.${now.getTime() + ACCESS_LINK_DAYS * DAY_MS}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** El correo de un token válido y sin caducar, o null. */
export function readAccessToken(token: string, now: Date, secret: string): string | null {
  const [encoded, expires, signature, ...rest] = token.split(".");
  if (!encoded || !expires || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(`${encoded}.${expires}`, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!/^\d+$/.test(expires) || Number(expires) < now.getTime()) return null;

  return Buffer.from(encoded, "base64url").toString();
}
