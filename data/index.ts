export * from "./catalog";

/**
 * true mientras el catálogo se sirva desde `mock/`. La interfaz lo usa para
 * avisar de que opiniones, precios y tiendas son de ejemplo, y el SEO para no
 * publicar valoraciones ni ofertas ficticias como datos estructurados.
 */
export const isDemoData = true;
