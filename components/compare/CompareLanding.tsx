import Link from "next/link";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { catalogHref } from "@/lib/catalog/query";
import { cn } from "@/lib/cn";
import { RECENT_MIN_WEEKLY, type RecentActivity } from "@/lib/compare-insights";
import { formatTimeAgo } from "@/lib/format";
import { routes } from "@/lib/routes";
import { PairThumbs } from "./ComparisonCards";

/** Titular de sección de la portada del comparador */
export const landingTitleClass =
  "text-2xl leading-[1.08] font-black tracking-[-0.025em] text-balance lg:text-[32px]";
const smallTitleClass = "text-[22px] leading-[1.08] font-black tracking-[-0.025em] text-balance lg:text-[26px]";

// ───────────────────────── ¿Qué buscas en una pala? ─────────────────────────

export type NeedId = "potencia" | "control" | "manejabilidad" | "tacto";

interface Need {
  id: NeedId;
  title: string;
  /** El criterio, que es exactamente el filtro al que lleva la tarjeta */
  criterion: string;
  href: string;
  /** Texto del enlace en escritorio; en móvil es «Ver →» */
  cta: string;
}

// Cada tarjeta lleva a un filtro sobre datos declarados, y su texto dice cuál es:
// no promete nada que el filtro no haga (el catálogo no filtra por peso ni por tacto).
const NEEDS: Need[] = [
  {
    id: "potencia",
    title: "Más potencia",
    criterion: "Diamante y balance alto, para atacar.",
    href: catalogHref({ shapes: ["diamante"], balances: ["alto"] }),
    cta: "Ver palas",
  },
  {
    id: "control",
    title: "Más control",
    criterion: "Redonda o lágrima, balance bajo-medio.",
    href: catalogHref({ shapes: ["redonda", "lagrima"], balances: ["bajo", "medio"] }),
    cta: "Ver palas",
  },
  {
    id: "manejabilidad",
    title: "Más manejabilidad",
    criterion: "Redonda y balance bajo, fáciles de mover en la red.",
    href: catalogHref({ shapes: ["redonda"], balances: ["bajo"] }),
    cta: "Ver palas",
  },
  {
    id: "tacto",
    title: "Más comodidad",
    criterion: "Elige el tacto que prefieres en el test de Pala ideal.",
    href: routes.idealPala,
    cta: "Hacer el test",
  },
];

/** Iconos geométricos del diseño, uno por necesidad. */
function NeedIcon({ id }: { id: NeedId }) {
  return (
    <span aria-hidden="true" className="relative block size-11 rounded-xl bg-mist">
      {id === "potencia" && (
        <>
          <span className="absolute top-2.5 left-2.5 size-6 rounded-full border-[3px] border-carbon bg-lime" />
          <span className="absolute top-1.5 left-[30px] h-[3px] w-2 -rotate-[35deg] rounded-sm bg-carbon" />
          <span className="absolute top-3.5 left-8 h-[3px] w-2 rounded-sm bg-carbon" />
        </>
      )}
      {id === "control" && (
        <>
          <span className="absolute top-2 left-2 size-7 rounded-full border-[3px] border-carbon" />
          <span className="absolute top-[15px] left-[15px] size-3.5 rounded-full border-[3px] border-carbon" />
          <span className="absolute top-5 left-5 size-1 rounded-full bg-carbon" />
        </>
      )}
      {id === "manejabilidad" && (
        <>
          <span className="absolute top-[5px] left-3.5 h-[21px] w-4 rotate-[20deg] rounded-full border-[2.5px] border-carbon" />
          <span className="absolute top-6 left-[17px] h-3 w-1 rotate-[20deg] rounded-sm bg-carbon" />
          <span className="absolute top-[30px] left-[30px] h-[2.5px] w-2 rounded-sm bg-carbon opacity-40" />
          <span className="absolute top-[35px] left-7 h-[2.5px] w-2.5 rounded-sm bg-carbon opacity-40" />
        </>
      )}
      {id === "tacto" && (
        <>
          <span className="absolute top-2 left-[11px] h-[27px] w-[22px] rounded-[6px_6px_12px_12px] border-[3px] border-carbon" />
          <span className="absolute top-4 left-4 size-3 rounded-full bg-lime" />
        </>
      )}
    </span>
  );
}

interface NeedCardsProps {
  /** Una comparación real de ejemplo por necesidad, cuando la hay («A vs B») */
  examples: Partial<Record<NeedId, string>>;
}

/** «¿Qué buscas en una pala?»: cuatro accesos por necesidad para quien no sabe qué comparar. */
export function NeedCards({ examples }: NeedCardsProps) {
  return (
    <section aria-labelledby="que-buscas">
      <h2 id="que-buscas" className={landingTitleClass}>
        ¿Qué buscas en una pala?
      </h2>
      <p className="mt-1.5 hidden text-[15px] leading-[1.45] text-pretty text-muted lg:block">
        Si aún no sabes qué comparar, empieza por lo que necesitas.
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 lg:mt-5 lg:grid-cols-4 lg:gap-4">
        {NEEDS.map((need) => {
          const example = examples[need.id];
          return (
            <li key={need.id}>
              <Link
                href={need.href}
                className="flex h-full flex-col gap-2.5 rounded-[18px] border border-line bg-white p-3.5 hover:border-carbon lg:gap-3 lg:rounded-[20px] lg:p-[18px]"
              >
                <NeedIcon id={need.id} />
                <span className="block">
                  <span className="block text-[15px] leading-[1.15] font-black lg:text-[17px] lg:leading-normal">
                    {need.title}
                  </span>
                  <span className="mt-2.5 block text-xs leading-[1.35] text-muted lg:mt-[3px] lg:text-[13px] lg:leading-[1.4]">
                    {need.criterion}
                  </span>
                </span>
                {example && (
                  <span className="mt-auto hidden border-t border-line-soft pt-3 text-[13px] leading-[1.35] lg:block">
                    <span className="text-muted">Ej.:</span> <strong>{example}</strong>
                  </span>
                )}
                {/* En móvil no hay ejemplo: el enlace es lo que baja al pie de la tarjeta. */}
                <span className={cn("text-[13px] font-extrabold max-lg:mt-auto lg:text-sm", !example && "mt-auto")}>
                  <span className="lg:hidden">Ver →</span>
                  <span className="hidden lg:inline">{need.cta} →</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ───────────────────────── ¿No sabes qué palas comparar? ─────────────────────────

interface ExploreBlockProps {
  /** Hasta tres fotos reales de palas del catálogo, para ilustrar el bloque en escritorio */
  photos: { name: string; image: string }[];
}

const EXPLORE_PHOTO_SIZES = ["h-[170px] w-[120px]", "h-[210px] w-[140px]", "h-[170px] w-[120px]"];

export function ExploreBlock({ photos }: ExploreBlockProps) {
  return (
    <section
      aria-labelledby="no-sabes"
      className="rounded-[22px] bg-mist p-[22px] lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10 lg:rounded-[28px] lg:px-10 lg:py-9"
    >
      <div>
        <h2 id="no-sabes" className="text-[22px] leading-[1.08] font-black tracking-[-0.025em] text-balance lg:text-[32px]">
          ¿No sabes qué palas comparar?
        </h2>
        <p className="mt-2 text-[15px] leading-[1.55] text-pretty text-ink lg:mt-2.5 lg:text-[17px]">
          Busca una pala que te guste y descubre alternativas similares.
          <span className="hidden lg:inline"> Desde cada ficha puedes compararla con un toque.</span>
        </p>
        <div className="mt-4 lg:mt-[22px] lg:flex lg:items-center lg:gap-3">
          <Link
            href={routes.catalog}
            className="flex h-[50px] items-center justify-center gap-2 rounded-full bg-carbon px-[22px] text-[15px] font-extrabold whitespace-nowrap text-white hover:bg-[#2a2d31] lg:h-[52px]"
          >
            Explorar palas <span aria-hidden="true">→</span>
          </Link>
          <Link
            href={routes.idealPala}
            className="mt-3 flex min-h-11 items-center justify-center text-[13px] font-bold underline lg:mt-0 lg:text-sm"
          >
            O haz el test de Pala ideal
          </Link>
        </div>
      </div>
      {photos.length > 0 && (
        <div aria-hidden="true" className="hidden items-end justify-center gap-3.5 lg:flex">
          {photos.slice(0, EXPLORE_PHOTO_SIZES.length).map((photo, i) => (
            <PalaPhoto
              key={photo.image}
              src={photo.image}
              alt=""
              sizes="140px"
              className={cn("flex-none rounded-[18px] !bg-white", EXPLORE_PHOTO_SIZES[i])}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ───────────────────────── ¿Qué puedes comparar? ─────────────────────────

/** Alturas del mini gráfico de cada píldora (px), solo decorativas */
const TOPIC_BARS = [
  [22, 14, 19],
  [14, 22, 17],
  [17, 19, 12],
  [19, 17, 22],
  [17, 19, 14],
];
const BAR_COLORS = ["bg-carbon", "bg-lime", "bg-ash"];

interface CompareTopicsProps {
  /** Aspectos que puntúa la fuente de puntuaciones, tal y como se llaman en la comparación */
  aspects: string[];
}

/** «¿Qué puedes comparar?»: los aspectos con puntuación y el precio, en una fila de píldoras. */
export function CompareTopics({ aspects }: CompareTopicsProps) {
  return (
    <section aria-labelledby="que-comparar" className="lg:grid lg:grid-cols-[260px_1fr] lg:items-center lg:gap-8">
      <div>
        <h2 id="que-comparar" className={smallTitleClass}>
          ¿Qué puedes comparar?
        </h2>
        <p className="mt-1.5 hidden text-sm leading-[1.45] text-pretty text-muted lg:block">
          Rendimiento, características y precio, en la misma página.
        </p>
      </div>
      <ul className="mt-3.5 grid grid-cols-2 gap-2 lg:mt-0 lg:grid-cols-6">
        {aspects.map((aspect, i) => (
          <li
            key={aspect}
            className="flex h-14 min-w-0 items-center gap-2 rounded-2xl border border-line bg-white px-3 lg:gap-1.5 lg:px-2.5"
          >
            <span aria-hidden="true" className="flex h-[22px] flex-none items-end gap-[3px]">
              {TOPIC_BARS[i % TOPIC_BARS.length].map((height, bar) => (
                <span key={BAR_COLORS[bar]} className={cn("w-[5px] rounded-sm", BAR_COLORS[bar])} style={{ height }} />
              ))}
            </span>
            <span title={aspect} className="min-w-0 truncate text-sm font-extrabold lg:text-[13px]">
              {aspect}
            </span>
          </li>
        ))}
        <li className="flex h-14 min-w-0 items-center gap-2.5 rounded-2xl bg-carbon px-4 text-white">
          <span aria-hidden="true" className="font-mono text-sm font-bold text-lime">
            €
          </span>
          <span className="min-w-0 truncate text-sm font-extrabold">Precio</span>
        </li>
      </ul>
    </section>
  );
}

// ───────────────────────── Comparaciones recientes ─────────────────────────

interface RecentComparisonsProps {
  activity: RecentActivity;
  /** Instante actual (ISO), para el tiempo relativo */
  now: string;
}

/**
 * Comparaciones abiertas hace poco. Solo se enseña con actividad real suficiente
 * (RECENT_MIN_WEEKLY en siete días): con menos, o sin registro de actividad, no
 * aparece. Nunca se rellena con ejemplos.
 */
export function RecentComparisons({ activity, now }: RecentComparisonsProps) {
  if (activity.weekCount < RECENT_MIN_WEEKLY || activity.items.length === 0) return null;

  return (
    <section aria-labelledby="recientes">
      <h2 id="recientes" className={smallTitleClass}>
        Comparaciones recientes
      </h2>
      <ul className="mt-1.5 lg:grid lg:grid-cols-2 lg:gap-x-10">
        {activity.items.map(({ card, at }) => (
          <li key={`${card.href}${at}`} className="border-b border-line">
            <Link
              href={card.href}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 py-3"
            >
              <PairThumbs a={card.a} b={card.b} size="row" />
              <span className="min-w-0">
                <span className="block text-sm leading-[1.3] font-extrabold">
                  {card.a.brand} {card.a.model}{" "}
                  <span className="font-mono text-[10px] font-bold text-muted">VS</span> {card.b.brand}{" "}
                  {card.b.model}
                </span>
                <span className="block text-xs text-muted">{formatTimeAgo(at, now)}</span>
              </span>
              <span className="text-sm font-extrabold whitespace-nowrap">
                Ver <span aria-hidden="true">→</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
