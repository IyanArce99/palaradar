import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import {
  CompareTeaserSection,
  DealsSection,
  DiscoverSection,
  FULL_ROW_DEALS,
  GuidesSection,
  MonthlyDropsSection,
  MostStoresSection,
  PriceSourcesSection,
  PriceWatchSection,
} from "@/components/home/HomeSections";
import { BrandLinks } from "@/components/catalog/BrandLinks";
import { CollectionLinks } from "@/components/catalog/CollectionLinks";
import { getGuideCovers } from "@/data/guides";
import { catalogShortcuts } from "@/config/navigation";
import {
  countPalas,
  getBiggestMonthlyDrops,
  getBrands,
  getDeals,
  getFeaturedPala,
  getPalaBySlug,
  getTopPalas,
} from "@/data";
import type { Pala } from "@/types/catalog";
import { siteConfig } from "@/config/site";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

// Ofertas y bajadas dependen de la fecha: la portada se regenera cada hora.
export const revalidate = 3600;

const TOP_COUNT = 4;
// Se piden algunas más para elegir la segunda pala de «¿Dudas entre dos?».
const TOP_POOL = 8;
const HOME_GUIDES = 3;

const HOME_TITLE = `${siteConfig.name}: compara palas de pádel, características y precios`;

export const metadata: Metadata = {
  ...pageMetadata({
    title: HOME_TITLE,
    description: siteConfig.description,
    path: routes.home,
  }),
  // La portada no lleva el sufijo «| PalaRadar» de la plantilla.
  title: { absolute: HOME_TITLE },
};

export default async function HomePage() {
  const [deals, top, drops, featuredPala, brands, guideCovers, shortcuts] = await Promise.all([
    getDeals(4),
    getTopPalas(TOP_POOL),
    getBiggestMonthlyDrops(3),
    getFeaturedPala(),
    getBrands(),
    getGuideCovers(),
    Promise.all(
      catalogShortcuts.map(async (shortcut) => ({
        ...shortcut,
        count: await countPalas(shortcut.query),
      })),
    ),
  ]);

  const featured = featuredPala?.price ? { pala: featuredPala, price: featuredPala.price } : null;

  // «¿Dudas entre dos?»: la destacada frente a la primera del listado con otra forma.
  const first = featuredPala ?? null;
  const rivals = top.filter((pala) => pala.id !== first?.id);
  const rival = rivals.find((pala) => pala.shape !== first?.shape) ?? rivals[0];
  const second = rival ? await getPalaBySlug(rival.slug) : null;
  const pair: [Pala, Pala] | null = first && second ? [first, second] : null;

  return (
    <>
      <Hero featured={featured} />

      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-5 pt-10 lg:gap-20 lg:px-12 lg:pt-6">
        {/* Con pocas ofertas, comparten fila con las bajadas del mes para no dejar media fila vacía. */}
        {deals.length >= FULL_ROW_DEALS ? (
          <>
            <DealsSection deals={deals} />
            <MonthlyDropsSection drops={drops} wide />
          </>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
            <DealsSection deals={deals} />
            <MonthlyDropsSection drops={drops} />
          </div>
        )}
        <MostStoresSection palas={top.slice(0, TOP_COUNT)} />
        <DiscoverSection shortcuts={shortcuts} />
        <BrandLinks id="marcas" title="Palas por marca" brands={brands} withCatalogLink />
      </div>

      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-5 py-10 lg:gap-20 lg:px-12 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-7">
          <CompareTeaserSection pair={pair} />
          <PriceWatchSection featured={featured} />
        </div>
        <GuidesSection guides={guideCovers.slice(0, HOME_GUIDES)} />
        <PriceSourcesSection />
        <CollectionLinks id="palas-por-tipo" title="Palas por tipo" />
      </div>
    </>
  );
}
