"use client";

import { useState } from "react";
import { formatEuroCompact } from "@/lib/format";

interface PriceRangeProps {
  name: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

/** Deslizador de precio máximo. En el tope equivale a no filtrar por precio. */
export function PriceRange({ name, min, max, step, defaultValue }: PriceRangeProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="border-t border-line py-3.5">
      <div className="flex justify-between text-[15px] font-extrabold">
        <label htmlFor="filtro-precio">Precio</label>
        <output htmlFor="filtro-precio" className="font-semibold text-muted">
          {value >= max ? "cualquiera" : `hasta ${formatEuroCompact(value)}`}
        </output>
      </div>
      <input
        id="filtro-precio"
        type="range"
        // En el tope no se envía: así la URL no arrastra un filtro que no filtra.
        name={value < max ? name : undefined}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        className="mt-2.5 h-7 w-full accent-carbon"
      />
    </div>
  );
}
