/**
 * Tiendas de PRUEBA para los precios seed. Son nombres ficticios: mientras no
 * haya precios reales no se atribuyen precios inventados a tiendas reales.
 */
export interface StoreSeed {
  slug: string;
  name: string;
  url: string;
}

export const storeSeeds: StoreSeed[] = [
  { slug: "tienda-demo-1", name: "Tienda demo 1", url: "https://example.com/tienda-demo-1" },
  { slug: "tienda-demo-2", name: "Tienda demo 2", url: "https://example.com/tienda-demo-2" },
  { slug: "tienda-demo-3", name: "Tienda demo 3", url: "https://example.com/tienda-demo-3" },
  { slug: "tienda-demo-4", name: "Tienda demo 4", url: "https://example.com/tienda-demo-4" },
  { slug: "tienda-demo-5", name: "Tienda demo 5", url: "https://example.com/tienda-demo-5" },
  { slug: "tienda-demo-6", name: "Tienda demo 6", url: "https://example.com/tienda-demo-6" },
];
