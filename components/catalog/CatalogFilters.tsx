import Form from "next/form";
import { buttonClass } from "@/components/ui/Button";
import { DisclosureMarker } from "@/components/ui/DisclosureMarker";
import type { CatalogFacets } from "@/data";
import { COVERAGE_LABELS, PARAMS, type CatalogQuery } from "@/lib/catalog/query";
import { BALANCE_LABELS, LEVEL_LABELS, SHAPE_LABELS, STYLE_LABELS } from "@/lib/labels";
import { routes } from "@/lib/routes";
import { AutoSubmit } from "./AutoSubmit";
import { PriceRange } from "./PriceRange";

const PRICE_SLIDER_MIN = 50;
const PRICE_SLIDER_STEP = 10;

interface Option {
  value: string;
  label: string;
}

interface FilterGroupProps {
  title: string;
  name: string;
  options: Option[];
  selected: string[];
  /** Abierto aunque no tenga nada seleccionado */
  defaultOpen?: boolean;
}

function FilterGroup({ title, name, options, selected, defaultOpen = false }: FilterGroupProps) {
  if (options.length === 0) return null;

  return (
    <details open={defaultOpen || selected.length > 0} className="group border-t border-line">
      <summary className="flex min-h-[50px] items-center justify-between text-[15px] font-extrabold">
        {title}
        <DisclosureMarker />
      </summary>
      <div className="pb-3.5">
        {options.map((option) => (
          <label key={option.value} className="flex min-h-11 items-center gap-2.5 text-sm lg:min-h-9">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selected.includes(option.value)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="grid size-5 place-items-center rounded-md border-2 border-carbon text-xs text-transparent peer-checked:bg-carbon peer-checked:text-lime peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-carbon"
            >
              ✓
            </span>
            {option.label}
          </label>
        ))}
      </div>
    </details>
  );
}

function toOptions<T extends string>(labels: Record<T, string>): Option[] {
  return Object.entries<string>(labels).map(([value, label]) => ({ value, label }));
}

interface CatalogFiltersProps {
  formId: string;
  query: CatalogQuery;
  facets: CatalogFacets;
  total: number;
  /** id del interruptor que abre y cierra el panel en móvil */
  toggleId: string;
}

/**
 * Filtros del catálogo. Es un formulario GET: cada filtro es un parámetro de
 * la URL, así que los resultados se renderizan en servidor y son enlazables.
 */
export function CatalogFilters({ formId, query, facets, total, toggleId }: CatalogFiltersProps) {
  return (
    <AutoSubmit>
      <Form id={formId} action={routes.catalog} scroll={false} aria-label="Filtrar palas">
        <h2 className="mb-1.5 text-base font-black">Filtrar</h2>

        {query.q && <input type="hidden" name={PARAMS.q} value={query.q} />}
        {query.collection !== "todas" && (
          <input type="hidden" name={PARAMS.collection} value={query.collection} />
        )}

        <FilterGroup
          title="Nivel"
          name={PARAMS.level}
          options={toOptions(LEVEL_LABELS)}
          selected={query.levels}
          defaultOpen
        />
        <PriceRange
          name={PARAMS.maxPrice}
          min={PRICE_SLIDER_MIN}
          max={facets.priceCeiling}
          step={PRICE_SLIDER_STEP}
          defaultValue={query.maxPrice ?? facets.priceCeiling}
        />
        <FilterGroup
          title="Precio disponible"
          name={PARAMS.coverage}
          options={toOptions(COVERAGE_LABELS)}
          selected={query.coverage}
          defaultOpen
        />
        <FilterGroup
          title="Marca"
          name={PARAMS.brand}
          options={facets.brands.map((brand) => ({ value: brand.slug, label: brand.name }))}
          selected={query.brands}
        />
        <FilterGroup
          title="Estilo de juego"
          name={PARAMS.style}
          options={toOptions(STYLE_LABELS)}
          selected={query.styles}
        />
        <FilterGroup
          title="Forma"
          name={PARAMS.shape}
          options={toOptions(SHAPE_LABELS)}
          selected={query.shapes}
        />
        <FilterGroup
          title="Balance"
          name={PARAMS.balance}
          options={toOptions(BALANCE_LABELS)}
          selected={query.balances}
        />
        <FilterGroup
          title="Año"
          name={PARAMS.year}
          options={facets.years.map((year) => ({ value: String(year), label: String(year) }))}
          selected={query.years.map(String)}
        />

        <div className="mt-2 grid gap-2 border-t border-line pt-4">
          <noscript>
            <button type="submit" className={buttonClass({ variant: "dark", className: "w-full" })}>
              Aplicar filtros
            </button>
          </noscript>
          <label
            htmlFor={toggleId}
            className={buttonClass({ variant: "outline", className: "w-full cursor-pointer lg:hidden" })}
          >
            Ver {total} {total === 1 ? "pala" : "palas"}
          </label>
        </div>
      </Form>
    </AutoSubmit>
  );
}
