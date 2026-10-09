import type { Metadata } from "next";
import { createPostgresAlertRepository } from "@/alerts/repository";
import { MAX_SAVED_RESULTS } from "@/alerts/service";
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
  // Un enlace puede traer varias alertas: las de unos resultados guardados del quiz.
  const tokens = [raw ?? []].flat().slice(0, MAX_SAVED_RESULTS);
  const token = tokens[0] ?? "";
  const repository = dataSource === "database" ? createPostgresAlertRepository(getSql()) : null;
  const found = repository
    ? (await Promise.all(tokens.map((item) => repository.findByToken(item)))).filter((item) => item !== null)
    : [];

  // Varias alertas en un enlace: se confirman juntas las que sigan pendientes.
  if (found.length > 1) {
    const pending = found.filter((item) => item.status === "pending");
    const [first, ...others] = pending.length > 0 ? pending : found;
    return pending.length > 0 ? (
      <AlertTokenPage
        title="Confirma tus avisos"
        alert={first}
        others={others}
        action={{ label: "Confirmar los avisos", run: confirmAlertAction, token: pending.map((item) => item.token) }}
      >
        Solo falta este paso para activarlos. Te enviaremos un único correo por cada pala que baje de
        precio.
      </AlertTokenPage>
    ) : (
      <AlertTokenPage title="Tus avisos están confirmados" alert={first} others={others}>
        Comprobamos los precios en cada actualización y te escribiremos cuando alguna baje. Puedes
        darte de baja de cada aviso desde el enlace del correo.
      </AlertTokenPage>
    );
  }
  const [alert = null] = found;

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
