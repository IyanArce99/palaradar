import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeading } from "@/components/ui/PageHeading";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import {
  getBudgetReport,
  getCoverageReport,
  getMethodology,
  getSeasonOpportunities,
  getSpreadReport,
} from "@/data/reports";
import { listingHref } from "@/lib/catalog/collections";
import { catalogHref } from "@/lib/catalog/query";
import { comparePath } from "@/lib/compare";
import { SEASON_RELATION } from "@/lib/data-confidence";
import { formatEuro, formatEuroCompact, formatTimeAgo, pluralize } from "@/lib/format";
import { SHAPE_LABELS } from "@/lib/labels";
import { palaAlt } from "@/lib/media";
import { getReport, REPORTS, spreadSummary, type Methodology, type ReportDefinition } from "@/lib/reports";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import { NEGLIGIBLE_SPREAD_EUROS, spreadAmount } from "@/lib/store-spread";

// Los informes se calculan con los precios del día.
export const revalidate = 3600;

/** Filas que se enseñan de un informe largo; el resto se resume en una frase */
const MAX_ROWS = 40;

interface ReportPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return REPORTS.map((report) => ({ slug: report.slug }));
}

export async function generateMetadata({ params }: ReportPageProps): Promise<Metadata> {
  const report = getReport((await params).slug);
  if (!report) return {};
  return pageMetadata({
    title: report.title,
    description: report.description,
    path: routes.report(report.slug),
    // Si estos informes se indexan lo decide el propietario al lanzar; hasta entonces, fuera del índice.
    index: false,
  });
}

const H2 = "text-2xl leading-[1.1] font-black tracking-[-0.025em] lg:text-3xl";
const TABLE = "w-full min-w-[560px] border-collapse text-left text-sm";
/** Tablas de columnas cortas (cifras): en móvil caben enteras, sin scroll lateral escondido. */
const TABLE_NARROW = "w-full border-collapse text-left text-sm md:min-w-[560px]";
const TH ="border-b border-line py-2.5 pr-4 text-sm font-bold text-muted";
const TD = "border-b border-line-soft py-2.5 pr-4 align-top";
const NUM = "tabular-nums whitespace-nowrap";
const percentText = (value: number) => `${String(Math.abs(value)).replace(".", ",")} %`;

function Summary({ sentences }: { sentences: string[] }) {
  return (
    <ul className="mt-4 flex flex-col gap-1.5 text-base leading-normal text-ink lg:max-w-[820px]">
      {sentences.map((sentence) => (
        <li key={sentence}>{sentence}</li>
      ))}
    </ul>
  );
}

function PalaCell({ pala }: { pala: { slug: string; brand: { name: string }; model: string; year: number; image: string | null } }) {
  return (
    <div className="flex items-center gap-3">
      <PalaPhoto src={pala.image} alt="" sizes="48px" className="size-12 flex-none rounded-lg" />
      <Link href={routes.pala(pala.slug)} className="font-bold underline-offset-2 hover:underline">
        {pala.brand.name} {pala.model} <span className="font-normal text-muted">{pala.year}</span>
      </Link>
    </div>
  );
}

async function SpreadSection() {
  const report = await getSpreadReport();
  const now = new Date().toISOString();
  const rows = report.rows.filter((row) => row.spread.difference >= NEGLIGIBLE_SPREAD_EUROS);
  const shown = rows.slice(0, MAX_ROWS);
  // La comprobación más antigua de las filas que se enseñan (fechas ISO: se ordenan como texto).
  const oldestCheck = shown.map((row) => row.spread.oldestCheck).sort((a, b) => a.localeCompare(b))[0] ?? now;

  return (
    <>
      <Summary sentences={spreadSummary(report)} />
      {rows.length > 0 && (
        <section aria-labelledby="tabla" className="mt-8">
          <h2 id="tabla" className={H2}>
            Las mayores diferencias de hoy
          </h2>
          {/* Una sola nota para toda la tabla: repetirla en cada fila no añadía nada a las columnas. */}
          <p className="mt-1.5 text-sm leading-normal text-muted">
            Precios comprobados {formatTimeAgo(oldestCheck, now)} o después.
          </p>

          {/* Móvil: una tarjeta por pala, con la diferencia a la vista. La tabla no cabe sin esconder columnas. */}
          <ul className="mt-3 border-t border-line md:hidden">
            {shown.map(({ pala, spread }) => (
              <li key={pala.slug} className="border-b border-line-soft py-3">
                <div className="flex items-start justify-between gap-3">
                  <PalaCell pala={pala} />
                  <p className={`flex-none text-right ${NUM}`}>
                    <strong className="block text-base">{formatEuro(spread.difference)}</strong>
                    <span className="text-xs text-muted">{percentText(spread.percent)}</span>
                  </p>
                </div>
                <p className="mt-2 text-sm leading-normal text-ink">
                  {spread.cheapest.store.name}{" "}
                  <strong className={NUM}>{formatEuro(spreadAmount(spread.cheapest, spread.basis))}</strong>
                  <span className="text-muted"> · </span>
                  {spread.priciest.store.name}{" "}
                  <strong className={NUM}>{formatEuro(spreadAmount(spread.priciest, spread.basis))}</strong>
                </p>
                {spread.basis === "producto" && (
                  <p className="text-xs text-muted">
                    Envío no verificado en {spread.unverifiedShipping.map((store) => store.name).join(" y ")}
                  </p>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th scope="col" className={TH}>Pala</th>
                  <th scope="col" className={TH}>Precio más bajo</th>
                  <th scope="col" className={TH}>Precio más alto</th>
                  <th scope="col" className={TH}>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ pala, spread }) => (
                  <tr key={pala.slug}>
                    <td className={`${TD} align-middle`}>
                      <PalaCell pala={pala} />
                    </td>
                    {/* El importe es el que se ha comparado: con envío si la base es «total», sin él si no. */}
                    <td className={TD}>
                      {spread.cheapest.store.name}
                      <span className={`block ${NUM} font-bold`}>{formatEuro(spreadAmount(spread.cheapest, spread.basis))}</span>
                      {spread.basis === "total" && <span className="block text-xs text-muted">Con envío</span>}
                      {spread.cheapest.shipping === null && <span className="block text-xs text-muted">Envío no verificado</span>}
                    </td>
                    <td className={TD}>
                      {spread.priciest.store.name}
                      <span className={`block ${NUM} font-bold`}>{formatEuro(spreadAmount(spread.priciest, spread.basis))}</span>
                      {spread.basis === "total" && <span className="block text-xs text-muted">Con envío</span>}
                      {spread.priciest.shipping === null && <span className="block text-xs text-muted">Envío no verificado</span>}
                    </td>
                    <td className={`${TD} ${NUM}`}>
                      <strong>{formatEuro(spread.difference)}</strong>
                      <span className="block text-muted">{percentText(spread.percent)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > MAX_ROWS && (
            <p className="mt-3 text-sm text-muted">
              Se muestran las {MAX_ROWS} mayores de {rows.length}.{" "}
              <Link href={catalogHref({ coverage: ["varias-tiendas"] })} className="font-bold text-carbon underline">
                Ver todas las palas con precio en dos tiendas
              </Link>
            </p>
          )}
        </section>
      )}
    </>
  );
}

async function SeasonsSection() {
  const { pairs, cheaper } = await getSeasonOpportunities();
  const sentences =
    pairs.length === 0
      ? ["Hoy no hay ningún modelo con precio vigente en dos temporadas."]
      : [
          `Hay ${pluralize(pairs.length, "pareja", "parejas")} de ediciones del mismo modelo con precio hoy en las dos.`,
          cheaper === 0
            ? "En ninguna la edición anterior es hoy más barata."
            : `En ${cheaper} la edición anterior es hoy más barata que la más reciente.`,
          cheaper < pairs.length ? `En ${pairs.length - cheaper} cuesta lo mismo o más: una edición anterior no siempre es más barata.` : "",
        ].filter(Boolean);

  return (
    <>
      <Summary sentences={sentences} />
      <p className="mt-3 rounded-2xl bg-mist px-4 py-3 text-sm leading-normal text-ink lg:max-w-[820px]">{SEASON_RELATION.note}</p>
      {pairs.length > 0 && (
        <ul className="mt-8 grid gap-3 lg:grid-cols-2 lg:gap-5">
          {pairs.slice(0, MAX_ROWS).map(({ newer, older, difference, percent, comparison }) => {
            const euros = Math.round(difference);
            return (
              <li key={`${newer.slug}-${older.slug}`} className="flex flex-col rounded-3xl border border-line p-4 lg:p-5">
                <div className="flex gap-3.5">
                  <PalaPhoto src={older.image} alt={palaAlt(older)} sizes="96px" className="h-[110px] w-[88px] flex-none rounded-2xl" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted">{older.brand.name}</p>
                    <h2 className="text-lg leading-[1.1] font-black">
                      <Link href={routes.pala(older.slug)} className="underline-offset-2 hover:underline">
                        {older.model} {older.year}
                      </Link>
                    </h2>
                    <p className={`mt-1 text-xl font-black ${NUM}`}>{older.price !== null && formatEuro(older.price)}</p>
                    <p className="text-sm text-ink">
                      {euros === 0 ? (
                        `Prácticamente lo mismo que la de ${newer.year}`
                      ) : (
                        <span className={euros < 0 ? "font-bold text-forest" : "text-muted"}>
                          {formatEuroCompact(Math.abs(euros))} {euros < 0 ? "menos" : "más"} que la de {newer.year}
                          {percent !== 0 && ` (${percentText(percent)})`}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {newer.model} {newer.year}: {newer.price !== null && formatEuro(newer.price)}
                    </p>
                  </div>
                </div>
                {comparison && (
                  <div className="mt-3 text-sm leading-normal">
                    {comparison.changed.length > 0 && (
                      <p>
                        <span className="font-extrabold">Cambia: </span>
                        {comparison.changed.map((change) => `${change.label.toLowerCase()} (${change.other} → ${change.current})`).join("; ")}.
                      </p>
                    )}
                    {comparison.same.length > 0 && (
                      <p className="mt-1">
                        <span className="font-extrabold">Se mantiene: </span>
                        {comparison.same.join(", ").toLowerCase()}.
                      </p>
                    )}
                    {comparison.unknown.length > 0 && (
                      <p className="mt-1 text-muted">No se puede comparar: {comparison.unknown.join(", ").toLowerCase()}.</p>
                    )}
                  </div>
                )}
                <Link href={comparePath(newer.slug, older.slug)} className="mt-auto flex min-h-11 items-center pt-2 text-sm font-bold underline">
                  Comparar la {older.year} con la {newer.year}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

async function CoverageSection() {
  const report = await getCoverageReport();
  const { totals } = report;

  return (
    <>
      <Summary
        sentences={[
          `De las ${totals.total} palas del catálogo, ${totals.priced} tienen precio hoy (${percentText(totals.pricedPercent)}) y ${totals.multiStore} lo tienen en dos tiendas o más.`,
          `${totals.withPhoto} tienen foto real publicada.`,
          report.withoutPrice.length > 0
            ? `Marcas sin ninguna pala con precio ahora mismo: ${report.withoutPrice.join(", ")}.`
            : "Todas las marcas tienen alguna pala con precio.",
        ]}
      />
      <section aria-labelledby="tabla" className="mt-8">
        <h2 id="tabla" className={H2}>
          Por marca
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className={TABLE_NARROW}>
            <thead>
              <tr>
                <th scope="col" className={TH}>Marca</th>
                <th scope="col" className={TH}>Palas</th>
                <th scope="col" className={TH}>Con precio</th>
                <th scope="col" className={TH}>En 2 tiendas</th>
                <th scope="col" className={TH}>Con foto</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.brand.slug}>
                  <th scope="row" className={`${TD} font-bold`}>
                    <Link href={routes.brand(row.brand.slug)} className="underline-offset-2 hover:underline">
                      {row.brand.name}
                    </Link>
                  </th>
                  <td className={`${TD} ${NUM}`}>{row.total}</td>
                  <td className={`${TD} ${NUM}`}>
                    {row.priced} <span className="text-muted">· {percentText(row.pricedPercent)}</span>
                  </td>
                  <td className={`${TD} ${NUM}`}>{row.multiStore}</td>
                  <td className={`${TD} ${NUM}`}>{row.withPhoto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

async function BudgetSection() {
  const report = await getBudgetReport();

  return (
    <>
      <Summary
        sentences={[
          `Hoy hay ${pluralize(report.priced, "pala", "palas")} con precio confirmado en alguna tienda.`,
          ...report.tiers.map((tier) => `Hasta ${tier.max} €: ${pluralize(tier.total, "pala", "palas")}.`),
        ]}
      />
      <section aria-labelledby="tabla" className="mt-8">
        <h2 id="tabla" className={H2}>
          Por tope de precio y forma
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className={TABLE_NARROW}>
            <thead>
              <tr>
                <th scope="col" className={TH}>Hasta</th>
                <th scope="col" className={TH}>Palas</th>
                {report.tiers[0]?.byShape.map(({ shape }) => (
                  <th key={shape} scope="col" className={TH}>
                    {SHAPE_LABELS[shape]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.tiers.map((tier) => (
                <tr key={tier.max}>
                  <th scope="row" className={`${TD} font-bold`}>
                    <Link href={listingHref({ maxPrice: tier.max })} className="underline">
                      {tier.max} €
                    </Link>
                  </th>
                  <td className={`${TD} ${NUM} font-bold`}>{tier.total}</td>
                  {tier.byShape.map(({ shape, count }) => (
                    <td key={shape} className={`${TD} ${NUM}`}>
                      {count > 0 ? (
                        <Link href={catalogHref({ maxPrice: tier.max, shapes: [shape] })} className="underline-offset-2 hover:underline">
                          {count}
                        </Link>
                      ) : (
                        "0"
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

const SECTIONS: Record<string, () => Promise<React.ReactNode>> = {
  "diferencias-entre-tiendas": SpreadSection,
  "ediciones-anteriores": SeasonsSection,
  "cobertura-de-precios": CoverageSection,
  "palas-por-presupuesto": BudgetSection,
};

function MethodologyBlock({ report, method }: { report: ReportDefinition; method: Methodology }) {
  return (
    <section aria-labelledby="metodo" className="mt-12 rounded-3xl bg-mist p-5 lg:mt-16 lg:p-7">
      <h2 id="metodo" className={H2}>
        Cómo se ha calculado
      </h2>
      <dl className="mt-4 grid gap-4 text-base leading-normal lg:grid-cols-2 lg:gap-x-10">
        <div>
          <dt className="font-extrabold">Datos</dt>
          <dd className="text-ink">{method.stores}</dd>
        </div>
        <div>
          <dt className="font-extrabold">Periodo</dt>
          <dd className="text-ink">{method.period}</dd>
        </div>
        {report.metrics.map((metric) => (
          <div key={metric.name}>
            <dt className="font-extrabold">{metric.name}</dt>
            <dd className="text-ink">{metric.meaning}</dd>
          </div>
        ))}
        <div>
          <dt className="font-extrabold">Actualización</dt>
          <dd className="text-ink">{method.updated}</dd>
        </div>
      </dl>
      <h3 className="mt-5 text-base font-extrabold">Qué no dice este informe</h3>
      <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-base leading-normal text-ink">
        <li>{method.scope}</li>
        {report.limitations.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </section>
  );
}

export default async function ReportPage({ params }: ReportPageProps) {
  const report = getReport((await params).slug);
  const Section = report ? SECTIONS[report.slug] : undefined;
  if (!report || !Section) notFound();

  const method = await getMethodology();

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Informes", href: routes.reports },
          { label: report.title, href: routes.report(report.slug) },
        ]}
      />
      <div className="mx-auto max-w-[1280px] pb-10 lg:pb-[72px]">
        <PageHeading title={report.title} lead={report.lead} />
        <div className="px-5 lg:px-12">
          <Section />
          <MethodologyBlock report={report} method={method} />
          <nav aria-label="Otros informes" className="mt-10">
            <h2 className="text-base font-extrabold">Otros informes</h2>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {REPORTS.filter((other) => other.slug !== report.slug).map((other) => (
                <li key={other.slug}>
                  <Link href={routes.report(other.slug)} className="inline-flex min-h-11 items-center text-base font-bold underline">
                    {other.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}
