import type { CatalogQuery } from "@/lib/catalog/query";
import { routes } from "@/lib/routes";

export interface NavItem {
  label: string;
  href: string;
}

export const mainNav: NavItem[] = [
  { label: "Palas", href: routes.catalog },
  { label: "Ofertas", href: routes.deals },
  { label: "Comparar", href: routes.compare },
  { label: "Guías", href: routes.guides },
  { label: "Pala ideal", href: routes.idealPala },
];

export interface TabItem extends NavItem {
  /** Prefijos de ruta que activan la pestaña */
  match: string[];
}

export const mobileTabs: TabItem[] = [
  { label: "Inicio", href: routes.home, match: [] },
  { label: "Catálogo", href: routes.catalog, match: ["/palas-padel", "/pala/"] },
  { label: "Ofertas", href: routes.deals, match: ["/ofertas"] },
  { label: "Comparar", href: routes.compare, match: ["/comparar"] },
  { label: "Guías", href: routes.guides, match: ["/guias"] },
];

export interface CatalogShortcut {
  /** Texto orientado a la necesidad ("Si buscas control") */
  label: string;
  /** Texto corto para listados ("De control") */
  shortLabel: string;
  query: Partial<CatalogQuery>;
  /** También aparece en «Palas por tipo» del pie */
  inFooter: boolean;
}

/**
 * Accesos al catálogo por necesidad: "Descubre tu próxima pala" y pie. Cada uno
 * es un filtro sobre datos declarados de la pala, no una valoración ni un consejo
 * de salud:
 *  · «Si buscas manejabilidad»: forma redonda y balance bajo.
 *  · «Máxima potencia»: forma diamante y balance alto.
 * El catálogo no filtra por peso, así que el peso no entra en estos accesos.
 */
export const catalogShortcuts: CatalogShortcut[] = [
  { label: "Para empezar", shortLabel: "Para empezar", query: { levels: ["iniciacion"] }, inFooter: true },
  { label: "Si buscas control", shortLabel: "De control", query: { styles: ["control"] }, inFooter: true },
  { label: "Si buscas potencia", shortLabel: "De potencia", query: { styles: ["potencia"] }, inFooter: true },
  {
    label: "Si buscas manejabilidad",
    shortLabel: "Manejables",
    query: { shapes: ["redonda"], balances: ["bajo"] },
    inFooter: false,
  },
  { label: "Menos de 150 €", shortLabel: "Menos de 150 €", query: { maxPrice: 150 }, inFooter: true },
  {
    label: "Máxima potencia",
    shortLabel: "Máxima potencia",
    query: { shapes: ["diamante"], balances: ["alto"] },
    inFooter: false,
  },
];

/** Marcas del pie, en el orden del diseño; el resto se alcanza desde el catálogo. */
export const footerBrandSlugs = [
  "bullpadel",
  "nox",
  "head",
  "adidas",
  "babolat",
  "siux",
  "starvie",
  "wilson",
];
