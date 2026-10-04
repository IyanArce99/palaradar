// Recomendador «Pala ideal»: respuestas → palas con precio, por coincidencias.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRepository } from "@/data/memory-repository";
import {
  answeredCriteria,
  hasAnswers,
  matchesWeight,
  parseRecommenderPrefs,
  type RecommenderPrefs,
} from "@/lib/recommender";

const NO_PREFS: RecommenderPrefs = {
  level: null,
  style: null,
  shape: null,
  balance: null,
  weight: null,
  maxPrice: null,
};

describe("respuestas del recomendador", () => {
  it("lee de la URL solo los valores conocidos", () => {
    const prefs = parseRecommenderPrefs({
      nivel: "intermedio",
      estilo: "control",
      forma: "cuadrada",
      balance: "",
      peso: "ligera",
      presupuesto: "150",
    });

    assert.deepEqual(prefs, {
      level: "intermedio",
      style: "control",
      shape: null,
      balance: null,
      weight: "ligera",
      maxPrice: 150,
    });
    assert.deepEqual(answeredCriteria(prefs), ["level", "style", "weight"]);
  });

  it("no acepta un presupuesto que no esté entre las opciones", () => {
    assert.equal(parseRecommenderPrefs({ presupuesto: "1" }).maxPrice, null);
    assert.equal(parseRecommenderPrefs({ presupuesto: "abc" }).maxPrice, null);
  });

  it("sin respuestas no hay nada que recomendar", () => {
    assert.equal(hasAnswers(parseRecommenderPrefs({})), false);
    assert.equal(hasAnswers({ ...NO_PREFS, maxPrice: 200 }), true);
  });

  it("clasifica el peso por el punto medio del rango declarado", () => {
    assert.equal(matchesWeight("ligera", 345, 360), true);
    assert.equal(matchesWeight("media", 360, 375), true);
    assert.equal(matchesWeight("pesada", 365, 385), true);
    assert.equal(matchesWeight("media", 345, 360), false);
    assert.equal(matchesWeight("media", null, null), false);
  });
});

describe("recomendación sobre el catálogo", () => {
  const repository = createMemoryRepository();

  it("devuelve como mucho las palas pedidas, todas con precio y dentro del presupuesto", async () => {
    const results = await repository.recommendPalas({ ...NO_PREFS, maxPrice: 200 }, 3);

    assert.ok(results.length > 0 && results.length <= 3);
    for (const { pala } of results) {
      assert.ok(pala.price !== null && pala.price <= 200, `${pala.slug} fuera de presupuesto`);
    }
  });

  it("ordena por número de respuestas cumplidas y solo marca las que se cumplen", async () => {
    const prefs: RecommenderPrefs = { ...NO_PREFS, shape: "redonda", style: "control" };
    const results = await repository.recommendPalas(prefs, 50);

    const scores = results.map(({ matched }) => matched.length);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
    for (const { pala, matched } of results) {
      assert.equal(matched.includes("shape"), pala.shape === "redonda", pala.slug);
      assert.ok(!matched.includes("level") && !matched.includes("balance"));
    }
  });
});
