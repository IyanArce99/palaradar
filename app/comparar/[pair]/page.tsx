import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { CompareHeader } from "@/components/compare/CompareHeader";
import { CompareRows } from "@/components/compare/CompareRows";
import { PriceChart } from "@/components/ficha/PriceChart";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { ScanIcon } from "@/components/ui/icons";
import { getPalaBySlug } from "@/data";
import {
  buildCompareRows,
  comparePath,
  compareSelectPath,
  describeDifferences,
  hasEnoughHistory,
  isCuratedPair,
  priceDifference,
  resolvePair,
  summarize,
} from "@/lib/compare";
import { formatEuro, formatEuroCompact } from "@/lib/format";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";
import type { Pala } from "@/types/catalog";

// Precios y diferencias dependen de la fecha: se regenera cada hora, como la ficha.
export const revalidate = 3600;

const STORES_ANCHOR = "#tiendas";
const CHART_MONTHS = 12;

interface ComparePageProps {
  params: Promise<{ pair: string }>;
}

// Hay cientos de miles de combinaciones: ninguna se genera por adelantado; cada
// una se genera la primera vez que se pide y queda en caché.
export function generateStaticParams() {
  return [];
}

/** Las dos palas del par, o null si alguna no existe o no está disponible. */
const loadPalas = cache(async (a: string, b: string): Promise<[Pala, Pala] | null> => {
  const [first, second] = await Promise.all([getPalaBySlug(a), getPalaBySlug(b)]);
  return first && second ? [first, second] : null;
});

function fullName(pala: Pala): string {
  return `${pala.brand.name} ${pala.model}`;
}

export async function generateMetadata({ params }: ComparePageProps): Promise<Metadata> {
  const pair = resolvePair((await params).pair);
  if (pair.type !== "ok") return {};
  const palas = await loadPalas(pair.a, pair.b);
  if (!palas) return {};

  const [a, b] = palas;
  const describe = (pala: Pala) =>
    pala.price && pala.price.freshness !== "stale"
      ? `${summarize(pala)}, desde ${formatEuro(pala.price.current)}`
      : summarize(pala);

  return pageMetadata({
    title: `${fullName(a)} vs ${fullName(b)}: diferencias y precios`,
    description: `${describe(a)}. ${describe(b)}. Compara sus características y su precio en las tiendas.`,
    path: comparePath(a.slug, b.slug),
    // Solo las comparaciones curadas (palas «parecidas») son indexables.
    index: isCuratedPair(a, b),
  });
}

export default async function ComparePage({ params }: ComparePageProps) {
  const pair = resolvePair((await params).pair);
  if (pair.type === "invalid") notFound();
  if (pair.type === "same") {
    // Una pala contra sí misma no es una comparación: se va a su ficha, si existe.
    if (!(await getPalaBySlug(pair.slug))) notFound();
    permanentRedirect(routes.pala(pair.slug));
  }
  if (pair.type === "reorder") permanentRedirect(pair.path);

  const palas = await loadPalas(pair.a, pair.b);
  if (!palas) notFound();

  const [a, b] = palas;
  const path = comparePath(a.slug, b.slug);
  const rows = buildCompareRows(a, b);
  const difference = priceDifference(a, b);
  const differences = describeDifferences(a, b);
  const showHistory = hasEnoughHistory(a) && hasEnoughHistory(b);
  const hasIdealFor = palas.some((pala) => pala.editorial.idealFor.length > 0);

  return (
    <article>
      <Breadcrumbs
        mobileBack={{ label: "Comparar", href: routes.compare }}
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Comparar", href: routes.compare },
          { label: `${a.model} vs ${b.model}`, href: path },
        ]}
      />

      <header className="px-5 pt-1 lg:px-12 lg:pt-8 lg:text-center">
        <h1 className="text-[30px] leading-none font-black tracking-[-0.035em] text-balance lg:text-[52px]">
          {a.model} vs {b.model}
        </h1>
        <p className="mt-2 text-sm leading-[1.45] text-pretty text-muted lg:mt-2.5 lg:text-base">
          {fullName(a)} {a.year} frente a {fullName(b)} {b.year}: sus diferencias y su precio.
        </p>
      </header>

      <div className="mx-auto max-w-[920px] px-5 pt-5 pb-8 lg:px-0 lg:pt-10 lg:pb-20">
        <CompareHeader palas={palas} />

        {difference && (
          <p className="mt-5 rounded-[22px] border-2 border-carbon p-5 text-center text-lg leading-[1.3] font-extrabold text-balance lg:mt-8 lg:p-6 lg:text-[22px]">
            {difference.cheaper === null ? (
              "Las dos cuestan lo mismo actualmente."
            ) : (
              <>
                La {(difference.cheaper === "a" ? a : b).model} cuesta{" "}
                <span className="rounded-md bg-lime px-1.5 whitespace-nowrap tabular-nums">
                  {formatEuroCompact(difference.amount)} menos
                </span>{" "}
                actualmente.
              </>
            )}
          </p>
        )}

        <section aria-labelledby="caracteristicas" className="mt-5 lg:mt-8">
          <h2 id="caracteristicas" className="sr-only">
            Características frente a frente
          </h2>
          <CompareRows rows={rows} models={[a.model, b.model]} />
        </section>

        <section aria-labelledby="diferencias" className="mt-3 rounded-[20px] bg-lime-tint p-5">
          <h2 id="diferencias" className="text-sm font-extrabold">
            En qué se diferencian
          </h2>
          <p className="mt-2 text-base leading-[1.6] text-pretty text-ink">{differences.join(" ")}</p>
          <p className="mt-2.5 text-xs text-muted">
            Según los datos que declaran los fabricantes y las tiendas de cada pala.
          </p>
        </section>

        {hasIdealFor && (
          <section aria-label="Ideal para" className="mt-6 grid grid-cols-2 gap-3 lg:mt-8 lg:gap-10">
            {palas.map((pala) => (
              <div key={pala.id}>
                {pala.editorial.idealFor.length > 0 && (
                  <>
                    <h2 className="text-sm font-extrabold lg:text-base">Ideal para</h2>
                    <p className="text-xs text-muted">{pala.model}</p>
                    <ul className="mt-2 text-sm leading-normal text-ink lg:text-base lg:leading-[1.55]">
                      {pala.editorial.idealFor.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </section>
        )}

        {showHistory && (
          <section aria-labelledby="historico" className="mt-8 lg:mt-10">
            <h2 id="historico" className="text-xl font-black lg:text-2xl">
              Cómo ha cambiado su precio
            </h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:gap-10">
              {palas.map(
                (pala) =>
                  pala.price && (
                    <div key={pala.id} className="rounded-[18px] bg-mist p-4">
                      <p className="flex justify-between gap-3 text-sm font-extrabold">
                        <span>{pala.model}</span>
                        <span className="whitespace-nowrap tabular-nums">
                          {formatEuro(pala.price.current)}
                        </span>
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

        <div className="mt-6 grid grid-cols-2 gap-2.5 lg:mt-8 lg:gap-10">
          {palas.map((pala) => (
            <ButtonLink
              key={pala.id}
              href={`${routes.pala(pala.slug)}${pala.price ? STORES_ANCHOR : ""}`}
              size="lg"
              className="h-auto min-h-[50px] py-2 text-center whitespace-normal"
            >
              {pala.price ? "Ver precios" : "Ver ficha"}
              <span className="max-lg:sr-only">de la {pala.model}</span>
            </ButtonLink>
          ))}
        </div>

        <div className="mt-3 grid gap-2 lg:mt-10 lg:flex lg:justify-center lg:gap-2.5">
          <ButtonLink href={compareSelectPath({ a: a.slug, b: b.slug })} variant="outline">
            Cambiar una pala
          </ButtonLink>
          <ButtonLink href={routes.scan} variant="soft">
            <ScanIcon size={20} />
            Escanear dos palas
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}
