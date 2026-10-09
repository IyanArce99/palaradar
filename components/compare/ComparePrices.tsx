import Link from "next/link";
import { RecentPriceNote } from "@/components/ui/RecentPriceNote";
import { cn } from "@/lib/cn";
import { MAX_COMPARED, priceHeading, SLOT_IDS } from "@/lib/compare";
import { priceFacts, type PriceConclusion, type PriceFacts } from "@/lib/compare-insights";
import { formatEuro, formatPercent, pluralize } from "@/lib/format";
import { HISTORY_WINDOW_DAYS } from "@/lib/pricing";
import type { Pala } from "@/types/catalog";
import { SlotBadge } from "./Badges";
import { OFFERS_BUTTON, offersHref } from "./CompareHeader";
import { resultTitleClass } from "./CompareVerdict";

/** Tiendas que se enseñan por pala, de más barata a más cara */
const STORE_COUNT = 3;
const NO_DATA = "—";
const MIN_LABEL = `Mínimo últimos ${HISTORY_WINDOW_DAYS} días`;

/** Posición de cada columna en las listas de móvil: la primera a la izquierda y la última a la derecha. */
function columnAlign(index: number, count: number): string {
  if (index === 0) return "text-left";
  return index === count - 1 ? "text-right" : "text-center";
}

function stockText(pala: Pala, facts: PriceFacts): string {
  if (facts.inStock > 0) return `● En stock en ${pluralize(facts.inStock, "tienda", "tiendas")}`;
  return pala.price ? pluralize(pala.price.storeCount, "tienda", "tiendas") : NO_DATA;
}

interface ColumnsFlags {
  msrp: boolean;
  min30: boolean;
}

/** Tarjeta de precio de escritorio: cifra, PVPR, ahorro, mínimo, stock, tiendas y «Ver ofertas». */
function PriceCard({ pala, index, show }: { pala: Pala; index: number; show: ColumnsFlags }) {
  const facts = priceFacts(pala);
  const { price } = pala;
  const offers = price ? price.offers.slice(0, STORE_COUNT) : [];

  const rows: [string, string, boolean][] = [];
  if (show.msrp) {
    rows.push(
      ["PVPR", facts.msrp === null ? NO_DATA : formatEuro(facts.msrp), false],
      ["Ahorro", facts.saving ? `${formatEuro(facts.saving.amount)} (${formatPercent(facts.saving.percent)})` : NO_DATA, false],
    );
  }
  if (show.min30) rows.push([MIN_LABEL, facts.min30 ? formatEuro(facts.min30.price) : NO_DATA, false]);
  if (price) rows.push(["Disponibilidad", stockText(pala, facts), facts.inStock > 0]);

  return (
    <article className="flex flex-col rounded-[22px] border border-line bg-white p-[22px]">
      <header className="flex items-center gap-2.5">
        <SlotBadge slot={SLOT_IDS[index]} className="size-[26px] text-xs" />
        <h3 className="text-[17px] font-black">{pala.model}</h3>
      </header>

      {price ? (
        <>
          <p className="mt-3.5 flex flex-wrap items-baseline gap-x-3">
            <span className="text-[40px] leading-tight font-black tracking-[-0.03em] whitespace-nowrap tabular-nums">
              {formatEuro(price.current)}
            </span>
            {facts.msrp !== null && (
              <s className="text-[15px] whitespace-nowrap text-muted tabular-nums">{formatEuro(facts.msrp)}</s>
            )}
          </p>
          <p className="text-sm text-ink">
            en {price.bestOffer.store.name}
            {price.freshness !== "current" && ` · ${priceHeading(price).toLowerCase()}`}
            {price.verdict.status === "recent" && (
              <>
                {" · "}
                <RecentPriceNote className="text-sm" />
              </>
            )}
          </p>
        </>
      ) : (
        <p className="mt-3.5 text-lg font-extrabold">{priceHeading(null)}</p>
      )}

      {rows.length > 0 && (
        <dl className="mt-3.5">
          {rows.map(([label, value, positive]) => (
            <div key={label} className="flex min-h-10 items-center justify-between gap-3 border-t border-line-soft text-sm">
              <dt className="text-muted">{label}</dt>
              <dd className={cn("font-bold whitespace-nowrap tabular-nums", positive && "text-forest")}>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {offers.length > 0 && (
        <ul className="mt-3 rounded-[14px] bg-mist px-3.5 py-1">
          {offers.map((offer, i) => (
            <li
              key={offer.store.id}
              className="flex min-h-[38px] items-center justify-between gap-3 border-t border-line text-sm first:border-t-0"
            >
              <span className={i === 0 ? "font-extrabold" : "font-medium"}>
                {offer.store.name}
                {i === 0 && offers.length > 1 && " · la más barata"}
              </span>
              <span className="font-extrabold whitespace-nowrap tabular-nums">{formatEuro(offer.total)}</span>
            </li>
          ))}
        </ul>
      )}

      <Link href={offersHref(pala)} className={cn(OFFERS_BUTTON, "mt-auto h-[52px]")}>
        {price ? "Ver ofertas" : "Ver ficha"}
        <span className="sr-only"> de la {pala.model}</span>
      </Link>
    </article>
  );
}

/** Fila de la lista de móvil: el dato centrado y un valor por pala debajo. */
function MobileRow({ label, values, strong = false }: { label: string; values: string[]; strong?: boolean }) {
  return (
    <div className="border-t border-line-soft py-2.5">
      <dt className="text-center font-mono text-[11px] font-bold tracking-[0.04em] text-muted uppercase">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 grid gap-3 whitespace-nowrap tabular-nums",
          values.length === MAX_COMPARED ? "grid-cols-3" : "grid-cols-2",
          strong ? "text-xl font-black" : "text-[15px] font-bold",
          values.length === MAX_COMPARED && (strong ? "text-base" : "text-[13px]"),
        )}
      >
        {values.map((value, i) => (
          <span key={`${label}-${SLOT_IDS[i]}`} className={columnAlign(i, values.length)}>
            {value}
          </span>
        ))}
      </dd>
    </div>
  );
}

interface ComparePricesProps {
  palas: Pala[];
  conclusion: PriceConclusion | null;
}

/**
 * «¿Cuál sale mejor de precio?»: la conclusión en una frase y los datos de
 * precio de cada pala. En escritorio, una tarjeta por pala; en móvil, una lista
 * con el dato centrado y un valor por columna, sin tablas anchas.
 */
export function ComparePrices({ palas, conclusion }: ComparePricesProps) {
  const facts = palas.map(priceFacts);
  const show = { msrp: facts.some((item) => item.msrp !== null), min30: facts.some((item) => item.min30 !== null) };
  const three = palas.length === MAX_COMPARED;
  const cols = three ? "grid-cols-3" : "grid-cols-2";
  const priced = palas.some((pala) => pala.price);

  return (
    <section aria-labelledby="precio">
      <h2 id="precio" className={resultTitleClass}>
        ¿Cuál sale mejor de precio?
      </h2>
      <p className="mt-2 text-[15px] leading-[1.55] text-pretty text-ink lg:mt-2.5 lg:text-[17px]">
        {conclusion ? (
          <>
            {conclusion.before}
            <strong>{conclusion.strong}</strong>
            {conclusion.after}
          </>
        ) : (
          "Ahora mismo ninguna tiene precio en las tiendas que seguimos."
        )}
      </p>

      {/* Escritorio */}
      <div className={cn("mt-[22px] hidden gap-4 lg:grid", cols)}>
        {palas.map((pala, i) => (
          <PriceCard key={pala.id} pala={pala} index={i} show={show} />
        ))}
      </div>

      {/* Móvil */}
      <div className="mt-3.5 rounded-[20px] border border-line px-4 pt-1 pb-4 lg:hidden">
        <div className={cn("grid gap-3 pt-3 pb-1.5 text-[13px] font-black", cols)}>
          {palas.map((pala, i) => (
            <span
              key={pala.id}
              className={cn(
                "flex min-w-0 items-center gap-1.5",
                i === palas.length - 1 && "flex-row-reverse",
                three && i === 1 && "justify-center",
              )}
            >
              <SlotBadge slot={SLOT_IDS[i]} className="size-5 text-[9px]" />
              <span className="truncate">{pala.model}</span>
            </span>
          ))}
        </div>
        {priced && (
          <dl>
            <MobileRow
              label="Mejor precio"
              values={palas.map((pala) => (pala.price ? formatEuro(pala.price.current) : NO_DATA))}
              strong
            />
            {show.msrp && (
              <>
                <MobileRow
                  label="PVPR"
                  values={facts.map((item) => (item.msrp === null ? NO_DATA : formatEuro(item.msrp)))}
                />
                <MobileRow
                  label="Ahorro"
                  values={facts.map((item) =>
                    item.saving ? `${formatEuro(item.saving.amount)} · ${formatPercent(item.saving.percent)}` : NO_DATA,
                  )}
                />
              </>
            )}
            {show.min30 && (
              <MobileRow
                label={`Mín. ${HISTORY_WINDOW_DAYS} días`}
                values={facts.map((item) => (item.min30 ? formatEuro(item.min30.price) : NO_DATA))}
              />
            )}
            <MobileRow
              label="Disponibilidad"
              values={palas.map((pala) =>
                pala.price ? pluralize(pala.price.storeCount, "tienda", "tiendas") : NO_DATA,
              )}
            />
          </dl>
        )}
        <div className={cn("mt-3 grid gap-2", cols)}>
          {palas.map((pala) => (
            <Link key={pala.id} href={offersHref(pala)} className={cn(OFFERS_BUTTON, "h-12 min-w-0 px-2.5")}>
              <span className="truncate">
                {pala.price ? "Ofertas" : "Ficha"} {pala.model}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-2.5 text-xs leading-[1.45] text-muted">
        PVPR: precio de venta recomendado por el fabricante. El envío solo está incluido donde la tienda lo indica.
      </p>
    </section>
  );
}
