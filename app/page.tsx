import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import {
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
  getPopularPalas,
} from "@/data";
import { siteConfig } from "@/config/site";
import { getPriceSummary } from "@/lib/pricing";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

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
    getPopularPalas(3),
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

  const featuredPrice = featuredPala ? getPriceSummary(featuredPala) : null;
  const featured =
    featuredPala && featuredPrice ? { pala: featuredPala, price: featuredPrice } : null;

  return (
    <>
      <Hero featured={featured} />

      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-5 pt-10 lg:gap-20 lg:px-12 lg:pt-6">
        <DealsSection deals={deals} />
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          <PopularSection palas={popular} />
          <MonthlyDropsSection drops={drops} />
        </div>
        <DiscoverSection shortcuts={shortcuts} />
      </div>

      <ScannerBanner className="mt-10 lg:mt-20" />

      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-5 py-10 lg:gap-20 lg:px-12 lg:py-20">
        {featured && <PriceWatchSection pala={featured.pala} price={featured.price} />}
        <GuidesSection guides={guides} />
      </div>
    </>
  );
}
