import Link from "next/link";
import { PriceChart } from "@/components/ficha/PriceChart";
import { PalaCard } from "@/components/pala/PalaCard";
import { PalaRow } from "@/components/pala/PalaRow";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { PriceDropBadge } from "@/components/ui/PriceDropBadge";
import type { MonthlyDrop } from "@/data";
import { catalogHref } from "@/lib/catalog/query";
import { cn } from "@/lib/cn";
import { formatEuro, pluralize } from "@/lib/format";
import type { PriceSummary } from "@/lib/pricing";
import { routes } from "@/lib/routes";
import type { Guide, Pala, PalaSummary } from "@/types/catalog";
import type { CatalogShortcut } from "@/config/navigation";

const titleClass =
  "text-2xl leading-[1.08] font-black tracking-[-0.025em] text-balance lg:text-[34px]";
const leadClass = "mt-1.5 text-sm leading-[1.45] text-pretty text-muted lg:mt-2 lg:text-[15px]";

export function DealsSection({ deals }: { deals: PalaSummary[] }) {
  if (deals.length === 0) return null;

  return (
    <section aria-labelledby="ofertas-hoy">
      <div className="flex items-baseline justify-between">
        <h2 id="ofertas-hoy" className={titleClass}>
          Ofertas de hoy
        </h2>
        <Link href={routes.deals} className="text-sm font-bold underline lg:text-base">
          Ver todas
        </Link>
      </div>
      <ul className="scrollbar-none -mx-5 mt-4 flex snap-x snap-mandatory scroll-px-5 gap-3.5 overflow-x-auto px-5 pb-1 lg:mx-0 lg:mt-6 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-0">
        {deals.map((pala) => (
          <li key={pala.id} className="w-[190px] flex-none snap-start lg:w-auto">
            <PalaCard pala={pala} variant="offer" photoClassName="h-[190px] lg:h-[260px]" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PopularSection({ palas }: { palas: PalaSummary[] }) {
  return (
    <section aria-labelledby="populares">
      <h2 id="populares" className={titleClass}>
        Las más populares
      </h2>
      <p className={leadClass}>Las que más miran y valoran los jugadores.</p>
      <ul className="mt-2 lg:mt-2.5">
        {palas.map((pala) => (
          <li key={pala.id}>
            <PalaRow pala={pala} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MonthlyDropsSection({ drops }: { drops: MonthlyDrop[] }) {
  if (drops.length === 0) return null;

  return (
    <section aria-labelledby="bajadas">
      <h2 id="bajadas" className={titleClass}>
        Mayores bajadas del mes
      </h2>
      <ul className="mt-3 lg:mt-5">
        {drops.map(({ pala, from, to, percent }) => (
          <li
            key={pala.id}
            className="relative flex min-h-[58px] items-center justify-between gap-3 border-b border-line lg:min-h-[72px]"
          >
            <div>
              <h3 className="text-[15px] font-extrabold lg:text-base">
                <Link href={routes.pala(pala.slug)} className="after:absolute after:inset-0">
                  {pala.brand.name} {pala.model}
                </Link>
              </h3>
              <p className="text-[13px] whitespace-nowrap text-muted tabular-nums lg:text-sm">
                de {formatEuro(from)} a <strong className="text-carbon">{formatEuro(to)}</strong>
              </p>
            </div>
            <PriceDropBadge percent={percent} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface ShortcutWithCount extends CatalogShortcut {
  count: number;
}

export function DiscoverSection({ shortcuts }: { shortcuts: ShortcutWithCount[] }) {
  return (
    <section aria-labelledby="descubre">
      <h2 id="descubre" className={titleClass}>
        Descubre tu próxima pala
      </h2>
      <p className={leadClass}>Empieza por lo que buscas, no por las especificaciones.</p>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 lg:mt-6 lg:grid-cols-4 lg:gap-3.5">
        {shortcuts.map((shortcut) => (
          <li key={shortcut.label}>
            <Link
              href={catalogHref(shortcut.query)}
              className="flex min-h-[84px] flex-col justify-between rounded-2xl border border-line p-3.5 hover:bg-mist lg:min-h-[110px] lg:rounded-[18px] lg:p-5"
            >
              <span className="text-[15px] leading-[1.2] font-extrabold lg:text-lg">
                {shortcut.label}
              </span>
              <span className="text-xs text-muted lg:text-[13px]">
                {pluralize(shortcut.count, "pala", "palas")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface PriceWatchSectionProps {
  pala: Pala;
  price: PriceSummary;
  className?: string;
}

export function PriceWatchSection({ pala, price, className }: PriceWatchSectionProps) {
  return (
    <section
      aria-labelledby="barata-ahora"
      className={cn("lg:grid lg:grid-cols-2 lg:items-center lg:gap-14 lg:rounded-3xl lg:bg-mist lg:p-7", className)}
    >
      <div>
        <h2 id="barata-ahora" className={titleClass}>
          ¿Está barata ahora?
        </h2>
        <p className="mt-2 text-base leading-[1.6] text-pretty text-ink lg:mt-2.5">
          Seguimos el precio de cada pala. En cada ficha te decimos, en una frase, si es buen
          momento para comprar o si te conviene esperar.
        </p>
      </div>
      <Link
        href={routes.pala(pala.slug)}
        className="mt-4 block rounded-[18px] bg-mist p-4 lg:mt-0 lg:rounded-2xl lg:bg-white"
      >
        <span className="flex justify-between text-sm font-extrabold lg:text-[15px]">
          <span>{pala.model}</span>
          <span className="whitespace-nowrap tabular-nums">{formatEuro(price.current)}</span>
        </span>
        <PriceChart
          history={pala.priceHistory}
          months={12}
          average90={price.average90}
          historicalMin={price.historicalMin}
          width={340}
          height={120}
          className="mt-2"
        />
        <span className="mt-1.5 block text-sm font-bold text-forest">
          <span aria-hidden="true">● </span>
          {price.verdict.label}
        </span>
      </Link>
    </section>
  );
}

export function GuidesSection({ guides }: { guides: Guide[] }) {
  if (guides.length === 0) return null;

  return (
    <section aria-labelledby="guias">
      <div className="flex items-baseline justify-between">
        <h2 id="guias" className={titleClass}>
          Guías para elegir bien
        </h2>
        <Link href={routes.guides} className="text-sm font-bold underline lg:text-base">
          Ver guías
        </Link>
      </div>
      <ul className="mt-4 grid gap-3.5 lg:mt-6 lg:grid-cols-3 lg:gap-6">
        {guides.map((guide) => (
          <li
            key={guide.slug}
            className="grid grid-cols-[110px_1fr] items-center gap-3.5 lg:block"
          >
            <PalaPhoto
              src={guide.image}
              alt=""
              fit="cover"
              sizes="(min-width: 1024px) 33vw, 110px"
              className="h-[84px] rounded-[14px] lg:h-[220px] lg:rounded-[20px]"
            />
            <div>
              <h3 className="text-base leading-[1.2] font-extrabold lg:mt-3.5 lg:text-xl lg:font-black">
                {guide.title}
              </h3>
              <p className="mt-[3px] text-[13px] text-muted lg:mt-1 lg:text-[15px]">
                {guide.subtitle}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
