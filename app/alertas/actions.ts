"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { accessSecret } from "@/alerts/access";
import { createMailerFromEnv } from "@/alerts/email";
import { createPostgresAlertRepository } from "@/alerts/repository";
import {
  cancelAlert,
  confirmAlert,
  createAlert,
  MAX_SAVED_RESULTS,
  requestAccessLink,
  saveResults,
  type AccessLinkResult,
  type AlertResult,
  type SaveResultsResult,
} from "@/alerts/service";
import { dataSource, getPalaBySlug, recommendPalas } from "@/data";
import { getSql } from "@/data/db/client";
import { palaName } from "@/lib/pala-content";
import { finderPath, isComplete, parseFinderAnswers, toPrefs } from "@/lib/recommender";
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

export type SaveResultsFormState = SaveResultsResult | { status: "idle" };

/**
 * «Guarda tus resultados» del quiz: vuelve a calcular las recomendaciones con las
 * respuestas del formulario (no se fía de precios ni palas que lleguen del
 * navegador), las envía por correo y deja un aviso de bajada sin confirmar por pala.
 */
export async function saveResultsAction(_previous: SaveResultsFormState, form: FormData): Promise<SaveResultsFormState> {
  if (dataSource !== "database") return { status: "unavailable" };

  const answers = parseFinderAnswers(Object.fromEntries(new URLSearchParams(String(form.get("answers") ?? ""))));
  if (!isComplete(answers)) return { status: "unavailable" };

  try {
    const results = await recommendPalas(toPrefs(answers), MAX_SAVED_RESULTS);
    return await saveResults(
      {
        items: results.flatMap(({ pala, affinity }) =>
          pala.price === null
            ? []
            : [
                {
                  racket: { id: pala.id, slug: pala.slug, name: `${pala.brand.name} ${pala.model}`, year: pala.year },
                  currentPrice: pala.price,
                  affinity,
                },
              ],
        ),
        resultsPath: finderPath(answers),
        email: String(form.get("email") ?? ""),
        consent: form.get("consent") === "on",
        honeypot: String(form.get("website") ?? ""),
        ip: await clientIp(),
      },
      { repository: createPostgresAlertRepository(getSql()), mailer: createMailerFromEnv() },
    );
  } catch (error) {
    console.error("Alertas: error al guardar los resultados:", error instanceof Error ? error.message : error);
    return { status: "unavailable" };
  }
}

/** Confirma las alertas del enlace del correo: una, o varias si vienen de unos resultados guardados. */
export async function confirmAlertAction(form: FormData): Promise<void> {
  const repository = createPostgresAlertRepository(getSql());
  for (const token of form.getAll("token").map(String).slice(0, MAX_SAVED_RESULTS)) {
    await confirmAlert(token, { repository });
  }
  revalidatePath(routes.alertConfirm);
}

export type AccessLinkFormState = AccessLinkResult | { status: "idle" };

/** «Mis alertas»: pide el enlace de acceso para un correo. */
export async function requestAccessLinkAction(_previous: AccessLinkFormState, form: FormData): Promise<AccessLinkFormState> {
  if (dataSource !== "database") return { status: "unavailable" };
  // Campo trampa: un bot recibe la misma respuesta que una persona.
  if (String(form.get("website") ?? "").trim() !== "") return { status: "sent" };

  try {
    return await requestAccessLink(String(form.get("email") ?? ""), {
      repository: createPostgresAlertRepository(getSql()),
      mailer: createMailerFromEnv(),
      secret: accessSecret(),
    });
  } catch (error) {
    console.error("Alertas: error al pedir el enlace de acceso:", error instanceof Error ? error.message : error);
    return { status: "unavailable" };
  }
}

/** Quita una alerta desde «Mis alertas». El token de la alerta es lo que autoriza, como en el enlace de baja. */
export async function removeOwnAlertAction(form: FormData): Promise<void> {
  await cancelAlert(tokenOf(form), { repository: createPostgresAlertRepository(getSql()) });
  revalidatePath(routes.myAlerts);
}

function tokenOf(form: FormData): string {
  return String(form.get("token") ?? "");
}

/** Da de baja una alerta desde la página del enlace del correo. */
export async function cancelAlertAction(form: FormData): Promise<void> {
  await cancelAlert(tokenOf(form), { repository: createPostgresAlertRepository(getSql()) });
  revalidatePath(routes.alertCancel);
}
