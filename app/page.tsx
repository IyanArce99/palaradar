import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import {
  CompareTeaserSection,
  DealsSection,
  DiscoverSection,
  GuidesSection,
  MonthlyDropsSection,
  PopularSection,
  PriceWatchSection,
} from "@/components/home/HomeSections";
import { ScannerBanner } from "@/components/pala/ScannerBanner";
import { catalogShortcuts } from "@/config/navigation";
import {
  countPalas,
  getBiggestMonthlyDrops,
  getDeals,
  getFeaturedPala,
  getGuides,
  getPalaBySlug,
  getPopularPalas,
} from "@/data";
import type { Pala } from "@/types/catalog";
import { siteConfig } from "@/config/site";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

// Ofertas y bajadas dependen de la fecha: la portada se regenera cada hora.
export const revalidate = 3600;

const POPULAR_COUNT = 3;
// Se piden algunas más para elegir la segunda pala de «¿Dudas entre dos?».
const POPULAR_POOL = 8;

const HOME_TITLE = `${siteConfig.name}: compara palas de pádel, opiniones y precios`;

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
  const [deals, popular, drops, guides, featuredPala, shortcuts] = await Promise.all([
    getDeals(4),
    getPopularPalas(POPULAR_POOL),
    getBiggestMonthlyDrops(3),
    getGuides(),
    getFeaturedPala(),
    Promise.all(
      catalogShortcuts.map(async (shortcut) => ({
        ...shortcut,
        count: await countPalas(shortcut.query),
      })),
    ),
  ]);

  const featured = featuredPala?.price ? { pala: featuredPala, price: featuredPala.price } : null;

  // «¿Dudas entre dos?»: la destacada frente a la primera popular de otra forma.
  const first = featuredPala ?? null;
  const rivals = popular.filter((pala) => pala.id !== first?.id);
  const rival = rivals.find((pala) => pala.shape !== first?.shape) ?? rivals[0];
  const second = rival ? await getPalaBySlug(rival.slug) : null;
  const pair: [Pala, Pala] | null = first && second ? [first, second] : null;

  return (
    <>
      <Hero featured={featured} />

      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-5 pt-10 lg:gap-20 lg:px-12 lg:pt-6">
        <DealsSection deals={deals} />
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          <PopularSection palas={popular.slice(0, POPULAR_COUNT)} />
          <MonthlyDropsSection drops={drops} />
        </div>
        <DiscoverSection shortcuts={shortcuts} />
      </div>

      <ScannerBanner
        className="mt-10 lg:mt-20"
        example={
          featured && {
            name: `${featured.pala.brand.name} ${featured.pala.model}`,
            price: featured.price.current,
            storeCount: featured.price.storeCount,
          }
        }
      />

      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-5 py-10 lg:gap-20 lg:px-12 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-7">
          <CompareTeaserSection pair={pair} />
          <PriceWatchSection featured={featured} />
        </div>
        <GuidesSection guides={guides} />
      </div>
    </>
  );
}
