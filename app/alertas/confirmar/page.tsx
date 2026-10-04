import type { Metadata } from "next";
import { createPostgresAlertRepository } from "@/alerts/repository";
import { AlertTokenPage } from "@/components/alerts/AlertTokenPage";
import { dataSource } from "@/data";
import { getSql } from "@/data/db/client";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import { confirmAlertAction } from "../actions";

export const metadata: Metadata = pageMetadata({
  title: "Confirmar alerta de precio",
  description: "Confirma tu correo para activar la alerta de precio.",
  path: routes.alertConfirm,
  index: false,
});

interface ConfirmPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

// Destino del enlace del correo de confirmación. Abrir el enlace no confirma
// nada por sí solo (los programas de correo abren enlaces para revisarlos): la
// alerta se activa al pulsar el botón.
export default async function ConfirmAlertPage({ searchParams }: ConfirmPageProps) {
  const { token: raw } = await searchParams;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const alert =
    token && dataSource === "database"
      ? await createPostgresAlertRepository(getSql()).findByToken(token)
      : null;

  if (!alert) {
    return (
      <AlertTokenPage title="No encontramos esta alerta" alert={null}>
        El enlace no es válido o la alerta ya no existe. Puedes crear una nueva desde la ficha de
        cualquier pala.
      </AlertTokenPage>
    );
  }

  if (alert.status === "pending") {
    return (
      <AlertTokenPage
        title="Confirma tu alerta"
        alert={alert}
        action={{ label: "Confirmar la alerta", run: confirmAlertAction, token }}
      >
        Solo falta este paso para activarla. Te enviaremos un único correo cuando se cumpla.
      </AlertTokenPage>
    );
  }

  if (alert.status === "active") {
    return (
      <AlertTokenPage title="Tu alerta está activa" alert={alert}>
        Comprobamos los precios en cada actualización y te escribiremos cuando se cumpla. Puedes
        darte de baja cuando quieras desde el enlace del correo.
      </AlertTokenPage>
    );
  }

  return (
    <AlertTokenPage title="Esta alerta ya está cerrada" alert={alert}>
      {alert.status === "notified"
        ? "Ya te enviamos el aviso de esta alerta. Si quieres seguir vigilando el precio, crea otra desde la ficha de la pala."
        : "Te diste de baja de esta alerta. Si quieres, puedes crear otra desde la ficha de la pala."}
    </AlertTokenPage>
  );
}
