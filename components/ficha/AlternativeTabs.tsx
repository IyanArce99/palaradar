"use client";

import { track } from "@/components/analytics/track";
import { ChipTabs, type ChipTab } from "@/components/ui/ChipTabs";
import { ANALYTICS_EVENTS } from "@/lib/analytics";

interface AlternativeTabsProps {
  /** Slug de la pala de la ficha */
  pala: string;
  tabs: ChipTab[];
  className?: string;
}

/** Pestañas de alternativas de la ficha: registra qué objetivo se consulta. */
export function AlternativeTabs({ pala, tabs, className }: AlternativeTabsProps) {
  return (
    <ChipTabs
      label="Tipo de alternativa"
      tabs={tabs}
      className={className}
      onSelect={(modo) => track(ANALYTICS_EVENTS.alternativeMode, { pala, modo })}
    />
  );
}
