"use client";

import { PARAMS, SORT_OPTIONS, type SortId } from "@/lib/catalog/query";

interface SortSelectProps {
  /** id del formulario de filtros al que pertenece */
  formId: string;
  value: SortId;
}

/** Orden del catálogo en móvil. Forma parte del formulario de filtros. */
export function SortSelect({ formId, value }: SortSelectProps) {
  return (
    <div className="relative">
      <select
        form={formId}
        name={PARAMS.sort}
        defaultValue={value}
        aria-label="Ordenar por"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-12 w-full appearance-none truncate rounded-2xl border-[1.5px] border-line bg-white pr-9 pl-4 text-sm font-extrabold"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-base font-extrabold"
      >
        ▾
      </span>
    </div>
  );
}
