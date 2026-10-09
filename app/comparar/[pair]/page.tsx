import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { CompareHeader } from "@/components/compare/CompareHeader";
import { ComparePrices } from "@/components/compare/ComparePrices";
import { CompareRows } from "@/components/compare/CompareRows";
import { CompareScores } from "@/components/compare/CompareScores";
import { CompareStickyBar } from "@/components/compare/CompareStickyBar";
import { CompareVerdict, resultTitleClass } from "@/components/compare/CompareVerdict";
import { ComparisonCards } from "@/components/compare/ComparisonCards";
import { PriceChart } from "@/components/ficha/PriceChart";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { DisclosureMarker } from "@/components/ui/DisclosureMarker";
import { getPalaBySlug } from "@/data";
import {
  buildSpecRows,
  compareSelectPath,
  compareSetPath,
  hasEnoughHistory,
  MAX_COMPARED,
  resolveComparison,
  SLOT_IDS,
  summarize,
  type CompareSelection,
} from "@/lib/compare";
import {
  buildScoreRows,
  buildVerdict,
  comparisonFaq,
  priceConclusion,
  relatedComparisons,
} from "@/lib/compare-insights";
import { formatDate, formatEuro } from "@/lib/format";
import { isIndexableComparison } from "@/lib/indexability";
import { routes } from "@/lib/routes";
import { faqJsonLd, pageMetadata } from "@/lib/seo";
import type { Pala } from "@/types/catalog";

// Precios y diferencias dependen de la fecha: se regenera cada hora, como la ficha.
export const revalidate = 3600;

const CHART_MONTHS = 3;
const RELATED_COUNT = 3;

interface ComparePageProps {
  params: Promise<{ pair: string }>;
}

// Hay cientos de miles de combinaciones: ninguna se genera por adelantado; cada
// una se genera la primera vez que se pide y queda en caché.
export function generateStaticParams() {
  return [];
}

/** Las palas de la comparación, o null si alguna no existe o no está disponible. */
const loadPalas = cache(async (path: string): Promise<Pala[] | null> => {
  const resolved = resolveComparison(path);
  if (resolved.type !== "ok") return null;
  const palas = await Promise.all(resolved.slugs.map((slug) => getPalaBySlug(slug)));
  return palas.every((pala) => pala !== null) ? palas : null;
});

function fullName(pala: Pala): string {
  return `${pala.brand.name} ${pala.model}`;
}

/** Solo las comparaciones curadas de dos palas, entre dos fichas aptas, son indexables. */
function isIndexable(palas: Pala[]): boolean {
  return palas.length === 2 && isIndexableComparison(palas[0], palas[1]);
}

export async function generateMetadata({ params }: ComparePageProps): Promise<Metadata> {
  const palas = await loadPalas((await params).pair);
  if (!palas) return {};

  const describe = (pala: Pala) =>
    pala.price && pala.price.freshness !== "stale"
      ? `${summarize(pala)}, desde ${formatEuro(pala.price.current)}`
      : summarize(pala);

  return pageMetadata({
    title: `${palas.map(fullName).join(" vs ")}: diferencias y precios`,
    description: `${palas.map(describe).join(". ")}. Compara sus características y su precio en las tiendas.`,
    path: compareSetPath(palas.map((pala) => pala.slug)),
    index: isIndexable(palas),
  });
}

/** El último día en que se comprobó el precio de alguna de las palas. */
function pricesCheckedOn(palas: Pala[]): string | null {
  const checked = palas.flatMap((pala) => (pala.price ? [pala.price.checkedAt] : [])).sort();
  return checked.at(-1) ?? null;
}

export default async function ComparePage({ params }: ComparePageProps) {
  const segment = (await params).pair;
  const resolved = resolveComparison(segment);
  if (resolved.type === "invalid") notFound();
  if (resolved.type === "same") {
    // Una pala contra sí misma no es una comparación: se va a su ficha, si existe.
    if (!(await getPalaBySlug(resolved.slug))) notFound();
    permanentRedirect(routes.pala(resolved.slug));
  }
  if (resolved.type === "reorder") permanentRedirect(resolved.path);

  const palas = await loadPalas(segment);
  if (!palas) notFound();

  const path = compareSetPath(palas.map((pala) => pala.slug));
  const three = palas.length === MAX_COMPARED;
  const selection: CompareSelection = {};
  palas.forEach((pala, i) => {
    selection[SLOT_IDS[i]] = pala.slug;
  });

  const scores = buildScoreRows(palas);
  const verdict = buildVerdict(palas);
  const rows = buildSpecRows(palas);
  const related = relatedComparisons(palas, RELATED_COUNT);
  const faq = comparisonFaq(palas);
  const showHistory = palas.every(hasEnoughHistory);
  const checkedOn = pricesCheckedOn(palas);
  // Como en la ficha: solo el texto editorial revisado; el borrador repite los datos declarados.
  const idealFor = (pala: Pala) => (pala.editorial.status === "reviewed" ? pala.editorial.idealFor : []);
  const hasIdealFor = palas.some((pala) => idealFor(pala).length > 0);
  const models = palas.map((pala) => pala.model).join(" vs ");
  const topics = scores ? "puntuaciones, características y precio" : "características y precio";

  return (
    <article>
      <Breadcrumbs
        mobileBack={{ label: "Comparar", href: routes.compare }}
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Comparar", href: routes.compare },
          { label: models, href: path },
        ]}
        actions={
          <Link
            href={compareSelectPath(selection)}
            className="inline-flex h-11 items-center rounded-full px-3 text-[13px] font-bold underline lg:h-auto lg:px-0"
          >
            Cambiar palas
          </Link>
        }
      />

      <div className="mx-auto max-w-[1280px] pb-8 lg:pb-20">
        <header className="px-5 pt-1 lg:max-w-[900px] lg:px-12 lg:pt-4">
          <h1 className="text-[30px] leading-none font-black tracking-[-0.04em] text-balance lg:text-[56px]">
            {palas.map((pala, i) => (
              <span key={pala.id}>
                {i > 0 && " vs "}
                <span className="hidden lg:inline">{pala.brand.name} </span>
                {pala.model}
              </span>
            ))}
          </h1>
          <p className="mt-2 text-[13px] leading-[1.45] text-pretty text-muted lg:hidden">
            {palas.map((pala) => pala.brand.name).join(" vs ")}
            {checkedOn && ` · precios del ${formatDate(checkedOn)}`}
          </p>
          <p className="mt-3.5 hidden text-lg leading-[1.55] text-pretty text-ink lg:block">
            Las comparamos en {topics} para ayudarte a elegir.
            {checkedOn && ` Precios comprobados el ${formatDate(checkedOn)}.`}
          </p>
        </header>

        <div className="px-4 pt-5 lg:px-12 lg:pt-9">
          <CompareHeader
            palas={palas}
            addHref={three ? null : compareSelectPath({ ...selection, third: true })}
          />
        </div>

        <div className="flex flex-col gap-10 px-5 pt-9 lg:gap-[72px] lg:px-12 lg:pt-[72px]">
          <CompareVerdict palas={palas} verdict={verdict} />

          {hasIdealFor && (
            <section aria-label="Ideal para" className={three ? "grid gap-3 lg:grid-cols-3 lg:gap-4" : "grid gap-3 lg:grid-cols-2 lg:gap-4"}>
              {palas.map(
                (pala) =>
                  idealFor(pala).length > 0 && (
                    <div key={pala.id} className="rounded-[22px] border border-line p-[22px]">
                      <h2 className="text-[15px] font-extrabold">Ideal para</h2>
                      <p className="text-xs text-muted">{pala.model}</p>
                      <ul className="mt-2 text-[15px] leading-[1.55] text-ink">
                        {idealFor(pala).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ),
              )}
            </section>
          )}

          {scores && <CompareScores palas={palas} scores={scores} />}

          <ComparePrices palas={palas} conclusion={priceConclusion(palas)} />

          {showHistory && (
            <section aria-labelledby="historico">
              <h2 id="historico" className={resultTitleClass}>
                Cómo ha cambiado su precio
              </h2>
              <div className={three ? "mt-4 grid gap-4 lg:grid-cols-3" : "mt-4 grid gap-4 lg:grid-cols-2"}>
                {palas.map(
                  (pala) =>
                    pala.price && (
                      <div key={pala.id} className="rounded-[18px] bg-mist p-4">
                        <p className="flex justify-between gap-3 text-sm font-extrabold">
                          <span>{pala.model}</span>
                          <span className="whitespace-nowrap tabular-nums">{formatEuro(pala.price.current)}</span>
                        </p>
                        <PriceChart
                          history={pala.priceHistory}
                          price={pala.price}
                          months={CHART_MONTHS}
                          width={340}
                          height={160}
                          className="mt-2"
                        />
                      </div>
                    ),
                )}
              </div>
            </section>
          )}

          <CompareRows palas={palas} rows={rows} />

          {related.length > 0 && (
            <section aria-labelledby="relacionadas">
              <h2 id="relacionadas" className={resultTitleClass}>
                Comparaciones relacionadas
              </h2>
              <ComparisonCards cards={related} className="mt-4 lg:mt-5" />
            </section>
          )}

          {faq.length > 0 && (
            <section aria-labelledby="preguntas" className="lg:max-w-[820px]">
              <JsonLd data={faqJsonLd(faq)} />
              <h2 id="preguntas" className={resultTitleClass}>
                Preguntas frecuentes
              </h2>
              <div className="mt-1 lg:mt-1.5">
                {faq.map((item) => (
                  <details key={item.question} className="group border-b border-line">
                    <summary className="flex min-h-[58px] items-center justify-between gap-3">
                      <h3 className="text-[15px] font-bold lg:text-[17px]">{item.question}</h3>
                      <DisclosureMarker />
                    </summary>
                    <p className="mb-4 text-[15px] leading-[1.55] text-ink">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <CompareStickyBar palas={palas} />
    </article>
  );
}
