import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeading } from "@/components/ui/PageHeading";
import { getMethodology } from "@/data/reports";
import { REPORTS } from "@/lib/reports";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

// Los informes se calculan con los precios del día.
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Informes con los datos de PalaRadar",
  description:
    "Informes calculados con los precios y las características de las palas que sigue PalaRadar: diferencias entre tiendas, ediciones anteriores, cobertura y presupuesto.",
  path: routes.reports,
  // Si estos informes se indexan lo decide el propietario al lanzar; hasta entonces, fuera del índice.
  index: false,
});

export default async function ReportsPage() {
  const method = await getMethodology();

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Informes", href: routes.reports },
        ]}
      />
      <div className="mx-auto max-w-[1280px] pb-10 lg:pb-[72px]">
        <PageHeading
          title="Informes"
          lead="Cálculos hechos con los datos que tenemos hoy, con su método a la vista. No son estudios de mercado: describen las tiendas que seguimos."
        />
        <ul className="grid gap-3 px-5 pt-6 lg:grid-cols-2 lg:gap-5 lg:px-12 lg:pt-10">
          {REPORTS.map((report) => (
            <li key={report.slug} className="group relative rounded-3xl border border-line p-5 hover:border-carbon lg:p-6">
              <h2 className="text-xl leading-[1.1] font-black tracking-[-0.02em]">
                <Link href={routes.report(report.slug)} className="after:absolute after:inset-0 group-hover:underline">
                  {report.title}
                </Link>
              </h2>
              <p className="mt-2 text-base leading-normal text-ink">{report.lead}</p>
            </li>
          ))}
        </ul>

        <section aria-labelledby="de-donde" className="mx-5 mt-10 rounded-3xl bg-mist p-5 lg:mx-12 lg:p-7">
          <h2 id="de-donde" className="text-xl font-black tracking-[-0.02em]">
            De dónde salen los datos
          </h2>
          <dl className="mt-3 grid gap-3 text-base leading-normal lg:grid-cols-2 lg:gap-x-10">
            <div>
              <dt className="font-extrabold">Tiendas</dt>
              <dd className="text-ink">{method.stores}</dd>
            </div>
            <div>
              <dt className="font-extrabold">Periodo</dt>
              <dd className="text-ink">{method.period}</dd>
            </div>
          </dl>
          <p className="mt-3 text-base leading-normal text-ink">{method.scope}</p>
        </section>
      </div>
    </>
  );
}
