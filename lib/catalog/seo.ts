import { routes } from "@/lib/routes";
import { hasCatalogFilters, pageHref, type CatalogQuery } from "./query";

export interface ListingSeo {
  /** URL canónica; null si la página no debe declarar ninguna */
  canonical: string | null;
  index: boolean;
}

/**
 * Política de indexación del catálogo, pensada para 1.000–2.000 palas:
 *
 * - Sin filtros: indexable. Cada página (?pagina=N) es canónica de sí misma;
 *   no se canoniza a la página 1 porque su contenido es distinto.
 * - Solo una marca: canónica a la página de marca (/palas-padel/{marca}/), que
 *   es la que debe posicionar.
 * - Cualquier otro filtro, orden o búsqueda: noindex, follow y sin canónica.
 *   Son combinaciones infinitas de un contenido que ya está indexado.
 */
export function catalogSeo(query: CatalogQuery): ListingSeo {
  if (!hasCatalogFilters(query)) {
    return { canonical: pageHref(routes.catalog, query.page), index: true };
  }

  const isSingleBrand =
    query.brands.length === 1 && !hasCatalogFilters({ ...query, brands: [] });
  if (isSingleBrand) {
    return { canonical: pageHref(routes.brand(query.brands[0]), query.page), index: true };
  }

  return { canonical: null, index: false };
}

/** " · página 2" para títulos y descripciones de páginas paginadas. */
export function pageSuffix(page: number): string {
  return page > 1 ? ` · página ${page}` : "";
}
