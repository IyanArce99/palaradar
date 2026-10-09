// Relación entre las consultas del catálogo y las colecciones (content/collections.ts).
import { collections, type Collection } from "@/content/collections";
import { routes } from "@/lib/routes";
import { catalogHref, DEFAULT_QUERY, type CatalogQuery } from "./query";

/** Los filtros que definen una consulta, sin orden, búsqueda ni paginación. */
function filterKey(query: Partial<CatalogQuery>): string {
  const q = { ...DEFAULT_QUERY, ...query };
  const list = (values: readonly (string | number)[]) => [...values].map(String).sort().join(",");
  return [
    q.collection,
    list(q.levels),
    list(q.styles),
    list(q.brands),
    list(q.shapes),
    list(q.balances),
    list(q.years),
    q.maxPrice ?? "",
  ].join("|");
}

const byFilter = new Map(collections.map((collection) => [filterKey(collection.query), collection]));

/**
 * La colección que corresponde exactamente a esos filtros, si la hay: sin
 * búsqueda y en el orden por defecto. Sirve para que el catálogo filtrado apunte
 * a la página de la colección, que es la que debe posicionar.
 */
export function collectionForQuery(query: CatalogQuery): Collection | null {
  if (query.q !== "" || query.sort !== DEFAULT_QUERY.sort) return null;
  return byFilter.get(filterKey(query)) ?? null;
}

/** Enlace a un listado con esos filtros: la página de su colección si existe; si no, el catálogo filtrado. */
export function listingHref(filters: Partial<CatalogQuery>): string {
  const collection = collectionForQuery({ ...DEFAULT_QUERY, ...filters });
  return collection ? routes.collection(collection.slug) : catalogHref(filters);
}

/** Colecciones a las que pertenece una pala, por sus datos declarados y su precio de hoy. */
export function collectionsForPala(pala: {
  shape: string;
  playStyle: string | null;
  levels: readonly string[];
  year: number;
  price: number | null;
}): Collection[] {
  return collections.filter(({ query }) => {
    if (query.shapes) return query.shapes.includes(pala.shape as never);
    if (query.styles) return pala.playStyle !== null && query.styles.includes(pala.playStyle as never);
    if (query.levels) return query.levels.some((level) => pala.levels.includes(level));
    if (query.years) return query.years.includes(pala.year);
    if (query.maxPrice != null) return pala.price !== null && pala.price <= query.maxPrice;
    return false;
  });
}
