// Escenario de referencia de la ingestión: cuatro lecturas seguidas de una
// tienda que cubren todas las reglas (alta, EAN, vetos, agotado, desaparición,
// bajada anómala retenida y confirmada, duplicados y datos no válidos).
//
// Su resultado está guardado en golden/ingestion.json, generado con la
// ingestión ANTERIOR a las escrituras por lotes (una consulta por producto).
// Cualquier cambio en la ingestión debe seguir produciendo exactamente eso.
import { GTIN_METALBONE_34_2025, GTIN_VERTEX_05_2026, mockScenario } from "@/ingestion/adapters/mock";
import type { MemoryIngestionState } from "@/ingestion/memory-repository";
import type { RunSummary, StoreListing } from "@/ingestion/types";

export const GOLDEN_DAYS = [
  new Date("2026-10-05T06:00:00Z"),
  new Date("2026-10-06T06:00:00Z"),
  new Date("2026-10-07T06:00:00Z"),
  new Date("2026-10-08T06:00:00Z"),
];

function listing(at: Date, fields: Partial<StoreListing> & Pick<StoreListing, "externalId" | "title" | "price">): StoreListing {
  return {
    brand: null,
    ean: null,
    url: `https://example.com/producto/${fields.externalId}`,
    listPrice: null,
    available: true,
    checkedAt: at.toISOString(),
    ...fields,
  };
}

/** Los listados de cada una de las cuatro lecturas. */
export function goldenRuns(): StoreListing[][] {
  const [day1, day2, day3, day4] = GOLDEN_DAYS;
  const base = mockScenario(day1.toISOString(), day2.toISOString());
  const metalbone = { externalId: "MB34", title: "Pala Adidas Metalbone 3.4 2025", brand: "Adidas", ean: GTIN_METALBONE_34_2025 };
  const equation = { externalId: "EQ27", title: "Pala Nox Equation Hard Advanced 2027", brand: "Nox" };
  const vertex = { externalId: "V04", title: "Pala Bullpadel Vertex 04 2025", brand: "Bullpadel", ean: GTIN_VERTEX_05_2026, price: 199.95 };
  const fenix = { externalId: "FENIX", title: "Pala Siux Fenix Pro 2026", brand: "Siux" };

  return [
    base.firstRun,
    base.secondRun,
    [
      // Bajada de más del 40 %: se retiene.
      listing(day3, { ...metalbone, price: 99.95 }),
      // Segundo producto de la misma pala, más caro.
      listing(day3, { ...metalbone, externalId: "MB34-B", price: 239.95 }),
      // Subida de precio.
      listing(day3, { ...equation, price: 119.95 }),
      listing(day3, vertex),
      // Vuelve a haber stock.
      listing(day3, { externalId: "KYRA", title: "Pala StarVie Kyra 2027", brand: "StarVie", price: 84.95 }),
      // El mismo producto dos veces en la misma lectura: vale el último.
      listing(day3, { ...fenix, price: 289.95 }),
      listing(day3, { ...fenix, price: 279.95 }),
      // Sin año: queda en revisión.
      listing(day3, { externalId: "EQ-SIN", title: "Pala Nox Equation Hard Advanced", brand: "Nox", price: 105 }),
      // Pack: nunca se empareja.
      listing(day3, { externalId: "PACK", title: "Pack Pala Siux Fenix Pro 2026 + Paletero", brand: "Siux", price: 310 }),
      // Datos no válidos: se descartan.
      listing(day3, { externalId: "CERO", title: "Pala Siux Fenix Pro 2026", brand: "Siux", price: 0 }),
      listing(day3, { externalId: "USD", title: "Pala Siux Fenix Pro 2026", brand: "Siux", price: 250, currency: "USD" }),
      // DRAX falta por segunda vez: desaparecido.
    ],
    [
      // La bajada se confirma.
      listing(day4, { ...metalbone, price: 99.95 }),
      // MB34-B y EQ27 faltan por primera vez: conservan su precio.
      listing(day4, vertex),
      // Agotado de nuevo.
      listing(day4, { externalId: "KYRA", title: "Pala StarVie Kyra 2027", brand: "StarVie", price: 84.95, available: false }),
      listing(day4, { ...fenix, price: 279.95 }),
      // Reaparece.
      listing(day4, { externalId: "DRAX", title: "Pala StarVie Drax + 2027", brand: "StarVie", price: 179.95 }),
    ],
  ];
}

export interface GoldenResult {
  summaries: Omit<RunSummary, "finishedAt">[];
  storeProducts: MemoryIngestionState["storeProducts"];
  publishedPrices: MemoryIngestionState["publishedPrices"];
  priceHistory: MemoryIngestionState["priceHistory"];
  statsRefreshes: number;
}

const byKey = <T>(key: (item: T) => string) => (a: T, b: T) => key(a).localeCompare(key(b));

/** Resultado comparable de una serie de ejecuciones: sin la hora de fin y en orden estable. */
export function goldenResult(summaries: RunSummary[], state: MemoryIngestionState): GoldenResult {
  return {
    summaries: summaries.map((summary) => {
      const comparable: Partial<RunSummary> = { ...summary };
      delete comparable.finishedAt;
      return comparable as Omit<RunSummary, "finishedAt">;
    }),
    storeProducts: [...state.storeProducts].sort(byKey((product) => product.externalId)),
    publishedPrices: [...state.publishedPrices].sort(byKey((price) => price.racketId)),
    priceHistory: [...state.priceHistory].sort(byKey((row) => `${row.racket_id} ${row.price_date}`)),
    statsRefreshes: state.statsRefreshes,
  };
}
