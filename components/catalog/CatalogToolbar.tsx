import Link from "next/link";
import {
  catalogHref,
  COLLECTIONS,
  SORT_OPTIONS,
  type ActiveFilter,
  type CatalogQuery,
} from "@/lib/catalog/query";
import { cn } from "@/lib/cn";

interface QueryProps {
  query: CatalogQuery;
  className?: string;
}

/** Colecciones del catálogo: Todas, Palas en oferta, Mejor precio hoy… */
export function CollectionPills({ query, className }: QueryProps) {
  return (
    <nav aria-label="Colecciones" className={className}>
      <ul className="scrollbar-none flex gap-1.5 overflow-x-auto px-5 lg:gap-2 lg:px-12">
        {COLLECTIONS.map((collection) => {
          const active = collection.id === query.collection;
          return (
            <li key={collection.id} className="flex-none">
              <Link
                href={catalogHref({ ...query, collection: collection.id, page: 1 })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex h-11 items-center rounded-full border border-line px-3.5 text-[13px] font-bold whitespace-nowrap lg:h-[42px] lg:px-[18px] lg:text-sm",
                  active ? "bg-carbon text-white" : "bg-white text-carbon",
                )}
              >
                {collection.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Orden del catálogo en escritorio, como enlaces. */
export function SortPills({ query, className }: QueryProps) {
  return (
    <div className={cn("items-center gap-1 text-sm", className)}>
      <span className="mr-1.5 text-muted" id="orden-label">
        Ordenar:
      </span>
      <ul aria-labelledby="orden-label" className="flex gap-1">
        {SORT_OPTIONS.map((option) => {
          const active = option.id === query.sort;
          return (
            <li key={option.id}>
              <Link
                href={catalogHref({ ...query, sort: option.id, page: 1 })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex h-9 items-center rounded-full px-3 font-bold whitespace-nowrap",
                  active ? "bg-carbon text-white" : "text-carbon hover:bg-mist",
                )}
              >
                {option.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface ActiveFiltersProps {
  filters: ActiveFilter[];
  className?: string;
}

/** Filtros aplicados; cada uno enlaza al catálogo sin ese filtro. */
export function ActiveFilters({ filters, className }: ActiveFiltersProps) {
  if (filters.length === 0) return null;

  return (
    <ul aria-label="Filtros aplicados" className={cn("flex flex-wrap gap-1.5 text-[13px]", className)}>
      {filters.map((filter) => (
        <li key={filter.key}>
          <Link
            href={filter.href}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-mist px-3.5 hover:bg-line lg:min-h-9 lg:px-3"
          >
            {filter.label}
            <span aria-hidden="true">×</span>
            <span className="sr-only">(quitar filtro)</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

interface PaginationProps {
  page: number;
  pageCount: number;
  /** URL de cada página del listado */
  hrefFor: (page: number) => string;
  className?: string;
}

/** Páginas visibles: primera, última y las vecinas de la actual; null = hueco (…). */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  const visible = [1, page - 1, page, page + 1, pageCount].filter(
    (number, i, list) => number >= 1 && number <= pageCount && list.indexOf(number) === i,
  );
  visible.sort((a, b) => a - b);

  return visible.flatMap((number, i) =>
    i > 0 && number - visible[i - 1] > 1 ? [null, number] : [number],
  );
}

export function Pagination({ page, pageCount, hrefFor, className }: PaginationProps) {
  if (pageCount <= 1) return null;

  const itemClass = "grid size-11 place-items-center rounded-full font-bold";

  return (
    <nav aria-label="Paginación" className={className}>
      <ul className="flex flex-wrap justify-center gap-1.5">
        {pageWindow(page, pageCount).map((number, i) =>
          number === null ? (
            <li key={i === 1 ? "hueco-inicio" : "hueco-final"} aria-hidden="true" className={cn(itemClass, "text-muted")}>
              …
            </li>
          ) : (
            <li key={number}>
              <Link
                href={hrefFor(number)}
                aria-current={number === page ? "page" : undefined}
                aria-label={`Página ${number}`}
                className={cn(
                  itemClass,
                  number === page ? "bg-carbon text-white" : "border border-line hover:bg-mist",
                )}
              >
                {number}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
