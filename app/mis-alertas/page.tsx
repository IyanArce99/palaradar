import type { Metadata } from "next";
import Link from "next/link";
import { accessSecret, readAccessToken } from "@/alerts/access";
import { createPostgresAlertRepository, type Alert } from "@/alerts/repository";
import { AccessLinkForm } from "@/components/alerts/AccessLinkForm";
import { ButtonLink } from "@/components/ui/Button";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { alertsAvailable, dataSource, getPalaSummaries } from "@/data";
import { getSql } from "@/data/db/client";
import { formatEuro, formatEuroCompact } from "@/lib/format";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import type { PalaSummary } from "@/types/catalog";
import { removeOwnAlertAction } from "../alertas/actions";

export const metadata: Metadata = pageMetadata({
  title: "Mis alertas de precio",
  description: "Consulta y gestiona tus alertas de precio de palas de pádel.",
  path: routes.myAlerts,
  index: false,
});

interface MyAlertsPageProps {
  searchParams: Promise<{ acceso?: string | string[] }>;
}

const H1 = "text-[34px] leading-none font-black tracking-[-0.035em] lg:text-[48px]";

/** Radar en reposo del estado vacío del diseño. */
function EmptyRadar() {
  return (
    <div aria-hidden="true" className="relative mx-auto size-[140px] rounded-full border border-[#d6d9d0]">
      <div className="absolute inset-[15%] rounded-full border border-[#d6d9d0]" />
      <div className="absolute inset-[30%] rounded-full border border-[#d6d9d0]" />
      <div className="absolute top-1/2 left-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-carbon bg-lime" />
    </div>
  );
}

/** Sin acceso: qué son las alertas y, si se pueden enviar correos, cómo ver las tuyas. */
function EmptyState({ expired, canRequest }: { expired: boolean; canRequest: boolean }) {
  return (
    <div className="mx-auto max-w-[520px] px-5 pt-4 pb-12 lg:pt-10 lg:pb-20">
      <h1 className={H1}>Mis alertas</h1>
      <div className="mt-12 lg:mt-14">
        <EmptyRadar />
      </div>
      <h2 className="mt-8 text-center text-2xl leading-[1.1] font-black tracking-[-0.02em] text-balance">
        {expired ? "Este enlace ya no es válido" : "Todavía no sigues ninguna pala"}
      </h2>
      <p className="mt-3 text-center text-base leading-[1.55] text-pretty text-ink">
        {expired
          ? "Los enlaces de acceso caducan a los pocos días. Pide uno nuevo con tu correo."
          : "Cuando veas una pala que te interese, pulsa «Avísame cuando baje» y te escribiremos en cuanto encontremos un precio mejor."}
      </p>
      <ButtonLink href={routes.catalog} variant="dark" size="lg" className="mt-6 w-full">
        Explorar palas
      </ButtonLink>

      {canRequest && (
        <section aria-labelledby="ya-tengo" className="mt-10 border-t border-line pt-8">
          <h2 id="ya-tengo" className="text-lg font-black">
            ¿Ya tienes alertas?
          </h2>
          <p className="mt-1.5 mb-3.5 text-[15px] leading-normal text-ink">
            Escribe tu correo y te enviamos un enlace para verlas y quitar las que no quieras. Sin
            cuenta ni contraseña.
          </p>
          <AccessLinkForm />
        </section>
      )}
    </div>
  );
}

function RemoveButton({ alert }: { alert: Alert }) {
  return (
    <form action={removeOwnAlertAction}>
      <input type="hidden" name="token" value={alert.token} />
      <button
        type="submit"
        className="flex h-11 items-center rounded-full bg-mist px-3.5 text-[13px] font-bold hover:bg-line-soft"
      >
        Quitar<span className="sr-only"> la alerta de la {alert.racket.name}</span>
      </button>
    </form>
  );
}

/** Una alerta: avisada («¡Ha bajado!»), activa o pendiente de confirmar. */
function AlertCard({ alert, pala }: { alert: Alert; pala: PalaSummary | undefined }) {
  const price = pala?.price ?? null;
  const name = `${alert.racket.name} ${alert.racket.year}`;
  const photo = (
    <PalaPhoto src={pala?.image ?? null} alt="" sizes="72px" className="h-[84px] w-[68px] flex-none rounded-xl" />
  );
  const title = (
    <h2 className="text-[17px] leading-[1.15] font-extrabold">
      <Link href={routes.pala(alert.racket.slug)} className="hover:underline">
        {name}
      </Link>
    </h2>
  );

  if (alert.status === "notified") {
    return (
      <article className="rounded-[20px] border-2 border-lime-border bg-lime-tint p-4">
        <p className="text-sm font-extrabold text-forest">▼ ¡Ha bajado!</p>
        <div className="mt-2.5 flex items-center gap-3.5">
          {photo}
          <div className="min-w-0">
            {title}
            <p className="mt-1 text-sm leading-[1.45] text-ink">
              {price !== null && (
                <>
                  Está a <strong className="whitespace-nowrap">{formatEuro(price)}</strong>.{" "}
                </>
              )}
              {alert.targetPrice !== null && <>Querías bajar de {formatEuroCompact(alert.targetPrice)}.</>}
            </p>
          </div>
        </div>
        <ButtonLink href={`${routes.pala(alert.racket.slug)}#tiendas`} variant="dark" size="lg" className="mt-3.5 w-full">
          Ver precios
        </ButtonLink>
      </article>
    );
  }

  return (
    <article className="flex items-center gap-3.5 rounded-[20px] border border-line p-4">
      {photo}
      <div className="min-w-0 flex-1">
        {title}
        <p className="mt-1 text-sm leading-[1.45] text-ink">
          {alert.status === "pending" ? (
            "Pendiente de confirmar: revisa tu correo y pulsa el enlace."
          ) : alert.targetPrice === null ? (
            "Te avisamos cuando vuelva a estar a la venta."
          ) : (
            <>
              Te avisamos si baja de{" "}
              <strong className="whitespace-nowrap">{formatEuroCompact(alert.targetPrice)}</strong>.
            </>
          )}
          {price !== null && (
            <>
              {" "}
              Ahora está a <span className="whitespace-nowrap">{formatEuro(price)}</span>.
            </>
          )}
        </p>
      </div>
      <RemoveButton alert={alert} />
    </article>
  );
}

// «Mis alertas» sin cuentas: se entra con el enlace firmado que se envía al
// correo (alerts/access.ts). Sin enlace, la página explica las alertas y, si se
// pueden enviar correos, permite pedirlo.
export default async function MyAlertsPage({ searchParams }: MyAlertsPageProps) {
  const { acceso: raw } = await searchParams;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const secret = accessSecret();
  const canRequest = alertsAvailable() && secret !== null;

  const email = token && secret ? readAccessToken(token, new Date(), secret) : null;
  if (!email || dataSource !== "database") {
    return <EmptyState expired={token !== ""} canRequest={canRequest} />;
  }

  const alerts = await createPostgresAlertRepository(getSql()).listByEmail(email);
  const palas = await getPalaSummaries([...new Set(alerts.map((alert) => alert.racket.slug))]);
  const bySlug = new Map(palas.map((pala) => [pala.slug, pala]));

  return (
    <div className="mx-auto max-w-[640px] px-5 pt-4 pb-12 lg:pt-10 lg:pb-20">
      <h1 className={H1}>Mis alertas</h1>
      <p className="mt-2.5 text-base leading-[1.55] text-pretty text-ink">
        Te escribimos cuando una pala baja del precio que tú elijas. Estas son las de{" "}
        <strong className="break-all">{email}</strong>.
      </p>

      {alerts.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-3">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <AlertCard alert={alert} pala={bySlug.get(alert.racket.slug)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-[18px] bg-mist p-[18px] text-[15px] leading-normal text-ink">
          Ahora mismo no tienes ninguna alerta. Puedes crear una desde la ficha de cualquier pala.
        </p>
      )}

      <ButtonLink href={routes.catalog} variant="outline" size="lg" className="mt-4 w-full">
        Crear una alerta nueva
      </ButtonLink>
    </div>
  );
}
