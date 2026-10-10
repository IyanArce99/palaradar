// Informes basados en los datos del catálogo. Cada informe es un cálculo sobre
// lo que hay hoy en la base de datos, con su método a la vista. No son estudios
// de mercado: PalaRadar sigue unas pocas tiendas y lo dice en cada informe.
//
// Aquí solo hay cálculo y textos derivados de cifras; qué datos se leen está en
// data/reports.ts y cómo se pintan, en app/informes/.
import { COMPARABLE_STORES } from "@/lib/catalog/query";
import { formatDate, formatEuroCompact, pluralize } from "@/lib/format";
import { median } from "@/lib/price-stats";
import { NEGLIGIBLE_SPREAD_EUROS, storeSpread, toCents, type StoreSpread } from "@/lib/store-spread";
import type { PalaSummary, StoreOffer } from "@/types/catalog";

export interface ReportDefinition {
  slug: string;
  title: string;
  /** Una frase que dice qué responde */
  lead: string;
  /** Descripción para buscadores */
  description: string;
  /** Qué significa cada cifra del informe */
  metrics: { name: string; meaning: string }[];
  /** Lo que el informe NO permite concluir */
  limitations: string[];
}

export const REPORTS: ReportDefinition[] = [
  {
    slug: "diferencias-entre-tiendas",
    title: "Diferencias de precio entre tiendas",
    lead: "Cuánto cambia hoy el precio de una misma pala según la tienda en la que se compre.",
    description:
      "Diferencia de precio entre tiendas para cada pala de pádel con precio en dos tiendas o más: importe, porcentaje y tienda con el precio más bajo, con los precios de hoy.",
    metrics: [
      { name: "Diferencia", meaning: "El precio más alto menos el más bajo de la misma pala, entre las tiendas que la tienen hoy." },
      { name: "Porcentaje", meaning: "Esa diferencia dividida entre el precio más alto: lo que se paga de menos con el precio más bajo respecto al más alto." },
      { name: "Base", meaning: "Si todas las tiendas tienen el envío verificado se compara el total con envío; si no, el precio de la pala sin envío." },
    ],
    limitations: [
      "Solo entran las palas con precio vigente en dos tiendas o más; el resto no se puede comparar.",
      "Donde el envío no está verificado, la diferencia es del precio de la pala: el coste final puede cambiar el resultado.",
      "No incluye cupones, códigos de descuento ni precios para socios.",
      "Una diferencia muy grande merece una comprobación: abre las dos tiendas y confirma que venden la misma edición y el mismo color antes de darla por buena.",
    ],
  },
  {
    slug: "ediciones-anteriores",
    title: "Ediciones anteriores más baratas",
    lead: "Modelos de los que hay a la venta más de una temporada, y cuánto cuesta hoy cada una.",
    description:
      "Palas de pádel con más de una temporada a la venta: diferencia de precio de hoy entre la edición reciente y la anterior, y qué características declaradas cambian.",
    metrics: [
      { name: "Diferencia", meaning: "El precio de hoy de la edición anterior menos el de la más reciente del mismo modelo." },
      { name: "Qué cambia", meaning: "Las características que las dos ediciones declaran y no coinciden. Lo que solo declara una no se compara." },
    ],
    limitations: [
      "Dos ediciones se relacionan por tener la misma marca y el mismo nombre de modelo. Es una regla nuestra, no una confirmación del fabricante.",
      "Que una edición sea anterior o más barata no dice que sea mejor ni peor: solo se comparan precios y datos declarados.",
      "Solo entran los modelos con precio vigente en al menos dos temporadas.",
    ],
  },
  {
    slug: "cobertura-de-precios",
    title: "Cobertura de precios por marca",
    lead: "De cuántas palas de cada marca tenemos precio hoy, y de cuántas en más de una tienda.",
    description:
      "Cobertura de precios de PalaRadar por marca: cuántas palas de pádel tienen precio hoy, en cuántas tiendas y cuántas tienen foto real.",
    metrics: [
      { name: "Con precio", meaning: "Palas con precio vigente en al menos una de las tiendas que seguimos." },
      { name: `En ${COMPARABLE_STORES} tiendas`, meaning: "Palas con precio vigente en dos tiendas o más: las únicas en las que se puede comparar entre tiendas." },
      { name: "Con foto", meaning: "Palas con una foto real publicada; las demás se muestran con una ilustración." },
    ],
    limitations: [
      "Mide lo que PalaRadar conoce, no lo que hay en el mercado: una pala sin precio aquí puede estar a la venta en una tienda que no seguimos.",
      "Una marca con poca cobertura no es una marca con poca oferta.",
    ],
  },
  {
    slug: "palas-por-presupuesto",
    title: "Palas con precio confirmado por presupuesto",
    lead: "Cuántas palas se pueden comprar hoy por debajo de cada tope de precio.",
    description:
      "Cuántas palas de pádel tienen hoy un precio confirmado por debajo de 100, 150 y 200 euros en las tiendas que sigue PalaRadar, por forma.",
    metrics: [
      { name: "Palas", meaning: "Palas cuyo mejor precio vigente, en alguna tienda, no supera el tope." },
      { name: "Acumulado", meaning: "Cada tramo incluye los anteriores: «hasta 150 €» cuenta también las de menos de 100 €." },
    ],
    limitations: [
      "El precio es el de la pala; donde el envío no está verificado no se incluye.",
      "Solo cuentan las palas con precio vigente. Las que no tienen precio no aparecen en ningún tramo.",
    ],
  },
];

export function getReport(slug: string): ReportDefinition | null {
  return REPORTS.find((report) => report.slug === slug) ?? null;
}

// --- Método común ----------------------------------------------------------------

export interface PriceSource {
  name: string;
  /** Precios vigentes publicados de esa tienda */
  prices: number;
  /** Primer día con histórico de esa tienda (YYYY-MM-DD); null si no hay */
  since: string | null;
  /** Última comprobación de un precio de esa tienda (ISO con hora); null si no hay */
  lastCheckedAt: string | null;
}

export interface Methodology {
  /** Tiendas de las que salen los precios */
  stores: string;
  /** Periodo que cubren los datos */
  period: string;
  /** Cuándo se generó el informe */
  updated: string;
  /** Aviso de alcance, siempre presente */
  scope: string;
}

function names(list: string[]): string {
  return list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} y ${list.at(-1)}`;
}

/** Qué datos usa un informe, de qué tiendas y de cuándo. Sin tiendas, lo dice. */
export function methodology(sources: PriceSource[], now: Date): Methodology {
  const active = sources.filter((source) => source.prices > 0);
  const since = active.flatMap((source) => (source.since ? [source.since] : [])).sort((a, b) => a.localeCompare(b))[0];
  const today = now.toISOString().slice(0, 10);

  return {
    stores:
      active.length === 0
        ? "Ahora mismo no hay ninguna tienda con precios vigentes."
        : `${names(active.map((source) => `${source.name} (${pluralize(source.prices, "precio", "precios")})`))}.`,
    period: since
      ? `Precios vigentes a ${formatDate(today)}. El seguimiento de precios empezó el ${formatDate(since)}.`
      : `Precios vigentes a ${formatDate(today)}.`,
    updated: `Calculado el ${formatDate(today)} con los precios publicados en ese momento. Se recalcula cada hora.`,
    scope: `PalaRadar sigue ${pluralize(active.length, "tienda", "tiendas")}: estas cifras describen esas tiendas, no el mercado.`,
  };
}

// --- Diferencias entre tiendas ------------------------------------------------------

export interface SpreadRow {
  pala: PalaSummary;
  spread: StoreSpread;
}

export interface SpreadReport {
  rows: SpreadRow[];
  /** Palas comparadas (con precio vigente en dos tiendas o más) */
  compared: number;
  /** Palas en las que las tiendas piden prácticamente lo mismo */
  samePrice: number;
  /** Diferencia mediana, en euros; null sin palas comparadas */
  median: number | null;
  /** Cuántas veces es la más barata cada tienda, de más a menos */
  cheapestByStore: { store: string; count: number }[];
  /** Palas cuya comparación es solo del precio de la pala (algún envío sin verificar) */
  productBasis: number;
}

/** Diferencia entre tiendas de cada pala comparable, de mayor a menor. */
export function spreadReport(items: { pala: PalaSummary; offers: StoreOffer[] }[], now: Date): SpreadReport {
  const rows = items
    .flatMap(({ pala, offers }): SpreadRow[] => {
      const spread = storeSpread(offers, now);
      return spread ? [{ pala, spread }] : [];
    })
    .sort(
      (a, b) =>
        toCents(b.spread.difference) - toCents(a.spread.difference) ||
        b.spread.percent - a.spread.percent ||
        a.pala.slug.localeCompare(b.pala.slug),
    );

  const medianCents = median(rows.map((row) => toCents(row.spread.difference)));
  const wins = new Map<string, number>();
  for (const row of rows) {
    if (row.spread.difference < NEGLIGIBLE_SPREAD_EUROS) continue;
    const store = row.spread.cheapest.store.name;
    wins.set(store, (wins.get(store) ?? 0) + 1);
  }

  return {
    rows,
    compared: rows.length,
    samePrice: rows.filter((row) => row.spread.difference < NEGLIGIBLE_SPREAD_EUROS).length,
    median: medianCents === null ? null : Math.round(medianCents) / 100,
    cheapestByStore: [...wins.entries()]
      .map(([store, count]) => ({ store, count }))
      .sort((a, b) => b.count - a.count || a.store.localeCompare(b.store)),
    productBasis: rows.filter((row) => row.spread.basis === "producto").length,
  };
}

/** Resumen en frases de las diferencias entre tiendas; cada frase lleva su cifra. */
export function spreadSummary(report: SpreadReport): string[] {
  if (report.compared === 0) {
    return ["Hoy no hay ninguna pala con precio vigente en dos tiendas: no hay nada que comparar."];
  }
  const sentences = [
    `Hoy se pueden comparar ${pluralize(report.compared, "pala", "palas")}: son las que tienen precio vigente en dos tiendas o más.`,
  ];
  if (report.median !== null) {
    sentences.push(`La diferencia mediana entre el precio más alto y el más bajo de una misma pala es de ${formatEuroCompact(report.median)}.`);
  }
  if (report.samePrice > 0) {
    sentences.push(`En ${pluralize(report.samePrice, "pala", "palas")} las tiendas piden prácticamente lo mismo.`);
  }
  if (report.cheapestByStore.length > 0) {
    const parts = report.cheapestByStore.map((item) => `${item.store} en ${item.count}`);
    sentences.push(`Tienda con el precio más bajo: ${names(parts)}.`);
  }
  if (report.productBasis > 0) {
    sentences.push(
      report.productBasis === report.compared
        ? "En todas se compara el precio de la pala, sin envío, porque hay gastos de envío sin verificar: el coste final puede cambiar qué tienda sale mejor."
        : `En ${pluralize(report.productBasis, "pala", "palas")} se compara el precio de la pala, sin envío, porque hay gastos de envío sin verificar.`,
    );
  }
  return sentences;
}

// --- Ediciones anteriores -----------------------------------------------------------

export interface SeasonPair {
  /** La edición más reciente del modelo con precio */
  newer: PalaSummary;
  /** Una edición anterior con precio */
  older: PalaSummary;
  /** Precio de la anterior menos el de la reciente, en euros (negativo: la anterior es más barata) */
  difference: number;
  /** La diferencia sobre el precio de la edición reciente, en tanto por ciento */
  percent: number;
}

/**
 * De cada modelo con varias temporadas a la venta, la edición más reciente
 * frente a cada anterior. Primero las anteriores más baratas, de mayor a menor
 * ahorro. Las palas sin precio no forman pareja.
 */
export function seasonPairs(groups: PalaSummary[][]): SeasonPair[] {
  return groups
    .flatMap((group): SeasonPair[] => {
      const priced = group.filter((pala) => pala.price !== null).sort((a, b) => b.year - a.year || a.slug.localeCompare(b.slug));
      const [newer, ...rest] = priced;
      if (!newer || newer.price === null) return [];
      return rest
        .filter((older) => older.year < newer.year && older.price !== null)
        .map((older) => {
          const cents = toCents(older.price as number) - toCents(newer.price as number);
          return {
            newer,
            older,
            difference: cents / 100,
            percent: Math.round((cents * 1000) / toCents(newer.price as number)) / 10,
          };
        });
    })
    .sort((a, b) => a.difference - b.difference || a.older.slug.localeCompare(b.older.slug));
}

// --- Cobertura -----------------------------------------------------------------------

export interface CoverageRow {
  brand: { slug: string; name: string };
  total: number;
  priced: number;
  multiStore: number;
  withPhoto: number;
  /** Tanto por ciento de sus palas con precio, con un decimal */
  pricedPercent: number;
}

export interface CoverageReport {
  rows: CoverageRow[];
  totals: Omit<CoverageRow, "brand">;
  /** Marcas sin ninguna pala con precio */
  withoutPrice: string[];
}

const share = (count: number, total: number) => (total === 0 ? 0 : Math.round((count * 1000) / total) / 10);

/** Cobertura de precio por marca, de la que más palas con precio tiene a la que menos. */
export function coverageReport(brands: Omit<CoverageRow, "pricedPercent">[]): CoverageReport {
  const rows = brands
    .map((brand) => ({ ...brand, pricedPercent: share(brand.priced, brand.total) }))
    .sort((a, b) => b.priced - a.priced || b.total - a.total || a.brand.name.localeCompare(b.brand.name));
  const sum = (pick: (row: CoverageRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const total = sum((row) => row.total);
  const priced = sum((row) => row.priced);

  return {
    rows,
    totals: {
      total,
      priced,
      multiStore: sum((row) => row.multiStore),
      withPhoto: sum((row) => row.withPhoto),
      pricedPercent: share(priced, total),
    },
    withoutPrice: rows.filter((row) => row.priced === 0).map((row) => row.brand.name),
  };
}
