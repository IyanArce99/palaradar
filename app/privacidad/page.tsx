import type { Metadata } from "next";
import Link from "next/link";
import { CLOSED_RETENTION_DAYS, UNCONFIRMED_RETENTION_DAYS } from "@/alerts/service";
import { siteConfig } from "@/config/site";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Política de privacidad",
  description: `Qué datos guarda ${siteConfig.name} cuando creas una alerta de precio, para qué los usa, cuánto tiempo y cómo darte de baja.`,
  path: routes.privacy,
  index: false,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-[22px] leading-tight font-black tracking-[-0.02em] lg:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 text-base leading-[1.6] text-pretty text-ink">{children}</div>
    </section>
  );
}

// Cuenta lo que hace el código de las alertas (`alerts/`): si cambia lo que se
// guarda, los plazos o los proveedores, hay que cambiar esta página.
export default function PrivacyPage() {
  const { name, contactEmail } = siteConfig;

  return (
    <div className="mx-auto max-w-[720px] px-5 py-12 lg:py-20">
      <h1 className="text-[32px] leading-none font-black tracking-[-0.035em] text-balance lg:text-[44px]">
        Política de privacidad
      </h1>
      <p className="mt-4 text-base leading-[1.6] text-pretty text-ink">
        {name} no tiene cuentas de usuario. El único dato personal que guardamos es el correo que
        nos dejas al crear una alerta de precio. Esta web no usa cookies de seguimiento ni
        herramientas de analítica.
      </p>

      <Section title="Qué datos recogemos">
        <p>Cuando creas una alerta de precio guardamos:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Tu dirección de correo electrónico.</li>
          <li>La pala que quieres vigilar y el precio que has elegido.</li>
          <li>La fecha y la hora en que aceptaste recibir el aviso.</li>
          <li>
            Una huella de tu dirección IP: un resumen calculado con una clave, no la dirección.
            No guardamos la dirección IP.
          </li>
        </ul>
        <p>No pedimos nombre, teléfono ni ningún otro dato.</p>
      </Section>

      <Section title="Para qué usamos tu correo">
        <p>
          Solo para esa alerta: un correo para que confirmes que la dirección es tuya y otro cuando
          la pala alcanza el precio que pediste o vuelve a estar a la venta. No enviamos boletines
          ni publicidad, y no usamos tu correo para nada más.
        </p>
        <p>
          La huella de la dirección IP solo sirve para limitar cuántas alertas se pueden crear en
          poco tiempo y evitar abusos.
        </p>
      </Section>

      <Section title="Consentimiento">
        <p>
          Tratamos tu correo porque nos das permiso al marcar la casilla del formulario de la
          alerta. La alerta no se activa hasta que pulsas el enlace del correo de confirmación: si
          no lo pulsas, no te enviamos nada más.
        </p>
      </Section>

      <Section title="Cuánto tiempo los conservamos">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Mientras la alerta esté activa, hasta que se cumpla o te des de baja.</li>
          <li>
            Si no confirmas la alerta, la borramos a los {UNCONFIRMED_RETENTION_DAYS} días de
            crearla.
          </li>
          <li>
            Cuando la alerta se cumple o te das de baja, la borramos a los {CLOSED_RETENTION_DAYS}{" "}
            días.
          </li>
        </ul>
        <p>El borrado se hace junto con la actualización de precios, así que puede tardar unos días más.</p>
      </Section>

      <Section title="Cómo darte de baja">
        <p>
          Todos nuestros correos llevan un enlace para darte de baja de la alerta. Al usarlo dejamos
          de vigilar ese precio y no recibes más correos por ella. No necesitas cuenta ni
          contraseña.
        </p>
        <p>
          Puedes retirar tu permiso en cualquier momento. También tienes derecho a pedir que te
          digamos qué datos tuyos guardamos, que los corrijamos o que los borremos, y a reclamar
          ante la autoridad de protección de datos (en España, la Agencia Española de Protección de
          Datos).
        </p>
      </Section>

      <Section title="Quién más interviene">
        <p>No vendemos ni cedemos tu correo. Para que la alerta funcione usamos dos proveedores:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Resend</strong>, que envía los correos: recibe tu dirección y el contenido de
            cada correo.
          </li>
          <li>
            <strong>Supabase</strong>, donde está alojada la base de datos en la que se guardan las
            alertas.
          </li>
        </ul>
        <p>
          Los enlaces a las tiendas te llevan a sus webs, que tienen sus propias políticas de
          privacidad.
        </p>
      </Section>

      <Section title="Contacto">
        {contactEmail ? (
          <p>
            Para cualquier cuestión sobre tus datos, escríbenos a{" "}
            <a href={`mailto:${contactEmail}`} className="font-bold underline">
              {contactEmail}
            </a>
            .
          </p>
        ) : (
          <p>
            La forma directa de retirar tu correo es el enlace de baja que llevan todos nuestros
            correos.
          </p>
        )}
        <p>
          Puedes crear una alerta desde la ficha de cualquier pala del{" "}
          <Link href={routes.catalog} className="font-bold underline">
            catálogo
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
