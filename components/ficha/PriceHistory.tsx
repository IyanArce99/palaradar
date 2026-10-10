"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { CHART_RANGES, DEFAULT_CHART_RANGE, type ChartRange } from "@/lib/pricing";
import type { PricePoint } from "@/types/catalog";
import type { PriceSummary } from "@/types/pricing";
import { PriceChart } from "./PriceChart";

interface PriceHistoryProps {
  /** Titular de la sección; el selector de rango se alinea con él en escritorio */
  title: React.ReactNode;
  /** Texto entre el titular y el gráfico */
  children: React.ReactNode;
  history: PricePoint[];
  price: PriceSummary;
}

/**
 * Histórico de precio, día a día. Se abre en el último mes y el selector cambia a
 * 3 o 6 meses, en móvil y en escritorio.
 */
export function PriceHistory({ title, children, history, price }: PriceHistoryProps) {
  const [months, setMonths] = useState<ChartRange>(DEFAULT_CHART_RANGE);
  const chart = { history, price, months };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:gap-x-5">
      {title}
      <div className="lg:col-span-2 lg:row-start-2">{children}</div>
      <div
        role="group"
        aria-label="Periodo del histórico"
        className="mt-4 flex gap-1 rounded-2xl bg-mist p-1 lg:col-start-2 lg:row-start-1 lg:mt-0"
      >
        {CHART_RANGES.map((range) => (
          <button
            key={range}
            type="button"
            aria-pressed={range === months}
            onClick={() => setMonths(range)}
            className={cn(
              "h-11 flex-1 rounded-2xl px-3 text-sm font-bold whitespace-nowrap",
              range === months && "bg-white shadow-[0_1px_3px_rgb(0_0_0/0.12)]",
            )}
          >
            {range === 1 ? "1 mes" : `${range} meses`}
          </button>
        ))}
      </div>
      <div className="lg:col-span-2">
        <PriceChart {...chart} width={350} height={190} className="mt-3 lg:hidden" />
        <PriceChart {...chart} width={760} height={240} className="mt-5 hidden lg:block" />
      </div>
    </div>
  );
}
