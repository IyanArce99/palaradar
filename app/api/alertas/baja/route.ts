import { NextResponse, type NextRequest } from "next/server";
import { createPostgresAlertRepository } from "@/alerts/repository";
import { cancelAlert } from "@/alerts/service";
import { dataSource } from "@/data";
import { getSql } from "@/data/db/client";
import { routes } from "@/lib/routes";

/**
 * Baja en un clic (cabecera List-Unsubscribe de los correos): el programa de
 * correo envía un POST con el token de la alerta. Siempre responde igual, exista
 * o no la alerta.
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (token && dataSource === "database") {
    await cancelAlert(token, { repository: createPostgresAlertRepository(getSql()) });
  }
  return new NextResponse(null, { status: 200, headers: { "X-Robots-Tag": "noindex" } });
}

/** Quien abre la dirección en el navegador va a la página de baja. */
export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  return NextResponse.redirect(new URL(`${routes.alertCancel}?token=${encodeURIComponent(token)}`, request.url));
}
