import Link from "next/link";
import { Logo } from "@/components/ui/icons";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { RecentPriceNote } from "@/components/ui/RecentPriceNote";
import { siteConfig } from "@/config/site";
import { comparePath, priceHeading } from "@/lib/compare";
import { formatEuro, formatPercent, formatRating, pluralize } from "@/lib/format";
import { SHAPE_LABELS } from "@/lib/labels";
import { palaAlt } from "@/lib/media";
import {
  buildReasons,
  buildTradeoffs,
  CRITERION_LABELS,
  expressedCriteria,
  finderPath,
  profileCatalogQuery,
  profileChips,
  toPrefs,
  type FinderAnswers,
  type Recommendation,
} from "@/lib/recommender";
import { routes } from "@/lib/routes";
import type { Pala } from "@/types/catalog";
import { TrackView } from "@/components/analytics/TrackView";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { listingHref } from "@/lib/catalog/collections";
import { FinderAction } from "./Finder";
import { RememberProfile } from "./ProfileMemory";
import { SaveResults } from "./SaveResults";

const STORES_ANCHOR = "#tiendas";
const ALERT_ANCHOR = "#alerta";

interface FinderResultsProps {
  answers: FinderAnswers;
  /** La mejor opción, con su precio completo */
  top: Pala;
  /** Todas las recomendadas, la primera incluida */
  results: Recommendation[];
  /** Las alertas de precio funcionan: solo entonces se enlaza a ellas */
  alertsEnabled: boolean;
}

/** Resultado del quiz: la mejor opción, el perfil del jugador y las alternativas. */
export function FinderResults({ answers, top, results, alertsEnabled }: FinderResultsProps) {
  const prefs = toPrefs(answers);
  const total = expressedCriteria(prefs).length;
  const [best, ...alternatives] = results;
  const reasons = buildReasons(top, prefs, best.matched);
  const tradeoffs = buildTradeoffs(top, prefs, best.matched);
  const catalogQuery = profileCatalogQuery(prefs);
  const { price } = top;

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 py-2 lg:px-12 lg:py-6">
      <RememberProfile path={finderPath(answers)} />
      <TrackView
        event={ANALYTICS_EVENTS.quizComplete}
        props={{
          nivel: prefs.level ?? "sin-indicar",
          estilo: prefs.style ?? "sin-indicar",
          presupuesto: prefs.maxPrice ?? 0,
          resultados: results.length,
        }}
      />
      <div className="flex h-12 items-center justify-between">
        <Link href={routes.home} className="flex items-center gap-2 lg:invisible">
          <Logo size={30} />
          <span className="text-[17px] font-black tracking-[-0.02em]">{siteConfig.name}</span>
        </Link>
        <FinderAction
          action="restart"
          className="flex h-11 items-center rounded-full bg-mist px-3.5 text-[13px] font-bold hover:bg-line-soft"
        >
          Rehacer
        </FinderAction>
      </div>

      <div className="pt-[18px] lg:pt-0">
        <h1 className="text-4xl leading-none font-black tracking-[-0.04em] lg:text-[56px]">Tu pala ideal</h1>
        <p className="mt-2.5 text-base leading-normal text-pretty text-ink">
          Por tus respuestas, estas son las palas que mejor encajan contigo.
        </p>
      </div>

      <article className="mt-[22px] grid gap-[18px] rounded-3xl border border-line px-3 pt-3 pb-[18px] shadow-[0_12px_40px_rgb(21_23_26/0.06)] lg:grid-cols-2 lg:gap-8 lg:p-5">
        <div className="relative">
          <PalaPhoto
            src={top.images[0] ?? null}
            alt={palaAlt(top)}
            sizes="(min-width: 1024px) 480px, 100vw"
            priority
            className="h-[300px] rounded-[18px] lg:h-[520px]"
          />
          <p className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-carbon py-2 pr-3 pl-2 whitespace-nowrap text-white">
            <span className="grid size-[26px] place-items-center rounded-full bg-lime text-xs font-black text-carbon">
              1
            </span>
            <span className="text-[13px] font-extrabold">Tu mejor opción</span>
          </p>
        </div>

        <div className="flex flex-col">
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-[40px] leading-none font-black tracking-[-0.03em] whitespace-nowrap lg:text-5xl">
              {formatPercent(best.affinity)}
            </span>
            <span className="text-[15px] font-bold whitespace-nowrap">de afinidad</span>
          </p>
          <div aria-hidden="true" className="mt-2.5 h-2 overflow-hidden rounded bg-line-soft">
            <div className="h-full rounded border-r-2 border-carbon bg-lime" style={{ width: `${best.affinity}%` }} />
          </div>
          {total > 0 && (
            <p className="mt-2 text-[13px] text-muted">
              Cumple {best.matched.length} de tus {total} {total === 1 ? "preferencia" : "preferencias"}.
            </p>
          )}

          <p className="mt-[18px] text-[13px] text-muted">
            {top.brand.name} · {top.year} · {SHAPE_LABELS[top.shape]}
          </p>
          <h2 className="mt-0.5 text-3xl leading-[1.05] font-black tracking-[-0.03em] lg:text-[38px]">
            {top.model}
          </h2>
          {/* Sin opiniones no hay estrellas: va la puntuación técnica de la fuente, con su nombre. */}
          {top.sourceRatings?.total != null && (
            <p className="mt-1.5 text-sm">
              <strong className="tabular-nums">{formatRating(top.sourceRatings.total)}</strong> sobre 10{" "}
              <span className="text-muted">· puntuación técnica de {top.sourceRatings.source}</span>
            </p>
          )}

          {reasons.length > 0 && (
            <>
              <p className="mt-[18px] text-[15px] font-extrabold">
                Creemos que encaja especialmente bien contigo porque…
              </p>
              <ul className="mt-2.5 flex flex-col gap-[9px]">
                {reasons.map((reason) => (
                  <li key={reason} className="grid grid-cols-[24px_1fr] items-start gap-2.5 text-[15px] leading-[1.45]">
                    <span
                      aria-hidden="true"
                      className="grid size-[22px] place-items-center rounded-full bg-lime text-xs font-black"
                    >
                      ✓
                    </span>
                    {reason}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Lo que no cumple o no se ha podido comprobar: una recomendación también dice sus pegas. */}
          {tradeoffs.length > 0 && (
            <>
              <p className="mt-4 text-[13px] font-extrabold">A tener en cuenta</p>
              <ul className="mt-1.5 flex flex-col gap-1.5 text-[13px] leading-[1.45] text-ink">
                {tradeoffs.map((note) => (
                  <li key={note} className="grid grid-cols-[14px_1fr] gap-2">
                    <span aria-hidden="true" className="mt-[7px] size-1.5 rounded-full bg-carbon" />
                    {note}
                  </li>
                ))}
              </ul>
            </>
          )}

          {price && (
            <div className="mt-5 flex flex-col gap-2.5 border-t border-line pt-4">
              <div>
                <p className="text-[13px] text-muted">{priceHeading(price)}</p>
                <p className="text-3xl font-black tracking-[-0.02em] whitespace-nowrap tabular-nums">
                  {formatEuro(price.current)}
                </p>
                <p className="text-[13px] text-muted">
                  en {price.bestOffer.store.name} · {pluralize(price.storeCount, "tienda", "tiendas")}
                </p>
              </div>
              {price.verdict.status === "good" && (
                <p className="text-sm font-extrabold text-forest">
                  <span aria-hidden="true">● </span>
                  {price.verdict.label}
                </p>
              )}
              {price.verdict.status === "recent" && <RecentPriceNote className="text-[13px]" />}
            </div>
          )}

          <div className="mt-3.5 grid grid-cols-2 gap-2">
            <Link
              href={routes.pala(top.slug)}
              className="flex h-[54px] items-center justify-center rounded-[14px] bg-lime text-base font-extrabold hover:bg-[#bde52f]"
            >
              Ver pala
            </Link>
            <Link
              href={`${routes.pala(top.slug)}${STORES_ANCHOR}`}
              className="flex h-[54px] items-center justify-center rounded-[14px] border-[1.5px] border-carbon text-[15px] font-extrabold"
            >
              Comparar precios
            </Link>
          </div>
          {alertsEnabled && (
            <Link
              href={`${routes.pala(top.slug)}${ALERT_ANCHOR}`}
              className="mt-3 flex min-h-11 items-center justify-center gap-2 text-sm font-bold underline"
            >
              <span aria-hidden="true" className="size-2.5 rounded-full border-2 border-carbon" />
              Avísame cuando baje de precio
            </Link>
          )}
        </div>
      </article>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-mist px-4 py-3.5">
        <p className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[13px] font-extrabold">Tu perfil:</span>
          {profileChips(answers).map((chip) => (
            <span key={chip} className="rounded-xl bg-white px-[9px] py-1 text-xs font-bold whitespace-nowrap">
              {chip}
            </span>
          ))}
        </p>
        <FinderAction action="edit" className="min-h-11 text-[13px] font-bold whitespace-nowrap underline">
          Cambiar
        </FinderAction>
      </div>
      {/* El mismo perfil, llevado al catálogo: todas las palas que cumplen lo que el catálogo sabe filtrar. */}
      {Object.keys(catalogQuery).length > 0 && (
        <p className="mt-2.5 text-[13px] leading-[1.45] text-muted">
          ¿Quieres ver más opciones?{" "}
          <Link href={listingHref(catalogQuery)} className="font-bold text-carbon underline">
            Ver en el catálogo todas las palas de tu perfil
          </Link>
          . El lado de la pista y el tacto no son filtros del catálogo.
        </p>
      )}
      <p className="mt-1.5 text-[13px] leading-[1.45] text-muted">
        ¿Ya tienes una pala y quieres cambiar algo de ella?{" "}
        <Link href={routes.upgrade} className="font-bold text-carbon underline">
          Busca alternativas a partir de la tuya
        </Link>
      </p>

      {alternatives.length > 0 && (
        <section aria-labelledby="alternativas">
          <h2 id="alternativas" className="mt-9 text-2xl font-black tracking-[-0.025em]">
            También pueden encajarte
          </h2>
          <ul className="mt-3.5 grid gap-3 lg:grid-cols-3">
            {alternatives.map(({ pala, matched, affinity }) => (
              <li
                key={pala.id}
                className="grid grid-cols-[96px_minmax(0,1fr)] gap-3.5 rounded-[20px] border border-line p-3 transition-colors duration-150 hover:border-carbon lg:grid-cols-1"
              >
                <PalaPhoto
                  src={pala.image}
                  alt={palaAlt(pala)}
                  sizes="(min-width: 1024px) 300px, 96px"
                  className="h-[120px] rounded-[14px] lg:h-[200px]"
                />
                <div className="flex min-w-0 flex-col">
                  <p className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted">
                      {pala.brand.name} · {pala.year}
                    </span>
                    <span className="rounded-[10px] bg-lime-soft px-2 py-[3px] text-xs font-extrabold whitespace-nowrap text-forest">
                      {formatPercent(affinity)}
                      <span className="sr-only"> de afinidad</span>
                    </span>
                  </p>
                  <h3 className="mt-0.5 text-base leading-[1.15] font-extrabold">{pala.model}</h3>
                  {matched.length > 0 && (
                    <p className="mt-1 text-[13px] leading-[1.4] text-ink">
                      Encaja en {matched.map((criterion) => CRITERION_LABELS[criterion]).join(", ")}.
                    </p>
                  )}
                  <div className="flex-1" />
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    {pala.price !== null && (
                      <span className="flex flex-col">
                        <span className="text-lg font-black whitespace-nowrap tabular-nums">
                          {formatEuro(pala.price)}
                        </span>
                        {pala.priceRecent && <RecentPriceNote />}
                      </span>
                    )}
                    <Link
                      href={routes.pala(pala.slug)}
                      className="flex h-10 items-center rounded-xl border-[1.5px] border-carbon px-3.5 text-[13px] font-bold whitespace-nowrap"
                    >
                      Ver pala
                    </Link>
                  </div>
                  <Link
                    href={comparePath(top.slug, pala.slug)}
                    className="mt-1 flex min-h-11 items-center text-[13px] font-bold underline"
                  >
                    Comparar con la {top.model}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {alertsEnabled && <SaveResults answers={finderPath(answers).split("?")[1] ?? ""} />}

      <p className="mt-4 mb-7 text-xs leading-normal text-muted">
        Afinidad estimada a partir de tus respuestas y de las características que declaran
        fabricantes y tiendas para cada pala. Es una orientación, no una nota de la pala: la mejor
        forma de decidir sigue siendo probarla.
      </p>
    </div>
  );
}

interface FinderEmptyProps {
  answers: FinderAnswers;
}

/** Ninguna pala a la venta cumple los filtros: se propone cambiar una sola respuesta. */
export function FinderEmpty({ answers }: FinderEmptyProps) {
  const prefs = toPrefs(answers);
  // Solo la forma y el presupuesto descartan palas; el resto de respuestas ordena.
  const wanted = [
    prefs.shape ? SHAPE_LABELS[prefs.shape].toLowerCase() : null,
    prefs.maxPrice === null ? null : `de hasta ${prefs.maxPrice} €`,
  ].filter(Boolean);

  // Una sola respuesta distinta cada vez: posición de la pregunta → opción nueva.
  const nextBudget = prefs.maxPrice === 100 ? 1 : prefs.maxPrice === 180 ? 2 : prefs.maxPrice === 250 ? 3 : null;
  const budgetLabel = ["", "Subir el presupuesto hasta 180 €", "Subir el presupuesto hasta 250 €", "Quitar el límite de presupuesto"];
  const actions: { label: string; patch: Record<number, number> }[] = [
    ...(prefs.shape ? [{ label: "Cualquier forma de pala", patch: { 3: 3 } }] : []),
    ...(nextBudget === null ? [] : [{ label: budgetLabel[nextBudget], patch: { 5: nextBudget } }]),
  ];

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-[520px] flex-col justify-center px-6 py-8 lg:min-h-[calc(100svh-77px)]">
      <div aria-hidden="true" className="relative size-[110px] rounded-full border border-[#d6d9d0]">
        <div className="absolute inset-[22%] rounded-full border border-[#d6d9d0]" />
        <div className="absolute top-1/2 left-1/2 -mt-1.5 -ml-1.5 size-3 rounded-full border-2 border-carbon" />
      </div>
      <h1 className="mt-6 text-[28px] leading-[1.05] font-black tracking-[-0.03em] text-balance">
        Ninguna pala cumple todo lo que buscas
      </h1>
      <p className="mt-3 text-base leading-[1.55] text-pretty text-ink">
        {wanted.length > 0 ? `Buscas una pala ${wanted.join(", ")}. ` : ""}
        Ahora mismo no hay ninguna así a la venta en las tiendas que seguimos.
      </p>

      {actions.length > 0 && (
        <>
          <p className="mt-[22px] text-sm font-extrabold">Prueba a cambiar una cosa:</p>
          <div className="mt-2.5 flex flex-col gap-2">
            {actions.map((action, i) => (
              <FinderAction
                key={action.label}
                action="recalculate"
                patch={action.patch}
                className={`flex min-h-[58px] items-center justify-between rounded-2xl border-[1.5px] px-[18px] text-left text-[15px] font-extrabold ${i === 0 ? "border-carbon" : "border-line"}`}
              >
                {action.label}
                <span aria-hidden="true">→</span>
              </FinderAction>
            ))}
          </div>
        </>
      )}
      <FinderAction action="edit" className="mt-[18px] min-h-11 text-center text-sm font-bold underline">
        Cambiar mis respuestas
      </FinderAction>
    </div>
  );
}
