// Informes basados en datos: cada cifra sale de lo que hay, el método va a la
// vista y ningún texto habla del mercado cuando solo se conocen unas tiendas.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRepository } from "@/data/memory-repository";
import {
  coverageReport,
  getReport,
  methodology,
  REPORTS,
  seasonPairs,
  spreadReport,
  spreadSummary,
  type PriceSource,
} from "@/lib/reports";
import type { PalaSummary, StoreOffer } from "@/types/catalog";

const NOW = new Date("2026-10-09T12:00:00Z");
const NBSP = " ";

function pala(slug: string, price: number | null, changes: Partial<PalaSummary> = {}): PalaSummary {
  return {
    id: slug,
    slug,
    brand: { slug: "marca", name: "Marca" },
    model: "Modelo",
    year: 2026,
    image: null,
    shape: "redonda",
    description: "",
    rating: 0,
    reviewCount: 0,
    price,
    previousPrice: null,
    dropPercent: null,
    storeCount: price === null ? 0 : 1,
    priceNote: null,
    priceRecent: true,
    ...changes,
  };
}

function offer(store: string, price: number, shipping: number | null = 0, hoursAgo = 1): StoreOffer {
  return {
    store: { id: store, slug: store, name: store, url: "" },
    price,
    shipping,
    previousPrice: null,
    availability: "En stock",
    url: null,
    checkedAt: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
  };
}

describe("definición de los informes", () => {
  it("cada uno explica sus métricas y sus límites", () => {
    assert.equal(new Set(REPORTS.map((report) => report.slug)).size, REPORTS.length);
    for (const report of REPORTS) {
      assert.match(report.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
      assert.ok(report.metrics.length >= 2, `${report.slug}: métricas`);
      assert.ok(report.limitations.length >= 2, `${report.slug}: límites`);
      assert.ok(report.description.length >= 80 && report.description.length <= 170, `${report.slug}: descripción`);
      assert.equal(getReport(report.slug), report);
    }
    assert.equal(getReport("no-existe"), null);
  });

  it("no usan «mejor», «ganadora» ni hablan en nombre del mercado", () => {
    const text = JSON.stringify(REPORTS);
    assert.doesNotMatch(text, /\bla mejor\b|\bganador[ae]?\b|\bchollo|\bganga/i);
    assert.doesNotMatch(text, /todo el mercado|todas las tiendas de España/i);
  });
});

describe("método", () => {
  const sources: PriceSource[] = [
    { name: "Tienda A", prices: 182, since: "2026-10-03", lastCheckedAt: "2026-10-09T10:00:00Z" },
    { name: "Tienda B", prices: 161, since: "2026-10-04", lastCheckedAt: "2026-10-09T10:00:00Z" },
    { name: "Tienda sin precios", prices: 0, since: null, lastCheckedAt: null },
  ];

  it("dice de qué tiendas, de cuándo y con qué alcance", () => {
    assert.deepEqual(methodology(sources, NOW), {
      stores: "Tienda A (182 precios) y Tienda B (161 precios).",
      period: "Precios vigentes a 9 de octubre de 2026. El seguimiento de precios empezó el 3 de octubre de 2026.",
      updated: "Calculado el 9 de octubre de 2026 con los precios publicados en ese momento. Se recalcula cada hora.",
      scope: "PalaRadar sigue 2 tiendas: estas cifras describen esas tiendas, no el mercado.",
    });
  });

  it("sin tiendas con precios lo dice, sin inventar un periodo", () => {
    const method = methodology([sources[2]], NOW);
    assert.equal(method.stores, "Ahora mismo no hay ninguna tienda con precios vigentes.");
    assert.equal(method.period, "Precios vigentes a 9 de octubre de 2026.");
    assert.match(method.scope, /sigue 0 tiendas/);
  });
});

describe("diferencias entre tiendas", () => {
  const items = [
    { pala: pala("grande", 180), offers: [offer("Tienda A", 180, null), offer("Tienda B", 220)] },
    { pala: pala("pequena", 150), offers: [offer("Tienda B", 150), offer("Tienda A", 155, null)] },
    { pala: pala("igual", 100), offers: [offer("Tienda A", 100, null), offer("Tienda B", 100.5)] },
    { pala: pala("una-tienda", 90), offers: [offer("Tienda A", 90)] },
    { pala: pala("caducada", 90), offers: [offer("Tienda A", 90), offer("Tienda B", 70, 0, 80)] },
  ];

  it("solo entran las palas con dos precios vigentes, de mayor a menor diferencia", () => {
    const report = spreadReport(items, NOW);
    assert.deepEqual(report.rows.map((row) => [row.pala.slug, row.spread.difference]), [
      ["grande", 40],
      ["pequena", 5],
      ["igual", 0.5],
    ]);
    assert.equal(report.compared, 3);
    assert.equal(report.samePrice, 1);
    assert.equal(report.median, 5);
    assert.equal(report.productBasis, 3);
    // La que piden casi lo mismo no cuenta como «más barata» de nadie.
    assert.deepEqual(report.cheapestByStore, [
      { store: "Tienda A", count: 1 },
      { store: "Tienda B", count: 1 },
    ]);
  });

  it("el resumen lleva sus cifras y avisa del envío sin verificar", () => {
    assert.deepEqual(spreadSummary(spreadReport(items, NOW)), [
      "Hoy se pueden comparar 3 palas: son las que tienen precio vigente en dos tiendas o más.",
      `La diferencia mediana entre el precio más alto y el más bajo de una misma pala es de 5${NBSP}€.`,
      "En 1 pala las tiendas piden prácticamente lo mismo.",
      "Tienda con el precio más bajo: Tienda A en 1 y Tienda B en 1.",
      "En todas se compara el precio de la pala, sin envío, porque hay gastos de envío sin verificar: el coste final puede cambiar qué tienda sale mejor.",
    ]);
  });

  it("con un número par de palas la mediana es la media de las dos centrales (R-01)", () => {
    // Diferencias de 40 € y 5 €: la mediana es 22,50 €, no 40 €.
    const report = spreadReport([items[0], items[1]], NOW);
    assert.equal(report.median, 22.5);
    assert.equal(spreadReport([items[0], items[1], items[2], items[3]], NOW).median, 5);
  });

  it("sin nada que comparar lo dice y no da cifras", () => {
    const report = spreadReport([items[3]], NOW);
    assert.equal(report.median, null);
    assert.deepEqual(spreadSummary(report), ["Hoy no hay ninguna pala con precio vigente en dos tiendas: no hay nada que comparar."]);
  });
});

describe("ediciones anteriores", () => {
  const edition = (year: number, price: number | null) => pala(`modelo-${year}`, price, { year });

  it("enfrenta la edición más reciente con precio con cada anterior con precio", () => {
    const pairs = seasonPairs([[edition(2026, 250), edition(2025, 200), edition(2024, 260), edition(2023, null)]]);
    assert.deepEqual(
      pairs.map((pair) => [pair.newer.year, pair.older.year, pair.difference, pair.percent]),
      [
        [2026, 2025, -50, -20],
        [2026, 2024, 10, 4],
      ],
    );
  });

  it("una edición anterior no siempre es más barata, y no se oculta", () => {
    const pairs = seasonPairs([[edition(2026, 150), edition(2025, 180)]]);
    assert.deepEqual([pairs[0].difference, pairs[0].percent], [30, 20]);
  });

  it("sin dos ediciones con precio no hay pareja", () => {
    assert.deepEqual(seasonPairs([[edition(2026, 250), edition(2025, null)]]), []);
    assert.deepEqual(seasonPairs([[edition(2026, null), edition(2025, 200)]]), []);
    assert.deepEqual(seasonPairs([[edition(2026, 250)]]), []);
    assert.deepEqual(seasonPairs([]), []);
  });

  it("ordena por ahorro de la edición anterior", () => {
    const a = [pala("a-2026", 300, { year: 2026 }), pala("a-2025", 280, { year: 2025 })];
    const b = [pala("b-2026", 200, { year: 2026 }), pala("b-2025", 120, { year: 2025 })];
    assert.deepEqual(seasonPairs([a, b]).map((pair) => pair.older.slug), ["b-2025", "a-2025"]);
  });

  it("los grupos del repositorio son un mismo modelo y marca en años distintos", async () => {
    const groups = await createMemoryRepository().getSeasonGroups();
    for (const group of groups) {
      assert.ok(group.length >= 2);
      assert.equal(new Set(group.map((item) => item.brand.slug)).size, 1);
      assert.equal(new Set(group.map((item) => item.model.trim().toLowerCase())).size, 1);
      assert.ok(new Set(group.map((item) => item.year)).size >= 2);
      assert.ok(group.every((item) => item.price !== null));
    }
  });
});

describe("cobertura", () => {
  const brand = (name: string, total: number, priced: number, multiStore = 0, withPhoto = total) => ({
    brand: { slug: name.toLowerCase(), name },
    total,
    priced,
    multiStore,
    withPhoto,
  });

  it("suma, calcula porcentajes y nombra las marcas sin precio", () => {
    const report = coverageReport([brand("Uno", 10, 0), brand("Dos", 40, 30, 10, 38), brand("Tres", 50, 5, 1)]);
    assert.deepEqual(report.rows.map((row) => [row.brand.name, row.pricedPercent]), [
      ["Dos", 75],
      ["Tres", 10],
      ["Uno", 0],
    ]);
    assert.deepEqual(report.totals, { total: 100, priced: 35, multiStore: 11, withPhoto: 98, pricedPercent: 35 });
    assert.deepEqual(report.withoutPrice, ["Uno"]);
  });

  it("sin marcas no divide entre cero", () => {
    assert.deepEqual(coverageReport([]).totals, { total: 0, priced: 0, multiStore: 0, withPhoto: 0, pricedPercent: 0 });
  });

  it("la cobertura del repositorio cuadra con el catálogo", async () => {
    const repository = createMemoryRepository();
    const report = coverageReport(await repository.getBrandCoverage());
    assert.equal(report.totals.total, await repository.countPalas());
    assert.equal(report.totals.priced, await repository.countPalas({ coverage: ["con-precio"] }));
    assert.equal(report.totals.multiStore, await repository.countPalas({ coverage: ["varias-tiendas"] }));
  });

  it("las ofertas de varias tiendas del repositorio son vigentes y de tiendas distintas", async () => {
    const items = await createMemoryRepository().getMultiStoreOffers();
    for (const item of items) {
      assert.ok(item.offers.length >= 2);
      assert.equal(new Set(item.offers.map((entry) => entry.store.id)).size, item.offers.length);
    }
    const sources = await createMemoryRepository().getPriceSources();
    assert.ok(sources.length > 0 && sources.every((source) => source.prices >= 0));
  });
});
