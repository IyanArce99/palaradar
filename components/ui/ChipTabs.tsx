"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

export interface ChipTab {
  id: string;
  label: string;
  /** Contenido de la pestaña, ya pintado en el servidor */
  content: React.ReactNode;
}

interface ChipTabsProps {
  /** Nombre accesible del grupo de pestañas */
  label: string;
  tabs: ChipTab[];
  /** Se llama al cambiar de pestaña (analítica) */
  onSelect?: (id: string) => void;
  className?: string;
}

/**
 * Pestañas en forma de chips con desplazamiento horizontal en móvil. Todo el
 * contenido llega pintado: aquí solo se decide cuál se ve. Con las flechas se
 * pasa de una pestaña a otra, como en cualquier lista de pestañas.
 */
export function ChipTabs({ label, tabs, onSelect, className }: ChipTabsProps) {
  const base = useId();
  const [active, setActive] = useState(tabs[0]?.id);
  if (tabs.length === 0) return null;

  const select = (id: string) => {
    setActive(id);
    onSelect?.(id);
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    select(next.id);
    document.getElementById(`${base}-tab-${next.id}`)?.focus();
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            id={`${base}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={tab.id === active}
            aria-controls={`${base}-panel-${tab.id}`}
            tabIndex={tab.id === active ? 0 : -1}
            onClick={() => select(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "h-11 flex-none rounded-full border px-4 text-sm font-bold whitespace-nowrap",
              tab.id === active ? "border-carbon bg-carbon text-white" : "border-line bg-white text-carbon hover:border-carbon",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${base}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={tab.id !== active}
          className="mt-4"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
