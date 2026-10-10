import Link from "next/link";
import { PriceChart } from "@/components/ficha/PriceChart";
import { PalaCard } from "@/components/pala/PalaCard";
import { PalaRow } from "@/components/pala/PalaRow";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyNote } from "@/components/ui/EmptyNote";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { PriceDropBadge } from "@/components/ui/PriceDropBadge";
import type { MonthlyDrop } from "@/data";
import type { GuideCover } from "@/data/guides";
import { listingHref } from "@/lib/catalog/collections";
import { cn } from "@/lib/cn";
import { comparePath } from "@/lib/compare";
import { formatEuro, pluralize } from "@/lib/format";
import { BALANCE_LABELS, SHAPE_LABELS } from "@/lib/labels";
import { palaAlt } from "@/lib/media";
import { chartSeries, DEFAULT_CHART_RANGE } from "@/lib/pricing";
import { routes } from "@/lib/routes";
import type { Pala, PalaSummary } from "@/types/catalog";
import type { PriceSummary } from "@/types/pricing";
import type { CatalogShortcut } from "@/config/navigation";
import { pricingConfig } from "@/config/pricing";

const titleClass =
  "text-2xl leading-[1.1] font-black tracking-[-0.025em] text-balance lg:text-3xl";
const leadClass = "mt-1.5 text-sm leading-normal text-pretty text-muted lg:mt-2 lg:text-base";

/** Con menos ofertas que estas, el bloque comparte fila en escritorio para no dejar media fila vacía */
export const FULL_ROW_DEALS = 3;

export function DealsSection({ deals }: { deals: PalaSummary[] }) {
  const fullRow = deals.length >= FULL_ROW_DEALS;

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
        <ul
          className={cn(
            "scrollbar-none -mx-5 mt-4 flex snap-x snap-mandatory scroll-px-5 gap-3.5 overflow-x-auto px-5 pb-1 lg:mx-0 lg:mt-6 lg:grid lg:gap-6 lg:overflow-visible lg:px-0",
            fullRow ? "lg:grid-cols-4" : "lg:grid-cols-2",
          )}
        >
          {deals.map((pala) => (
            <li key={pala.id} className="w-[190px] flex-none snap-start lg:w-auto">
              <PalaCard pala={pala} variant="offer" className="h-full" photoClassName="h-[190px] lg:h-[260px]" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MostStoresSection({ palas }: { palas: PalaSummary[] }) {
  return (
    <section aria-labelledby="mas-tiendas">
      <h2 id="mas-tiendas" className={titleClass}>
        En más tiendas
      </h2>
      {/* El criterio es el orden por defecto del catálogo: tiendas con precio vigente y año. */}
      <p className={leadClass}>
        Las palas que más tiendas tienen a la venta ahora mismo; a igualdad, las más recientes. No
        es un ranking de ventas ni de popularidad.
      </p>
      {/* Filas en móvil; en escritorio, tarjetas con su foto a todo el ancho. */}
      <ul className="mt-2 lg:hidden">
        {palas.map((pala) => (
          <li key={pala.id}>
            <PalaRow pala={pala} />
          </li>
        ))}
      </ul>
      <ul className="mt-6 hidden grid-cols-4 gap-6 lg:grid">
        {palas.map((pala) => (
          <li key={pala.id}>
            <PalaCard pala={pala} className="h-full" photoClassName="h-[240px]" />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface MonthlyDropsSectionProps {
  drops: MonthlyDrop[];
  /** A todo el ancho en escritorio: las bajadas van en columnas en vez de en una lista */
  wide?: boolean;
}

export function MonthlyDropsSection({ drops, wide = false }: MonthlyDropsSectionProps) {
  // Sin un mes de histórico no hay bajadas que enseñar: la sección no ocupa sitio para decirlo.
  if (drops.length === 0) return null;

  return (
    <section aria-labelledby="bajadas">
      <h2 id="bajadas" className={titleClass}>
        Mayores bajadas del mes
      </h2>
      <ul className={cn("mt-3 lg:mt-5", wide && "lg:grid lg:grid-cols-3 lg:gap-x-10")}>
        {drops.map(({ pala, from, to, percent }) => (
          <li
            key={pala.id}
            className="relative flex min-h-[58px] items-center justify-between gap-3 border-b border-line lg:min-h-[72px]"
          >
            <div>
              <h3 className="text-base font-extrabold lg:text-base">
                <Link href={routes.pala(pala.slug)} className="after:absolute after:inset-0">
                  {pala.brand.name} {pala.model}
                </Link>
              </h3>
              <p className="text-sm whitespace-nowrap text-muted tabular-nums lg:text-sm">
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
                href={listingHref(shortcut.query)}
                className="flex h-full min-h-[84px] flex-col justify-between rounded-2xl border border-line p-4 hover:bg-mist lg:min-h-[110px] lg:rounded-3xl lg:p-5"
              >
                <span className="text-base leading-snug font-extrabold lg:text-lg">
                  {shortcut.label}
                </span>
                <span className="text-xs text-muted lg:text-sm">
                  {pluralize(shortcut.count, "pala", "palas")}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex flex-col justify-between rounded-3xl bg-lime p-5 lg:mt-0 lg:rounded-3xl lg:p-7">
          <p className="hidden text-sm font-bold lg:block">6 preguntas · 1 minuto</p>
          <div>
            <h3 className="text-xl leading-[1.1] font-black lg:text-3xl lg:leading-[1.1] lg:tracking-[-0.02em]">
              ¿No sabes por dónde empezar?
            </h3>
            <p className="mt-1.5 text-sm leading-normal text-forest lg:mt-2 lg:text-base lg:leading-normal">
              <span className="lg:hidden">Responde 6 preguntas sobre cómo juegas</span>
              <span className="hidden lg:inline">Cuéntanos cómo juegas</span> y te recomendamos
              tres palas con su mejor precio.
            </p>
            <ButtonLink href={routes.idealPala} variant="dark" className="mt-3.5 lg:mt-5">
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
  const boxTitle = cn(titleClass, "lg:text-3xl");

  return (
    <section aria-labelledby="dudas" className="lg:rounded-3xl lg:border lg:border-line lg:p-7">
      <h2 id="dudas" className={boxTitle}>
        ¿Dudas entre dos?
      </h2>
      {pair ? (
        <div className="mt-4 rounded-3xl border border-line p-5 lg:mt-5 lg:rounded-none lg:border-0 lg:p-0">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 lg:gap-3.5">
            <PalaPhoto
              src={pair[0].images[0] ?? null}
              alt={palaAlt(pair[0])}
              sizes="(min-width: 1024px) 240px, 40vw"
              className="h-[110px] rounded-2xl lg:h-[170px] lg:rounded-2xl"
            />
            <span className="text-sm font-extrabold text-muted lg:text-base">vs</span>
            <PalaPhoto
              src={pair[1].images[0] ?? null}
              alt={palaAlt(pair[1])}
              sizes="(min-width: 1024px) 240px, 40vw"
              className="h-[110px] rounded-2xl lg:h-[170px] lg:rounded-2xl"
            />
          </div>
          <p className="mt-2.5 grid grid-cols-2 gap-2.5 text-base font-extrabold lg:text-base">
            <span>{pair[0].model}</span>
            <span className="text-right">{pair[1].model}</span>
          </p>
          <p className="mt-2 text-base leading-normal text-pretty text-ink lg:mt-2.5 lg:text-base">
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
      <div className="mt-2.5 flex gap-2.5 lg:mt-5">
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
    featured !== null &&
    chartSeries(featured.pala.priceHistory, featured.price, DEFAULT_CHART_RANGE).length >= 2;

  return (
    <section aria-labelledby="barata-ahora" className="lg:rounded-3xl lg:bg-mist lg:p-7">
      <h2 id="barata-ahora" className={cn(titleClass, "lg:text-3xl")}>
        ¿Está barata ahora?
      </h2>
      <p className="mt-2 text-base leading-normal text-pretty text-ink lg:mt-2.5">
        Seguimos el precio de cada pala. Cuando una lleva 30 días en seguimiento, su ficha te dice,
        en una frase, si es buen momento para comprar o si te conviene esperar.
      </p>
      {featured && (
        <Link
          href={routes.pala(featured.pala.slug)}
          className="mt-4 block rounded-3xl bg-mist p-4 lg:mt-5 lg:rounded-2xl lg:bg-white"
        >
          <span className="flex justify-between gap-3 text-sm font-extrabold lg:text-base">
            <span>{featured.pala.model}</span>
            <span className="whitespace-nowrap tabular-nums">
              {formatEuro(featured.price.current)}
            </span>
          </span>
          {hasChart ? (
            <PriceChart
              history={featured.pala.priceHistory}
              price={featured.price}
              months={DEFAULT_CHART_RANGE}
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
          <span
            className={cn(
              "mt-1.5 block text-sm font-bold",
              featured.price.verdict.status === "good" ? "text-forest" : "text-muted",
            )}
          >
            <span aria-hidden="true">● </span>
            {featured.price.verdict.label}
          </span>
        </Link>
      )}
    </section>
  );
}

/**
 * Cómo se obtienen y se mantienen los precios, en tres hechos comprobables. Los
 * plazos salen de la misma configuración que usa el cálculo (config/pricing.ts).
 */
export function PriceSourcesSection() {
  const steps = [
    {
      title: "Los leemos en la tienda",
      text: "Tomamos el precio público de cada pala en las tiendas que seguimos, varias veces al día, y guardamos el mejor de cada jornada para construir su histórico.",
    },
    {
      title: "Decimos cuándo se comprobó",
      text: `Cada precio lleva su hora de comprobación. Si pasan ${pricingConfig.currentHours} horas sin confirmarlo, lo presentamos como último precio conocido; a las ${pricingConfig.staleAfterHours}, deja de contar como precio actual.`,
    },
    {
      title: "Ordenamos por precio",
      text: "Las tiendas van de más barata a más cara. Donde no hemos verificado los gastos de envío, lo indicamos en lugar de darlos por incluidos.",
    },
  ];

  return (
    <section aria-labelledby="como-precios">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="como-precios" className={titleClass}>
          Cómo obtenemos los precios
        </h2>
        <Link href={routes.guide("como-saber-si-una-oferta-es-buena")} className="text-sm font-bold underline lg:text-base">
          Cómo valorar una oferta
        </Link>
      </div>
      <ol className="mt-4 grid gap-3 lg:mt-6 lg:grid-cols-3 lg:gap-6">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-3xl border border-line p-4 lg:p-5">
            <span aria-hidden="true" className="font-mono text-sm font-medium text-muted">
              0{index + 1}
            </span>
            <h3 className="mt-1 text-lg leading-snug font-extrabold">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-normal text-pretty text-ink">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function GuidesSection({ guides }: { guides: GuideCover[] }) {
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
        {guides.map(({ guide, image }) => (
          <li
            key={guide.slug}
            className="group relative grid grid-cols-[110px_1fr] items-center gap-3.5 lg:block"
          >
            <PalaPhoto
              src={image}
              alt=""
              sizes="(min-width: 1024px) 33vw, 110px"
              className="h-[84px] rounded-2xl lg:h-[220px] lg:rounded-3xl"
            />
            <div>
              <h3 className="text-base leading-snug font-extrabold lg:mt-3.5 lg:text-xl lg:font-black">
                <Link href={routes.guide(guide.slug)} className="after:absolute after:inset-0 group-hover:underline">
                  {guide.title}
                </Link>
              </h3>
              <p className="mt-[3px] text-sm text-muted lg:mt-1 lg:text-base">
                {guide.subtitle}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
