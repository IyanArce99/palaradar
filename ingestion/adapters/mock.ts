import type { StoreAdapter, StoreListing, StoreShipping } from "../types";

// Adaptador de PRUEBA con datos ficticios: no llama a ninguna tienda. Sirve para
// ejercitar el flujo completo y como plantilla de los adaptadores reales.

export const MOCK_STORE_SLUG = "tienda-demo-1";
export const MOCK_SHIPPING: StoreShipping = { cost: 3.95, freeFrom: 50 };

/** GTIN reales de dos palas del catálogo, para probar el emparejamiento por EAN. */
export const GTIN_METALBONE_34_2025 = "8435739402740";
export const GTIN_VERTEX_04_2025 = "8445402691890";
/** GTIN válido de otra pala (Vertex 05 2026), que no está en el catálogo. */
export const GTIN_VERTEX_05_2026 = "8445402973996";

/** Adaptador que devuelve los listados que se le pasen, o falla si se le indica. */
export function createMockAdapter(
  listings: StoreListing[],
  options: { fail?: string; shipping?: StoreShipping; storeSlug?: string } = {},
): StoreAdapter {
  return {
    store: {
      slug: options.storeSlug ?? MOCK_STORE_SLUG,
      name: "Tienda de prueba",
      url: "https://example.com",
    },
    shipping: options.shipping ?? MOCK_SHIPPING,
    async fetchProducts() {
      if (options.fail) throw new Error(options.fail);
      return listings;
    },
  };
}

function listing(checkedAt: string, fields: Partial<StoreListing> & Pick<StoreListing, "externalId" | "title" | "price">): StoreListing {
  return {
    brand: null,
    ean: null,
    url: `https://example.com/producto/${fields.externalId}`,
    listPrice: null,
    available: true,
    checkedAt,
    ...fields,
  };
}

/**
 * Dos lecturas consecutivas del catálogo de la tienda ficticia. Entre las dos
 * cubren: producto nuevo, producto ya existente, sin EAN, EAN coincidente, EAN
 * distinto, agotado, desaparecido y cambio de precio.
 */
export function mockScenario(firstCheckedAt: string, secondCheckedAt: string) {
  const metalbone = { externalId: "MB34", title: "Pala Adidas Metalbone 3.4 2025", brand: "Adidas", ean: GTIN_METALBONE_34_2025, listPrice: 390 };
  const equation = { externalId: "EQ27", title: "Pala Nox Equation Hard Advanced 2027", brand: "Nox", price: 112.95 };

  return {
    firstRun: [
      // EAN coincidente con el catálogo → emparejado por EAN
      listing(firstCheckedAt, { ...metalbone, price: 249.95 }),
      // Sin EAN → emparejado por marca, modelo y año
      listing(firstCheckedAt, equation),
      // EAN válido pero distinto al de nuestra Vertex 04 → nunca se empareja
      listing(firstCheckedAt, { externalId: "V04", title: "Pala Bullpadel Vertex 04 2025", brand: "Bullpadel", ean: GTIN_VERTEX_05_2026, price: 199.95 }),
      // Agotado → emparejado, pero no se publica
      listing(firstCheckedAt, { externalId: "KYRA", title: "Pala StarVie Kyra 2027", brand: "StarVie", price: 89.95, available: false }),
      // Desaparecerá en la segunda lectura
      listing(firstCheckedAt, { externalId: "DRAX", title: "Pala StarVie Drax + 2027", brand: "StarVie", price: 184.95 }),
    ],
    secondRun: [
      // Producto ya existente, con cambio de precio
      listing(secondCheckedAt, { ...metalbone, price: 229.95 }),
      // Producto ya existente, sin cambios
      listing(secondCheckedAt, equation),
      listing(secondCheckedAt, { externalId: "V04", title: "Pala Bullpadel Vertex 04 2025", brand: "Bullpadel", ean: GTIN_VERTEX_05_2026, price: 199.95 }),
      listing(secondCheckedAt, { externalId: "KYRA", title: "Pala StarVie Kyra 2027", brand: "StarVie", price: 89.95, available: false }),
      // Producto nuevo
      listing(secondCheckedAt, { externalId: "FENIX", title: "Pala Siux Fenix Pro 2026", brand: "Siux", price: 289.95 }),
    ],
  };
}
