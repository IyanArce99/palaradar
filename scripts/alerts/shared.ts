import { createMailerFromEnv } from "@/alerts/email";
import { createPostgresAlertRepository } from "@/alerts/repository";
import { notifyDueAlerts, purgeOldAlerts } from "@/alerts/service";
import type { Sql } from "@/data/db/client";

/**
 * Envía los avisos pendientes y lo cuenta por consola. Nunca lanza: un problema
 * con las alertas no puede hacer fallar la ingestión de precios.
 */
export async function sendDueAlerts(sql: Sql): Promise<void> {
  try {
    const mailer = createMailerFromEnv();
    const repository = createPostgresAlertRepository(sql);
    const report = await notifyDueAlerts({ repository, mailer });

    if (report.due === 0) {
      console.log("Alertas de precio: ninguna que avisar.");
    } else if (!mailer) {
      console.error(
        `Alertas de precio: ${report.due} por avisar, pero el envío de correo no está configurado ` +
          "(faltan RESEND_API_KEY y ALERTS_FROM_EMAIL). Siguen activas.",
      );
    } else {
      console.log(`Alertas de precio: ${report.sent} avisos enviados, ${report.failed} fallidos de ${report.due}.`);
    }

    // Conservación: fuera las alertas cerradas hace tiempo y las que nadie confirmó.
    const purged = await purgeOldAlerts({ repository });
    if (purged > 0) console.log(`Alertas de precio: ${purged} antiguas borradas.`);
  } catch (error) {
    console.error("Alertas de precio: no se han podido comprobar:", error instanceof Error ? error.message : error);
  }
}
