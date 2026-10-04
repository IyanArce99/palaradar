import type { Metadata } from "next";
import { createPostgresAlertRepository } from "@/alerts/repository";
import { AlertTokenPage } from "@/components/alerts/AlertTokenPage";
import { dataSource } from "@/data";
import { getSql } from "@/data/db/client";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import { cancelAlertAction } from "../actions";

export const metadata: Metadata = pageMetadata({
  title: "Darse de baja de una alerta de precio",
  description: "Cancela tu alerta de precio.",
  path: routes.alertCancel,
  index: false,
});

interface CancelPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

// Destino del enlace «Darte de baja» de los correos de alerta.
export default async function CancelAlertPage({ searchParams }: CancelPageProps) {
  const { token: raw } = await searchParams;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const alert =
    token && dataSource === "database"
      ? await createPostgresAlertRepository(getSql()).findByToken(token)
      : null;

  if (!alert) {
    return (
      <AlertTokenPage title="No encontramos esta alerta" alert={null}>
        El enlace no es válido o la alerta ya no existe: no te enviaremos ningún correo por ella.
      </AlertTokenPage>
    );
  }

  if (alert.status === "pending" || alert.status === "active") {
    return (
      <AlertTokenPage
        title="¿Quieres darte de baja?"
        alert={alert}
        action={{ label: "Darme de baja", run: cancelAlertAction, token }}
      >
        Dejaremos de vigilar este precio y no te enviaremos más correos por esta alerta.
      </AlertTokenPage>
    );
  }

  return (
    <AlertTokenPage title="Ya no recibirás más avisos" alert={alert}>
      {alert.status === "cancelled"
        ? "Te has dado de baja de esta alerta."
        : "Esta alerta ya se cerró al enviarte el aviso: no hay nada más que cancelar."}
    </AlertTokenPage>
  );
}
