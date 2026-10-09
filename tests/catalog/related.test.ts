// Contenido de la ficha que se calcula con datos declarados: palas parecidas,
// otras temporadas del modelo, ahorro sobre el PVPR; y la selección para comparar
// desde el catálogo.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRepository } from "@/data/memory-repository";
import { MAX_SELECTED, parseSelection, toggleSelected } from "@/lib/compare-selection";
import { CHART_RANGES, chartSeries, DEFAULT_CHART_RANGE, msrpSaving } from "@/lib/pricing";
import { sameModelSeasons, sharedTraits, similarityReason, similarityTarget, type SimilarityTarget } from "@/lib/similar";
import type { PalaSummary } from "@/types/catalog";

const target: SimilarityTarget = {
  id: "a", shape: "diamante", balance: "alto", levels: ["avanzado", "competicion"], playStyle: "potencia", price: 200,
};

describe("palas parecidas", () => {
  it("cuenta las coincidencias en balance, estilo y nivel, y un dato que falta no cuenta", () => {
    assert.deepEqual(sharedTraits(target, { balance: "alto", levels: ["avanzado"], playStyle: "potencia" }), ["balance", "style", "level"]);
    assert.deepEqual(sharedTraits(target, { balance: "medio", levels: ["iniciacion"], playStyle: "control" }), []);
    assert.deepEqual(sharedTraits(target, { balance: null, levels: [], playStyle: null }), []);
    // Dos palas sin balance declarado no «coinciden» en balance.
    assert.deepEqual(sharedTraits({ ...target, balance: null, playStyle: null, levels: [] }, { balance: null, levels: [], playStyle: null }), []);
  });

  it("explica el parecido con los atributos que comparten", () => {
    assert.equal(similarityReason([]), "Misma forma");
    assert.equal(similarityReason(["balance"]), "Misma forma y balance");
    assert.equal(similarityReason(["balance", "style", "level"]), "Misma forma, balance, estilo y nivel");
  });

  it("solo propone palas de la misma forma, a la venta y distintas de la propia", async () => {
    const repository = createMemoryRepository();
    for (const slug of (await repository.getAllPalaSlugs()).slice(0, 8)) {
      const pala = await repository.getPalaBySlug(slug);
      assert.ok(pala);
      const similar = await repository.getSimilarPalas(similarityTarget(pala), 4);
      assert.ok(similar.length <= 4);
      for (const { pala: other, shared } of similar) {
        assert.notEqual(other.slug, pala.slug);
        assert.equal(other.shape, pala.shape);
        assert.notEqual(other.price, null);
        assert.ok(shared.length <= 3);
      }
      // De más a menos coincidencias.
      const counts = similar.map((item) => item.shared.length);
      assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
    }
  });
});

describe("otras temporadas del mismo modelo", () => {
  const summary = (slug: string, brand: string, model: string, year: number) =>
    ({ slug, brand: { slug: brand, name: brand }, model, year }) as PalaSummary;
  const pala = { slug: "bullpadel-vertex-04-2025", model: "Vertex 04", year: 2025, brand: { slug: "bullpadel" } };

  it("mismo modelo y marca, otro año, de la más reciente a la más antigua", () => {
    const seasons = sameModelSeasons(pala, [
      summary("bullpadel-vertex-04-2023", "bullpadel", "Vertex 04", 2023),
      summary("bullpadel-vertex-04-2025", "bullpadel", "Vertex 04", 2025), // ella misma
      summary("bullpadel-vertex-04-2024", "bullpadel", "vertex 04 ", 2024), // misma, escrita distinto
      summary("bullpadel-vertex-04-comfort-2025", "bullpadel", "Vertex 04 Comfort", 2025), // otro modelo
      summary("bullpadel-vertex-05-2026", "bullpadel", "Vertex 05", 2026), // otro modelo
      summary("otra-vertex-04-2024", "otra", "Vertex 04", 2024), // otra marca
    ]);
    assert.deepEqual(seasons.map((item) => item.slug), ["bullpadel-vertex-04-2024", "bullpadel-vertex-04-2023"]);
  });

  it("sin otras temporadas no hay nada que enseñar", () => {
    assert.deepEqual(sameModelSeasons(pala, []), []);
  });
});

describe("ahorro sobre el PVPR", () => {
  it("solo cuando el precio está por debajo de un PVPR conocido", () => {
    assert.equal(msrpSaving(199.95, 339.99), 41);
    assert.equal(msrpSaving(300, 300), null);
    assert.equal(msrpSaving(320, 300), null);
    assert.equal(msrpSaving(200, null), null);
    assert.equal(msrpSaving(200, 0), null);
    // Menos de medio punto no se anuncia como ahorro.
    assert.equal(msrpSaving(299.5, 300), null);
  });
});

describe("gráfico de precio", () => {
  it("se abre en un mes y ofrece 1, 3 y 6 meses", () => {
    assert.deepEqual([...CHART_RANGES], [1, 3, 6]);
    assert.equal(DEFAULT_CHART_RANGE, 1);
  });

  it("el periodo de un mes enseña un registro por día de los últimos 30", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    const day = (ago: number) => new Date(now.getTime() - ago * 86_400_000).toISOString().slice(0, 10);
    const history = Array.from({ length: 60 }, (_, i) => ({ date: day(59 - i), price: 200 }));
    const price = { current: 200, asOf: now.toISOString(), checkedAt: now.toISOString(), freshness: "current" as const };

    const month = chartSeries(history, price, 1);
    assert.equal(month[0].date, day(31));
    assert.equal(month.at(-1)?.date, day(0));
    assert.equal(new Set(month.map((point) => point.date)).size, month.length);
    assert.ok(chartSeries(history, price, 3).length > month.length);
  });
});

describe("selección para comparar desde el catálogo", () => {
  const a = { slug: "a", name: "Pala A" };
  const b = { slug: "b", name: "Pala B" };
  const c = { slug: "c", name: "Pala C" };

  it("añade, quita y no pasa de dos", () => {
    assert.equal(MAX_SELECTED, 2);
    assert.deepEqual(toggleSelected([], a), [a]);
    assert.deepEqual(toggleSelected([a], b), [a, b]);
    assert.deepEqual(toggleSelected([a, b], c), [a, b]);
    assert.deepEqual(toggleSelected([a, b], a), [b]);
  });

  it("ignora una selección guardada que no tenga la forma esperada", () => {
    assert.deepEqual(parseSelection(null), []);
    assert.deepEqual(parseSelection("no es json"), []);
    assert.deepEqual(parseSelection('{"slug":"a"}'), []);
    assert.deepEqual(parseSelection(JSON.stringify([a, { slug: 1 }, b, c])), [a, b]);
  });
});
