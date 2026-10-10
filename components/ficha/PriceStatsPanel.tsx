import { cn } from "@/lib/cn";
import { formatDate, formatEuro, formatPercent } from "@/lib/format";
import {
  historyCoverage,
  opportunityIndex,
  periodStats,
  STAT_PERIODS,
  type OpportunityIndex,
  type PeriodStats,
} from "@/lib/price-stats";
import type { PricePoint } from "@/types/catalog";
import type { PriceSummary } from "@/types/pricing";

interface PriceStatsPanelProps {
  price: PriceSummary;
  history: PricePoint[];
  className?: string;
}

const CONFIDENCE_LABELS = { alta: "Confianza alta", media: "Confianza media", baja: "Confianza baja" } as const;

/**
 * El índice es un número con sus motivos, sin rótulo propio. El titular del
 * precio es el veredicto de la ficha («Buen momento para comprar», «Precio
 * normal», «Puedes esperar»), que se calcula con otra regla: ponerle al número
 * una segunda etiqueta, o la del veredicto, los haría contradecirse en los casos
 * límite (un 73 junto a «precio normal»).
 */
function IndexCard({ index, good }: { index: OpportunityIndex; good: boolean }) {

  return (
    <div className={cn("rounded-[18px] border p-4", good ? "border-lime-border bg-lime-tint" : "border-line")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[15px] font-extrabold">Índice de oportunidad</h3>
        <p className="text-xs text-muted">{CONFIDENCE_LABELS[index.confidence]}</p>
      </div>
      <p className="mt-1.5 flex items-baseline gap-2">
        <span className="font-mono text-[32px] leading-none font-medium tabular-nums">{index.score}</span>
        <span className="text-sm text-muted">de 100 · 50 es su precio habitual</span>
      </p>
      {/* La barra repite el número: es decorativa para quien usa lector de pantalla. */}
      <div aria-hidden="true" className="mt-2.5 h-2 overflow-hidden rounded-full bg-mist">
        <div className={cn("h-full rounded-full", good ? "bg-forest" : "bg-carbon")} style={{ width: `${index.score}%` }} />
      </div>
      <ul className="mt-3 text-[13px] leading-[1.45] text-ink">
        {index.reasons.map((reason) => (
          <li key={reason} className="mt-0.5">
            {reason}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-[1.45] text-muted">
        Compara el precio de hoy con lo que ha costado en los últimos 30 días. Es una orientación, no una predicción.
      </p>
    </div>
  );
}

function change(percent: number): string {
  if (percent === 0) return "Sin cambios";
  return `${percent < 0 ? "−" : "+"}${formatPercent(Math.abs(percent))}`;
}

function PeriodTable({ periods }: { periods: PeriodStats[] }) {
  const rows: { label: string; value: (stats: PeriodStats) => string }[] = [
    { label: "Precio medio", value: (stats) => formatEuro(stats.average) },
    { label: "Mínimo", value: (stats) => `${formatEuro(stats.min.price)} · ${formatDate(stats.min.date)}` },
    { label: "Máximo", value: (stats) => formatEuro(stats.max.price) },
    { label: "Variación", value: (stats) => change(stats.changePercent) },
    { label: "Días con precio registrado", value: (stats) => `${stats.observations} de ${stats.days}` },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] border-collapse text-left text-[13px]">
        <caption className="sr-only">Estadísticas del precio por periodo</caption>
        <thead>
          <tr className="text-muted">
            <th scope="col" className="py-2 pr-3 font-normal">
              Periodo
            </th>
            {periods.map((stats) => (
              <th key={stats.days} scope="col" className="py-2 pr-3 font-bold text-carbon">
                Últimos {stats.days} días
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-line">
              <th scope="row" className="py-2 pr-3 font-normal text-muted">
                {row.label}
              </th>
              {periods.map((stats) => (
                <td key={stats.days} className="py-2 pr-3 font-bold tabular-nums">
                  {row.value(stats)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Estadísticas del precio por periodo e índice de oportunidad (lib/price-stats.ts).
 * De un periodo solo se habla si el seguimiento lo cubre; si no, se dice cuánto
 * histórico hay y cuándo habrá bastante.
 */
export function PriceStatsPanel({ price, history, className }: PriceStatsPanelProps) {
  const now = new Date(price.asOf);
  const coverage = historyCoverage(history, now);
  if (!coverage) return null;

  const periods = STAT_PERIODS.flatMap((days) => periodStats(history, days, price.current, now) ?? []);
  // Con la misma media que el veredicto: las dos frases dan el mismo porcentaje.
  const index = opportunityIndex(history, price.current, price.freshness, now, price.average30);
  const [shortPeriod, longPeriod] = STAT_PERIODS;
  const has = (days: number) => periods.some((stats) => stats.days === days);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {index && <IndexCard index={index} good={price.verdict.status === "good"} />}
      {periods.length > 0 && <PeriodTable periods={periods} />}
      <p className="text-[13px] leading-[1.5] text-pretty text-muted">
        Seguimos el precio de esta pala desde el {formatDate(coverage.since)}: {coverage.observations}{" "}
        {coverage.observations === 1 ? "día" : "días"} con precio registrado.
        {periods.length === 0 &&
          (coverage.daysUntilVerdict > 0
            ? ` Faltan ${coverage.daysUntilVerdict} ${coverage.daysUntilVerdict === 1 ? "día" : "días"} para tener 30 días de histórico; hasta entonces no damos medias, mínimos ni índice de oportunidad, porque con tan pocos datos no significarían nada.`
            : " Hay demasiados días sin precio registrado en el último mes para dar medias fiables.")}
        {has(shortPeriod) &&
          !has(longPeriod) &&
          ` Las cifras de ${longPeriod} días aparecerán cuando el seguimiento cubra ese periodo con días suficientes.`}
      </p>
    </div>
  );
}
