import { ButtonLink, buttonClass } from "@/components/ui/Button";
import type { Alert } from "@/alerts/repository";
import { formatEuro } from "@/lib/format";
import { routes } from "@/lib/routes";

interface AlertTokenPageProps {
  title: string;
  /** Texto bajo el título */
  children: React.ReactNode;
  alert: Alert | null;
  /** Botón que ejecuta la acción (confirmar o dar de baja); sin él, solo se informa */
  action?: { label: string; run: (form: FormData) => Promise<void>; token: string };
}

/** Qué vigila una alerta, en una frase. */
export function alertWish(alert: Alert): string {
  const name = `${alert.racket.name} ${alert.racket.year}`;
  return alert.targetPrice === null
    ? `Aviso cuando la ${name} vuelva a estar a la venta.`
    : `Aviso cuando la ${name} baje a ${formatEuro(alert.targetPrice)} o menos.`;
}

/** Página a la que llevan los enlaces de los correos de alerta: confirmar o darse de baja. */
export function AlertTokenPage({ title, children, alert, action }: AlertTokenPageProps) {
  return (
    <div className="mx-auto max-w-[640px] px-5 py-12 lg:py-20">
      <h1 className="text-[32px] leading-none font-black tracking-[-0.035em] text-balance lg:text-[44px]">
        {title}
      </h1>
      <div className="mt-3 text-base leading-[1.6] text-pretty text-ink">{children}</div>

      {alert && (
        <p className="mt-5 rounded-[18px] bg-mist p-[18px] text-[15px] leading-normal text-ink">
          {alertWish(alert)}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2.5">
        {action && (
          <form action={action.run}>
            <input type="hidden" name="token" value={action.token} />
            <button type="submit" className={buttonClass({ size: "lg" })}>
              {action.label}
            </button>
          </form>
        )}
        {alert ? (
          <ButtonLink href={routes.pala(alert.racket.slug)} variant="outline" size="lg">
            Ver la pala
          </ButtonLink>
        ) : (
          <ButtonLink href={routes.catalog} variant="outline" size="lg">
            Ver todas las palas
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
