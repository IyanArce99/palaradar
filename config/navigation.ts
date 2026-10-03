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
];

export interface TabItem extends NavItem {
  /** Prefijos de ruta que activan la pestaña */
  match: string[];
}

export const mobileTabs: TabItem[] = [
  { label: "Inicio", href: routes.home, match: [] },
  { label: "Catálogo", href: routes.catalog, match: ["/palas-padel", "/pala"] },
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
}

/** Accesos al catálogo por necesidad: "Descubre tu próxima pala" y pie. */
export const catalogShortcuts: CatalogShortcut[] = [
  { label: "Para empezar", shortLabel: "Para empezar", query: { levels: ["iniciacion"] } },
  { label: "Si buscas control", shortLabel: "De control", query: { styles: ["control"] } },
  { label: "Si buscas potencia", shortLabel: "De potencia", query: { styles: ["potencia"] } },
  { label: "Menos de 150 €", shortLabel: "Menos de 150 €", query: { maxPrice: 150 } },
];
