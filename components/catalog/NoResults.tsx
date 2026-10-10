import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { catalogHref } from "@/lib/catalog/query";
import { HISTORY_WINDOW_DAYS } from "@/lib/pricing";
import { routes } from "@/lib/routes";

interface NoResultsProps {
  /** Texto buscado, si la búsqueda venía del buscador */
  searchTerm: string;
  /** Modelos del catálogo que proponer: no hay datos de qué busca la gente */
  suggestions: string[];
  /** La colección «Mejor precio hoy» está vacía porque ninguna pala tiene aún 30 días de histórico */
  awaitingHistory?: boolean;
}

/** Estado vacío del catálogo: búsqueda o filtros sin resultados. */
export function NoResults({ searchTerm, suggestions, awaitingHistory = false }: NoResultsProps) {
  if (awaitingHistory) {
    return (
      <div className="max-w-[560px]">
        <h2 className="text-2xl leading-[1.1] font-black tracking-[-0.025em] text-balance">
          Todavía no hay palas en «Mejor precio hoy»
        </h2>
        <p className="mt-2 text-base leading-normal text-pretty text-ink">
          Aquí aparecen las palas cuyo precio está claramente por debajo de lo que han costado en
          los últimos {HISTORY_WINDOW_DAYS} días. Para decirlo hacen falta {HISTORY_WINDOW_DAYS}{" "}
          días de histórico de cada pala, y todavía no los tenemos.
        </p>
        <ButtonLink href={routes.catalog} variant="outline" className="mt-5">
          Ver todas las palas
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="max-w-[560px]">
      <h2 className="text-2xl leading-[1.1] font-black tracking-[-0.025em] text-balance">
        {searchTerm ? `No encontramos «${searchTerm}»` : "Ninguna pala cumple esos filtros"}
      </h2>
      <p className="mt-2 text-base leading-normal text-pretty text-ink">
        {searchTerm
          ? "Puede que esté mal escrito o que todavía no la tengamos en el catálogo."
          : "Prueba a quitar algún filtro o a subir el precio máximo."}
      </p>

      <ButtonLink href={routes.catalog} variant="outline" className="mt-5">
        Ver todas las palas
      </ButtonLink>

      {suggestions.length > 0 && (
        <>
          <h3 className="mt-7 mb-2.5 text-sm font-extrabold">Prueba con una de estas</h3>
          <ul className="flex flex-wrap gap-1.5">
            {suggestions.map((term) => (
              <li key={term}>
                <Link
                  href={catalogHref({ q: term })}
                  className="flex h-10 items-center rounded-full bg-mist px-3.5 text-sm font-semibold whitespace-nowrap hover:bg-line"
                >
                  {term}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
