// Afinidad del quiz «Pala ideal»: un porcentaje calculado con una fórmula fija
// sobre datos declarados de la pala. Nada de cifras de ejemplo.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRepository } from "@/data/memory-repository";
import {
  AFFINITY,
  affinity,
  rankRecommendations,
  type RacketTraits,
  type RecommenderCriterion,
  type RecommenderPrefs,
} from "@/lib/recommender";

const NO_PREFS: RecommenderPrefs = { level: null, style: null, side: null, shape: null, touch: null, maxPrice: null };

const RACKET: RacketTraits = {
  levels: ["intermedio", "avanzado"],
  playStyle: "control",
  shape: "redonda",
  balance: "medio",
  touch: "Medio-Blando",
  hardness: null,
  price: 150,
};

describe("afinidad", () => {
  const prefs: RecommenderPrefs = {
    ...NO_PREFS,
    level: "intermedio",
    style: "control",
    shape: "redonda",
    touch: "medio-blando",
    side: "drive",
  };

  it("parte de una base y suma por cada respuesta que la pala cumple, con tope", () => {
    assert.equal(affinity(NO_PREFS, RACKET), AFFINITY.base);
    // 62 + nivel 12 + estilo 12 + forma 6 + tacto 4 + lado 3 = 99, limitado a 97.
    assert.equal(affinity(prefs, RACKET), AFFINITY.max);
    assert.equal(affinity({ ...NO_PREFS, level: "intermedio" }, RACKET), 74);
  });

  it("resta si la pala declara niveles y el tuyo no está, y no si no declara ninguno", () => {
    assert.equal(affinity({ ...NO_PREFS, level: "competicion" }, RACKET), 54);
    assert.equal(affinity({ ...NO_PREFS, level: "competicion" }, { ...RACKET, levels: [] }), AFFINITY.base);
  });

  it("un estilo contiguo suma menos que el mismo, y el opuesto no suma", () => {
    assert.equal(affinity({ ...NO_PREFS, style: "polivalente", shape: "redonda" }, RACKET), 62 + 4 + 6);
    assert.equal(affinity({ ...NO_PREFS, style: "potencia", shape: "redonda" }, RACKET), 62 + 6);
  });

  it("sin forma elegida, cuenta la forma habitual de tu estilo", () => {
    assert.equal(affinity({ ...NO_PREFS, style: "control" }, RACKET), 62 + 12 + 4);
    assert.equal(affinity({ ...NO_PREFS, style: "control" }, { ...RACKET, shape: "diamante" }), 62 + 12);
  });

  it("es determinista y va siempre entre 0 y 100", () => {
    const value = affinity(prefs, RACKET);
    assert.equal(affinity(prefs, RACKET), value);
    assert.ok(Number.isInteger(value) && value >= 0 && value <= 100);
  });

  it("ordena por afinidad y, a igualdad, por respuestas cumplidas, precio y orden de llegada", () => {
    const item = (id: string, score: number, matched: RecommenderCriterion[], price: number | null = 200) => ({
      id,
      affinity: score,
      matched,
      price,
    });
    const ranked = rankRecommendations([
      item("a", 80, ["level"]),
      item("b", 93, ["level"], 300),
      item("c", 80, ["level", "style"]),
      item("d", 80, ["level"]),
      item("e", 80, ["level"], 120),
      item("f", 80, ["level"], null),
    ]);
    // La más afín va primero aunque sea la más cara; el precio solo desempata.
    assert.deepEqual(ranked.map((entry) => entry.id), ["b", "c", "e", "a", "d", "f"]);
  });

  it("el recomendador devuelve la afinidad de cada pala, de mayor a menor", async () => {
    const results = await createMemoryRepository().recommendPalas({ ...NO_PREFS, style: "control" }, 4);
    const scores = results.map((result) => result.affinity);
    assert.ok(scores.length > 0);
    assert.deepEqual(scores, [...scores].sort((x, y) => y - x));
  });
});
