// Recomendador «Pala ideal»: respuestas → preferencias → palas con precio, por coincidencias.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRepository } from "@/data/memory-repository";
import {
  buildReasons,
  expressedCriteria,
  FINDER_QUESTIONS,
  finderPath,
  isComplete,
  matchCriteria,
  matchesTouch,
  NO_ANSWERS,
  parseFinderAnswers,
  profileChips,
  toPrefs,
  type RacketTraits,
  type RecommenderPrefs,
} from "@/lib/recommender";

const NO_PREFS: RecommenderPrefs = {
  level: null,
  style: null,
  side: null,
  shape: null,
  touch: null,
  maxPrice: null,
};

const RACKET: RacketTraits = {
  levels: ["intermedio", "avanzado"],
  playStyle: "control",
  shape: "redonda",
  balance: "medio",
  touch: "Medio-Blando",
  hardness: null,
  price: 150,
};

describe("respuestas del quiz", () => {
  it("tiene las seis preguntas del diseño, cada una con su parámetro", () => {
    assert.deepEqual(
      FINDER_QUESTIONS.map((question) => [question.id, question.param, question.options.length]),
      [["level", "nivel", 4], ["style", "estilo", 3], ["side", "lado", 3], ["shape", "forma", 4], ["touch", "tacto", 5], ["budget", "presupuesto", 4]],
    );
  });

  it("pregunta por el tacto, no por molestias físicas", () => {
    const question = FINDER_QUESTIONS[4];
    assert.equal(question.title, "¿Qué tacto prefieres?");
    assert.deepEqual(question.options.map((option) => option.label), ["Blando", "Medio-blando", "Medio", "Duro", "Me da igual"]);
    assert.doesNotMatch(JSON.stringify(FINDER_QUESTIONS), /codo|brazo|lesi|molest|vibraci/i);
  });

  it("lee de la URL solo los valores conocidos", () => {
    const answers = parseFinderAnswers({ nivel: "intermedio", estilo: "control", lado: "arriba", forma: "", presupuesto: "180" });
    assert.deepEqual(answers, [1, 0, null, null, null, 1]);
    assert.equal(isComplete(answers), false);
  });

  it("las respuestas completas van y vuelven por la URL", () => {
    const answers = [1, 0, 2, 3, 1, 3];
    const url = finderPath(answers);
    assert.equal(url, "/pala-ideal/?nivel=intermedio&estilo=control&lado=ambos&forma=cualquiera&tacto=medio-blando&presupuesto=sin-limite");
    const params = Object.fromEntries(new URL(url, "https://palaradar.es").searchParams);
    assert.deepEqual(parseFinderAnswers(params), answers);
    assert.equal(isComplete(answers), true);
    assert.equal(finderPath(NO_ANSWERS), "/pala-ideal/");
  });

  it("«me da igual» y «sin límite» no restringen", () => {
    const prefs = toPrefs([1, 0, 2, 3, 4, 3]);
    assert.deepEqual(prefs, { ...NO_PREFS, level: "intermedio", style: "control" });
    assert.deepEqual(expressedCriteria(prefs), ["level", "style"]);
  });

  it("traduce cada respuesta a su preferencia", () => {
    assert.deepEqual(toPrefs([3, 2, 1, 2, 3, 0]), {
      level: "competicion", style: "potencia", side: "reves", shape: "diamante", touch: "duro", maxPrice: 100,
    });
    assert.equal(toPrefs([0, 1, 0, 0, 1, 1]).touch, "medio-blando");
  });

  it("resume el perfil con etiquetas cortas", () => {
    assert.deepEqual(profileChips([1, 1, 2, 3, 0, 1]), [
      "Intermedio", "Equilibrio", "Drive y revés", "Cualquier forma", "Tacto blando", "100 – 180 €",
    ]);
    assert.deepEqual(profileChips([0, 0, 0, 0, 4, 3]), ["Principiante", "Control", "Drive", "Redonda", "Sin límite"]);
  });
});

describe("coincidencias de una pala con las respuestas", () => {
  it("cuenta solo las respuestas que la pala cumple", () => {
    const prefs: RecommenderPrefs = { level: "avanzado", style: "potencia", side: "drive", shape: "redonda", touch: "medio-blando", maxPrice: 180 };
    assert.deepEqual(matchCriteria(prefs, RACKET), ["level", "side", "shape", "touch", "budget"]);
  });

  it("presupuesto y forma elegida son filtros", () => {
    assert.equal(matchCriteria({ ...NO_PREFS, maxPrice: 100 }, RACKET), null);
    assert.equal(matchCriteria({ ...NO_PREFS, shape: "diamante" }, RACKET), null);
    assert.equal(matchCriteria(NO_PREFS, { ...RACKET, price: null }), null);
  });

  it("el tacto es una preferencia: ordena, no descarta", () => {
    assert.deepEqual(matchCriteria({ ...NO_PREFS, touch: "blando" }, { ...RACKET, touch: "Duro" }), []);
    assert.deepEqual(matchCriteria({ ...NO_PREFS, touch: "duro" }, { ...RACKET, touch: "Duro" }), ["touch"]);
  });

  it("el lado de la pista se traduce a balance: alto para el revés, medio o bajo para el drive", () => {
    const high = { ...RACKET, balance: "alto" as const };
    assert.deepEqual(matchCriteria({ ...NO_PREFS, side: "reves" }, high), ["side"]);
    assert.deepEqual(matchCriteria({ ...NO_PREFS, side: "drive" }, high), []);
    assert.deepEqual(matchCriteria({ ...NO_PREFS, side: "reves" }, { ...RACKET, balance: null }), []);
  });

  it("sin dato declarado no hay coincidencia: no se supone", () => {
    const bare = { ...RACKET, levels: [], playStyle: null, touch: null };
    assert.deepEqual(matchCriteria({ ...NO_PREFS, level: "intermedio", style: "control", touch: "medio" }, bare), []);
  });

  it("compara el tacto pedido con el tacto declarado y, si no lo hay, con la dureza", () => {
    assert.equal(matchesTouch("blando", "Blando", null), true);
    assert.equal(matchesTouch("medio-blando", "medio-blando", null), true);
    assert.equal(matchesTouch("medio", " Medio ", null), true);
    assert.equal(matchesTouch("duro", "Medio-Duro", null), true);
    assert.equal(matchesTouch("duro", "Duro", null), true);
    assert.equal(matchesTouch("blando", "Medio-Blando", null), false);
    // La dureza solo cuenta cuando la pala no declara tacto.
    assert.equal(matchesTouch("blando", null, "Blanda"), true);
    assert.equal(matchesTouch("medio", null, "Media"), true);
    assert.equal(matchesTouch("duro", "", "Dura"), true);
    assert.equal(matchesTouch("blando", "Medio", "Blanda"), false);
    assert.equal(matchesTouch("medio-blando", null, "Media, Blanda"), false);
    assert.equal(matchesTouch("medio", null, null), false);
  });
});

describe("recomendación sobre el catálogo", () => {
  const repository = createMemoryRepository();

  it("devuelve como mucho las palas pedidas, todas con precio y dentro del presupuesto", async () => {
    const results = await repository.recommendPalas({ ...NO_PREFS, maxPrice: 180 }, 4);

    assert.ok(results.length > 0 && results.length <= 4);
    for (const { pala, matched } of results) {
      assert.ok(pala.price !== null && pala.price <= 180, `${pala.slug} fuera de presupuesto`);
      assert.deepEqual(matched, ["budget"]);
    }
  });

  it("la forma elegida es un filtro y el resto ordena por coincidencias", async () => {
    const prefs: RecommenderPrefs = { ...NO_PREFS, shape: "redonda", style: "control", level: "iniciacion" };
    const results = await repository.recommendPalas(prefs, 50);

    assert.ok(results.length > 0);
    assert.ok(results.every(({ pala }) => pala.shape === "redonda"));
    const scores = results.map(({ matched }) => matched.length);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  });

  it("explica la mejor opción con sus propios datos, sin más de tres razones", async () => {
    const prefs: RecommenderPrefs = { ...NO_PREFS, shape: "redonda", style: "control", maxPrice: 250 };
    const [best] = await repository.recommendPalas(prefs, 1);
    const pala = await repository.getPalaBySlug(best.pala.slug);
    assert.ok(pala);

    const reasons = buildReasons(pala, prefs, best.matched);
    assert.ok(reasons.length > 0 && reasons.length <= 3);
    assert.equal(reasons[0], "Es de forma redonda, la que buscas");
    assert.doesNotMatch(reasons.join(" "), /mejor|perfecta|ideal|%/i);
  });
});
