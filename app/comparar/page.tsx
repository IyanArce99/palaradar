import type { Metadata } from "next";
import {
  CompareTopics,
  ExploreBlock,
  landingTitleClass,
  NeedCards,
  RecentComparisons,
  type NeedId,
} from "@/components/compare/CompareLanding";
import { CompareSelector, visibleSlots, type SelectorSlot } from "@/components/compare/CompareSelector";
import { ComparisonCards } from "@/components/compare/ComparisonCards";
import { PalaCard } from "@/components/pala/PalaCard";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getAlternativePairs,
  getPalaBySlug,
  getPalaSummaries,
  getRecentComparisons,
  getTopPalas,
  searchCatalog,
} from "@/data";
import { DEFAULT_QUERY } from "@/lib/catalog/query";
import {
  COMPARE_PARAMS,
  compareSelectPath,
  MAX_COMPARED,
  SEARCH_PARAM,
  toPalaSuggestion,
  type CompareSelection,
} from "@/lib/compare";
import { pickFeaturedPairs, SCORE_ASPECTS, type ComparisonCard } from "@/lib/compare-insights";
import { isProductPhoto } from "@/lib/media";
import { routes } from "@/lib/routes";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import type { PalaShape, PalaSuggestion } from "@/types/catalog";

const RESULT_COUNT = 6;
const MAX_QUERY_LENGTH = 80;
/** Comparaciones destacadas: dos filas de tres en escritorio */
const FEATURED_COUNT = 6;
/** Palas para empezar con un toque, por hueco */
const CHIPS_PER_SLOT = 3;
const CHIP_MAX_LENGTH = 16;
/** Palas del orden por defecto entre las que se eligen las de los chips y las fotos del bloque de ayuda */
const TOP_POOL = 18;
const EXPLORE_PHOTOS = 3;

type RawParams = Record<string, string | string[] | undefined>;

interface CompareSelectPageProps {
  searchParams: Promise<RawParams>;
}

function first(params: RawParams, key: string): string {
  const value = params[key];
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

export async function generateMetadata({ searchParams }: CompareSelectPageProps): Promise<Metadata> {
  const hasParams = Object.keys(await searchParams).length > 0;

  return pageMetadata({
    title: "Comparador de palas de pádel",
    description:
      "Compara dos o tres palas de pádel frente a frente: puntuaciones, forma, balance, peso, materiales y mejor precio en las tiendas.",
    path: routes.compare,
    // La selección a medias (?a=…&b=…) no es una página que indexar.
    index: !hasParams,
  });
}

/** Resultados de la búsqueda enviada desde un hueco (camino sin JavaScript). */
async function searchSuggestions(q: string): Promise<PalaSuggestion[]> {
  if (!q) return [];
  const { items } = await searchCatalog(
    { ...DEFAULT_QUERY, q: q.slice(0, MAX_QUERY_LENGTH) },
    { pageSize: RESULT_COUNT },
  );
  return items.map(toPalaSuggestion);
}

/** Todas las comparaciones curadas que se pueden enseñar: las dos palas con precio y foto real. */
async function showableComparisons(): Promise<ComparisonCard[]> {
  const pairs = await getAlternativePairs();
  const summaries = await getPalaSummaries([...new Set(pairs.flat())]);
  return pickFeaturedPairs(pairs, summaries, pairs.length);
}

/** Una comparación real de ejemplo por necesidad: pares en los que las dos palas tienen esa forma. */
function needExamples(cards: ComparisonCard[]): Partial<Record<NeedId, string>> {
  const both = (shape: PalaShape) => cards.filter((card) => card.a.shape === shape && card.b.shape === shape);
  const name = (card: ComparisonCard | undefined) => (card ? `${card.a.model} vs ${card.b.model}` : undefined);

  const [control, handling] = both("redonda");
  return { potencia: name(both("diamante")[0]), control: name(control), manejabilidad: name(handling) };
}

export default async function CompareSelectPage({ searchParams }: CompareSelectPageProps) {
  const params = await searchParams;
  const third =
    first(params, COMPARE_PARAMS.slots) === String(MAX_COMPARED) ||
    first(params, COMPARE_PARAMS.c) !== "" ||
    first(params, SEARCH_PARAM.c) !== "";
  const slotIds = visibleSlots(third);

  const [palas, results, top, comparisons, recent] = await Promise.all([
    Promise.all(
      slotIds.map((id) => {
        const slug = first(params, COMPARE_PARAMS[id]);
        return slug ? getPalaBySlug(slug) : null;
      }),
    ),
    Promise.all(slotIds.map((id) => searchSuggestions(first(params, SEARCH_PARAM[id])))),
    getTopPalas(TOP_POOL),
    showableComparisons(),
    getRecentComparisons(),
  ]);

  // Palas para empezar: las primeras del catálogo que no estén ya elegidas, repartidas entre
  // los huecos. Las de nombre corto primero, para que las tres quepan en una línea.
  const chosenSlugs = new Set(palas.flatMap((pala) => (pala ? [pala.slug] : [])));
  const available = top.filter((pala) => !chosenSlugs.has(pala.slug));
  const short = available.filter((pala) => pala.model.length <= CHIP_MAX_LENGTH);
  const starters = [...short, ...available.filter((pala) => !short.includes(pala))];
  const slots: SelectorSlot[] = slotIds.map((id, i) => ({
    id,
    pala: palas[i],
    search: first(params, SEARCH_PARAM[id]),
    results: results[i],
    chips: starters
      .slice(i * CHIPS_PER_SLOT, (i + 1) * CHIPS_PER_SLOT)
      .map((pala) => ({ slug: pala.slug, label: pala.model })),
  }));

  // Con una sola pala elegida se proponen sus «parecidas» para el primer hueco libre.
  const chosen = palas.filter((pala) => pala !== null);
  const only = chosen.length === 1 ? chosen[0] : null;
  const emptySlot = slots.find((slot) => slot.pala === null)?.id;
  const selection: CompareSelection = { third };
  for (const slot of slots) selection[slot.id] = slot.pala?.slug ?? null;

  const explorePhotos = top
    .flatMap((pala) =>
      pala.image && isProductPhoto(pala.image)
        ? [{ name: `${pala.brand.name} ${pala.model}`, image: pala.image }]
        : [],
    )
    .slice(0, EXPLORE_PHOTOS);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { label: "Inicio", href: routes.home },
          { label: "Comparar", href: routes.compare },
        ])}
      />

      <div className="mx-auto max-w-[1280px]">
        <div className="px-4 pt-4 lg:px-12 lg:pt-14 lg:pb-16">
          <header className="px-1 lg:mx-auto lg:max-w-[760px] lg:px-0 lg:text-center">
            <p className="font-mono text-[11px] leading-none font-bold tracking-[0.08em] text-muted">COMPARADOR</p>
            <h1 className="mt-2.5 text-[38px] leading-none font-black tracking-[-0.04em] text-balance lg:mt-3.5 lg:text-[64px]">
              Compara palas de pádel
            </h1>
            <p className="mt-2.5 text-base leading-[1.55] text-pretty text-ink lg:mt-4 lg:text-[19px]">
              Pon dos palas frente a frente y descubre cuál encaja mejor contigo.
            </p>
          </header>

          <div className="mt-5 lg:mt-10">
            <CompareSelector slots={slots} />
          </div>
        </div>

        <div className="flex flex-col gap-10 px-5 pt-10 pb-10 lg:gap-[72px] lg:px-12 lg:pt-0 lg:pb-20">
          {only && emptySlot && only.alternatives.length > 0 && (
            <section aria-labelledby="parecidas">
              <h2 id="parecidas" className={landingTitleClass}>
                Palas parecidas a la {only.model}
              </h2>
              <p className="mt-1.5 text-[15px] leading-[1.45] text-muted">Elige una para compararla con ella.</p>
              <ul className="scrollbar-none -mx-5 mt-4 flex gap-3.5 overflow-x-auto px-5 pb-1 lg:mx-0 lg:mt-5 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0">
                {only.alternatives.map(({ pala, reason }) => (
                  <li key={pala.id} className="w-[200px] flex-none lg:w-auto">
                    <PalaCard
                      pala={pala}
                      variant="alternative"
                      badge={reason}
                      photoClassName="h-[170px]"
                      href={compareSelectPath({ ...selection, [emptySlot]: pala.slug })}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {comparisons.length > 0 && (
            <section aria-labelledby="destacadas">
              <h2 id="destacadas" className={landingTitleClass}>
                Comparaciones destacadas
              </h2>
              {/* No hay datos de visitas: son pares de palas parecidas, no un ranking de popularidad. */}
              <p className="mt-1.5 hidden text-[15px] leading-[1.45] text-pretty text-muted lg:block">
                Palas parecidas entre sí, con precio hoy en las tiendas que seguimos.
              </p>
              <ComparisonCards cards={comparisons.slice(0, FEATURED_COUNT)} className="mt-4 lg:mt-5" />
            </section>
          )}

          <NeedCards examples={needExamples(comparisons)} />
          <ExploreBlock photos={explorePhotos} />
          <CompareTopics aspects={SCORE_ASPECTS} />
          <RecentComparisons activity={recent} now={new Date().toISOString()} />
        </div>
      </div>
    </>
  );
}
