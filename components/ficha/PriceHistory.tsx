"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { PricePoint } from "@/types/catalog";
import type { PriceSummary } from "@/types/pricing";
import { PriceChart } from "./PriceChart";

const RANGES = [3, 6, 12] as const;

interface PriceHistoryProps {
  /** Titular de la sección; el selector de rango se alinea con él en escritorio */
  title: React.ReactNode;
  /** Texto entre el titular y el gráfico */
  children: React.ReactNode;
  history: PricePoint[];
  price: PriceSummary;
}

/**
 * Histórico de precio. El selector de rango (3 / 6 / 12 meses) es de la ficha
 * de escritorio; en móvil el diseño muestra el gráfico sin selector.
 */
export function PriceHistory({ title, children, history, price }: PriceHistoryProps) {
  const [months, setMonths] = useState<(typeof RANGES)[number]>(12);
  const chart = { history, price, months };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:gap-x-5">
      {title}
      <div className="lg:col-span-2 lg:row-start-2">{children}</div>
      <div
        role="group"
        aria-label="Periodo del histórico"
        className="hidden gap-1 rounded-xl bg-mist p-1 lg:col-start-2 lg:row-start-1 lg:flex"
      >
        {RANGES.map((range) => (
          <button
            key={range}
            type="button"
            aria-pressed={range === months}
            onClick={() => setMonths(range)}
            className={cn(
              "h-[38px] flex-1 rounded-[9px] px-3 text-[13px] font-bold whitespace-nowrap",
              range === months && "bg-white shadow-[0_1px_3px_rgb(0_0_0/0.12)]",
            )}
          >
            {range} meses
          </button>
        ))}
      </div>
      <div className="lg:col-span-2">
        <PriceChart history={history} price={price} months={12} width={350} height={190} className="mt-4 lg:hidden" />
        <PriceChart {...chart} width={760} height={240} className="mt-[18px] hidden lg:block" />
      </div>
    </div>
  );
}
