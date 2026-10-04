import Link from "next/link";
import { PriceChart } from "@/components/ficha/PriceChart";
import { PalaCard } from "@/components/pala/PalaCard";
import { PalaRow } from "@/components/pala/PalaRow";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyNote } from "@/components/ui/EmptyNote";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { PriceDropBadge } from "@/components/ui/PriceDropBadge";
import type { MonthlyDrop } from "@/data";
import { catalogHref } from "@/lib/catalog/query";
import { cn } from "@/lib/cn";
import { comparePath } from "@/lib/compare";
import { formatEuro, pluralize } from "@/lib/format";
import { BALANCE_LABELS, SHAPE_LABELS } from "@/lib/labels";
import { chartSeries } from "@/lib/pricing";
import { routes } from "@/lib/routes";
import type { Guide, Pala, PalaSummary } from "@/types/catalog";
import type { PriceSummary } from "@/types/pricing";
import type { CatalogShortcut } from "@/config/navigation";

const titleClass =
  "text-2xl leading-[1.08] font-black tracking-[-0.025em] text-balance lg:text-[34px]";
const leadClass = "mt-1.5 text-sm leading-[1.45] text-pretty text-muted lg:mt-2 lg:text-[15px]";

export function DealsSection({ deals }: { deals: PalaSummary[] }) {
  return (
    <section aria-labelledby="ofertas-hoy">
      <div className="flex items-baseline justify-between">
        <h2 id="ofertas-hoy" className={titleClass}>
          Ofertas de hoy
        </h2>
        <Link href={routes.deals} className="text-sm font-bold underline lg:text-base">
          Ver todas<span className="hidden lg:inline"> las ofertas</span>
        </Link>
      </div>
      {deals.length === 0 ? (
        <EmptyNote className="mt-4 lg:mt-6">
          Hoy no hemos detectado ninguna bajada de precio. En cuanto una tienda rebaje una pala,
          aparecerá aquí.
        </EmptyNote>
      ) : (
        <ul className="scrollbar-none -mx-5 mt-4 flex snap-x snap-mandatory scroll-px-5 gap-3.5 overflow-x-auto px-5 pb-1 lg:mx-0 lg:mt-6 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-0">
          {deals.map((pala) => (
            <li key={pala.id} className="w-[190px] flex-none snap-start lg:w-auto">
              <PalaCard pala={pala} variant="offer" photoClassName="h-[190px] lg:h-[260px]" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PopularSection({ palas }: { palas: PalaSummary[] }) {
  return (
    <section aria-labelledby="populares">
      <h2 id="populares" className={titleClass}>
        Las más populares
      </h2>
      {/* El criterio es el del orden «popularidad» del catálogo: opiniones, tiendas y año. */}
      <p className={leadClass}>Las que más tiendas tienen a la venta ahora mismo.</p>
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
  return (
    <section aria-labelledby="bajadas">
      <h2 id="bajadas" className={titleClass}>
        Mayores bajadas del mes
      </h2>
      {drops.length === 0 && (
        <EmptyNote className="mt-3 lg:mt-5">
          Todavía no llevamos un mes siguiendo precios. Cuando lo tengamos, verás aquí las palas
          que más han bajado.
        </EmptyNote>
      )}
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
      <div className="mt-4 lg:mt-6 lg:grid lg:grid-cols-[3fr_1.3fr] lg:gap-3.5">
        <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-3.5">
          {shortcuts.map((shortcut) => (
            <li key={shortcut.label}>
              <Link
                href={catalogHref(shortcut.query)}
                className="flex h-full min-h-[84px] flex-col justify-between rounded-2xl border border-line p-3.5 hover:bg-mist lg:min-h-[110px] lg:rounded-[18px] lg:p-5"
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

        <div className="mt-3 flex flex-col justify-between rounded-[20px] bg-lime p-5 lg:mt-0 lg:rounded-[22px] lg:p-7">
          <p className="hidden text-[13px] font-bold lg:block">6 preguntas · 1 minuto</p>
          <div>
            <h3 className="text-xl leading-[1.1] font-black lg:text-[30px] lg:leading-[1.05] lg:tracking-[-0.02em]">
              ¿No sabes por dónde empezar?
            </h3>
            <p className="mt-1.5 text-sm leading-[1.45] text-forest lg:mt-2 lg:text-[15px] lg:leading-normal">
              <span className="lg:hidden">Responde 6 preguntas sobre cómo juegas</span>
              <span className="hidden lg:inline">Cuéntanos cómo juegas</span> y te recomendamos
              tres palas con su mejor precio.
            </p>
            <ButtonLink href={routes.idealPala} variant="dark" className="mt-3.5 lg:mt-[18px]">
              Encontrar mi pala ideal
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

/** «Redonda y balance bajo»: solo lo que la pala declara. */
function shapeAndBalance(pala: Pala): string {
  const shape = `forma ${SHAPE_LABELS[pala.shape].toLowerCase()}`;
  return pala.balance ? `${shape} y balance ${BALANCE_LABELS[pala.balance].toLowerCase()}` : shape;
}

/** Dos palas del catálogo frente a frente, como entrada al comparador. */
export function CompareTeaserSection({ pair }: { pair: [Pala, Pala] | null }) {
  const boxTitle = cn(titleClass, "lg:text-[30px]");

  return (
    <section aria-labelledby="dudas" className="lg:rounded-3xl lg:border lg:border-line lg:p-7">
      <h2 id="dudas" className={boxTitle}>
        ¿Dudas entre dos?
      </h2>
      {pair ? (
        <div className="mt-4 rounded-[20px] border border-line p-[18px] lg:mt-5 lg:rounded-none lg:border-0 lg:p-0">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 lg:gap-3.5">
            <PalaPhoto
              src={pair[0].images[0] ?? null}
              alt={`${pair[0].brand.name} ${pair[0].model}`}
              sizes="(min-width: 1024px) 240px, 40vw"
              className="h-[110px] rounded-xl lg:h-[170px] lg:rounded-[14px]"
            />
            <span className="text-[13px] font-extrabold text-muted lg:text-base">vs</span>
            <PalaPhoto
              src={pair[1].images[0] ?? null}
              alt={`${pair[1].brand.name} ${pair[1].model}`}
              sizes="(min-width: 1024px) 240px, 40vw"
              className="h-[110px] rounded-xl lg:h-[170px] lg:rounded-[14px]"
            />
          </div>
          <p className="mt-2.5 grid grid-cols-2 gap-2.5 text-[15px] font-extrabold lg:text-base">
            <span>{pair[0].model}</span>
            <span className="text-right">{pair[1].model}</span>
          </p>
          <p className="mt-2 text-[15px] leading-[1.6] text-pretty text-ink lg:mt-2.5 lg:text-base">
            La {pair[0].model}, de {shapeAndBalance(pair[0])}; la {pair[1].model}, de{" "}
            {shapeAndBalance(pair[1])}.
          </p>
          <ButtonLink
            href={comparePath(pair[0].slug, pair[1].slug)}
            variant="outline"
            className="mt-3.5 w-full lg:hidden"
          >
            Ver comparación
          </ButtonLink>
        </div>
      ) : (
        <EmptyNote className="mt-4 lg:mt-5">
          Pon dos palas cara a cara para ver en qué se diferencian y cuál está a mejor precio.
        </EmptyNote>
      )}
      <div className="mt-2.5 flex gap-2.5 lg:mt-[18px]">
        {pair && (
          <ButtonLink
            href={comparePath(pair[0].slug, pair[1].slug)}
            variant="outline"
            className="max-lg:hidden"
          >
            Ver comparación
          </ButtonLink>
        )}
        <ButtonLink href={routes.compare} variant="dark" className="h-[52px] w-full lg:h-12 lg:w-auto">
          Comparar dos palas
        </ButtonLink>
      </div>
    </section>
  );
}

interface PriceWatchSectionProps {
  /** Pala de ejemplo con precio actual; sin ella, el bloque solo explica la función */
  featured: { pala: Pala; price: PriceSummary } | null;
}

export function PriceWatchSection({ featured }: PriceWatchSectionProps) {
  const hasChart =
    featured !== null && chartSeries(featured.pala.priceHistory, featured.price, 12).length >= 2;

  return (
    <section aria-labelledby="barata-ahora" className="lg:rounded-3xl lg:bg-mist lg:p-7">
      <h2 id="barata-ahora" className={cn(titleClass, "lg:text-[30px]")}>
        ¿Está barata ahora?
      </h2>
      <p className="mt-2 text-base leading-[1.6] text-pretty text-ink lg:mt-2.5">
        Seguimos el precio de cada pala todos los días. En cada ficha te decimos, en una frase, si
        es buen momento para comprar o si te conviene esperar.
      </p>
      {featured && (
        <Link
          href={routes.pala(featured.pala.slug)}
          className="mt-4 block rounded-[18px] bg-mist p-4 lg:mt-[18px] lg:rounded-2xl lg:bg-white"
        >
          <span className="flex justify-between gap-3 text-sm font-extrabold lg:text-[15px]">
            <span>{featured.pala.model}</span>
            <span className="whitespace-nowrap tabular-nums">
              {formatEuro(featured.price.current)}
            </span>
          </span>
          {hasChart ? (
            <PriceChart
              history={featured.pala.priceHistory}
              price={featured.price}
              months={12}
              width={340}
              height={120}
              className="mt-2"
            />
          ) : (
            <span className="mt-2 block text-sm leading-normal text-muted">
              Acabamos de empezar a seguir su precio: la gráfica aparecerá cuando tengamos más
              días de histórico.
            </span>
          )}
          <span className="mt-1.5 block text-sm font-bold text-forest">
            <span aria-hidden="true">● </span>
            {featured.price.verdict.label}
          </span>
        </Link>
      )}
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
