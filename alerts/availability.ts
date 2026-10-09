// ¿Se pueden ofrecer las alertas de precio? Solo si de verdad funcionan de
// principio a fin: hay base de datos donde guardarlas y envío de correo
// configurado para confirmarlas y avisar.
//
// Mientras no sea así, la web no enseña ningún botón ni formulario de alerta: no
// se lleva a nadie a un formulario que va a fallar. No hay que tocar código para
// activarlas: basta con configurar RESEND_API_KEY y ALERTS_FROM_EMAIL (.env.example)
// y volver a desplegar.
import { isMailerConfigured } from "./email";

export function resolveAlertsAvailable(dataSource: "database" | "mock", env: NodeJS.ProcessEnv = process.env): boolean {
  return dataSource === "database" && isMailerConfigured(env);
}
