"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createMailerFromEnv } from "@/alerts/email";
import { createPostgresAlertRepository } from "@/alerts/repository";
import { cancelAlert, confirmAlert, createAlert, type AlertResult } from "@/alerts/service";
import { dataSource, getPalaBySlug } from "@/data";
import { getSql } from "@/data/db/client";
import { palaName } from "@/lib/pala-content";
import { routes } from "@/lib/routes";

export type AlertFormState = AlertResult | { status: "idle" };

/** IP de quien hace la petición, según el proxy. Solo se usa, cifrada, para limitar abusos. */
async function clientIp(): Promise<string | null> {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || null;
}

/** Crea una alerta de precio desde el formulario de la ficha. */
export async function createAlertAction(_previous: AlertFormState, form: FormData): Promise<AlertFormState> {
  // Las alertas viven en la base de datos: con los datos de prueba en memoria no existen.
  if (dataSource !== "database") return { status: "unavailable" };

  const pala = await getPalaBySlug(String(form.get("slug") ?? ""));
  if (!pala) return { status: "unavailable" };

  try {
    return await createAlert(
      {
        racket: { id: pala.id, slug: pala.slug, name: palaName(pala), year: pala.year },
        // Solo un precio vigente sirve de referencia para fijar un objetivo.
        currentPrice: pala.price && pala.price.freshness !== "stale" ? pala.price.current : null,
        email: String(form.get("email") ?? ""),
        targetPrice: String(form.get("targetPrice") ?? ""),
        consent: form.get("consent") === "on",
        honeypot: String(form.get("website") ?? ""),
        ip: await clientIp(),
      },
      { repository: createPostgresAlertRepository(getSql()), mailer: createMailerFromEnv() },
    );
  } catch (error) {
    console.error("Alertas: error al crear la alerta:", error instanceof Error ? error.message : error);
    return { status: "unavailable" };
  }
}

function tokenOf(form: FormData): string {
  return String(form.get("token") ?? "");
}

/** Confirma una alerta desde la página del enlace del correo. */
export async function confirmAlertAction(form: FormData): Promise<void> {
  await confirmAlert(tokenOf(form), { repository: createPostgresAlertRepository(getSql()) });
  revalidatePath(routes.alertConfirm);
}

/** Da de baja una alerta desde la página del enlace del correo. */
export async function cancelAlertAction(form: FormData): Promise<void> {
  await cancelAlert(tokenOf(form), { repository: createPostgresAlertRepository(getSql()) });
  revalidatePath(routes.alertCancel);
}
