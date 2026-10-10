// Perfil de jugador del recomendador: lo que una recomendación no cumple o no se
// ha podido comprobar, el mismo perfil llevado al catálogo y el perfil que se
// recuerda en el navegador.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRepository } from "@/data/memory-repository";
import {
  buildReasons,
  buildTradeoffs,
  finderPath,
  matchCriteria,
  parseFinderAnswers,
  parseSavedProfile,
  profileCatalogQuery,
  type RecommenderPrefs,
} from "@/lib/recommender";
import type { Pala } from "@/types/catalog";

const repository = createMemoryRepository();
const NO_PREFS: RecommenderPrefs = { level: null, style: null, side: null, shape: null, touch: null, maxPrice: null };

async function pala(changes: Partial<Pala> = {}): Promise<Pala> {
  const [slug] = await repository.getPricedPalaSlugs();
  const found = await repository.getPalaBySlug(slug);
  assert.ok(found?.price);
  return {
    ...found,
    shape: "diamante",
    balance: "alto",
    playStyle: "potencia",
    levels: ["avanzado"],
    hardness: null,
    specs: [{ label: "Tacto", value: "Duro" }],
    ...changes,
  };
}

function matchedFor(racket: Pala, prefs: RecommenderPrefs) {
  const matched = matchCriteria(prefs, {
    levels: racket.levels,
    playStyle: racket.playStyle,
    shape: racket.shape,
    balance: racket.balance,
    touch: racket.specs.find((spec) => spec.label === "Tacto")?.value ?? null,
    hardness: racket.hardness,
    price: racket.price?.current ?? null,
  });
  assert.ok(matched);
  return matched;
}

describe("lo que hay que tener en cuenta de una recomendación", () => {
  it("si la pala cumple todo lo pedido, no hay pegas que contar", async () => {
    const racket = await pala();
    const prefs: RecommenderPrefs = { ...NO_PREFS, level: "avanzado", style: "potencia", touch: "duro", side: "reves" };
    assert.deepEqual(buildTradeoffs(racket, prefs, matchedFor(racket, prefs)), []);
  });

  it("nombra cada respuesta que no cumple con el dato declarado que lo explica", async () => {
    const racket = await pala();
    const prefs: RecommenderPrefs = { ...NO_PREFS, level: "iniciacion", style: "control", touch: "blando", side: "drive" };
    assert.deepEqual(buildTradeoffs(racket, prefs, matchedFor(racket, prefs)), [
      "Su nivel declarado es avanzado, no el que has indicado",
      "Su estilo de juego declarado es potencia, no control",
      "Declara un tacto duro, distinto del que prefieres",
      "Su balance es alto; para el drive suele preferirse bajo o medio",
    ]);
  });

  it("con solo la dureza declarada, habla de dureza y concuerda en género", async () => {
    const racket = await pala({ specs: [], hardness: "Dura" });
    const prefs: RecommenderPrefs = { ...NO_PREFS, touch: "blando" };
    assert.deepEqual(buildTradeoffs(racket, prefs, matchedFor(racket, prefs)), [
      "Declara una dureza dura, distinta de la del tacto que prefieres",
    ]);
    // Un tacto vacío no cuenta como declarado: manda la dureza.
    const blank = await pala({ specs: [{ label: "Tacto", value: "  " }], hardness: "Dura" });
    assert.match(buildTradeoffs(blank, prefs, matchedFor(blank, prefs))[0], /^Declara una dureza dura/);
  });

  it("distingue lo que no cumple de lo que no se ha podido comprobar", async () => {
    const racket = await pala({ levels: [], playStyle: null, balance: null, specs: [] });
    const prefs: RecommenderPrefs = { ...NO_PREFS, level: "intermedio", style: "control", touch: "medio", side: "reves" };
    const notes = buildTradeoffs(racket, prefs, matchedFor(racket, prefs));
    assert.equal(notes.length, 4);
    assert.ok(notes.every((note) => note.includes("no hemos podido comprobar")));
  });

  it("no dice nada de lo que no se ha preguntado, ni repite lo que ya es un motivo", async () => {
    const racket = await pala();
    const prefs: RecommenderPrefs = { ...NO_PREFS, style: "potencia" };
    const matched = matchedFor(racket, prefs);
    assert.deepEqual(buildTradeoffs(racket, prefs, matched), []);
    assert.equal(buildReasons(racket, prefs, matched).length, 1);
  });
});

describe("el perfil en el catálogo", () => {
  it("lleva solo lo que el catálogo sabe filtrar", () => {
    assert.deepEqual(
      profileCatalogQuery({ level: "intermedio", style: "control", side: "drive", shape: "redonda", touch: "blando", maxPrice: 180 }),
      { levels: ["intermedio"], styles: ["control"], shapes: ["redonda"], maxPrice: 180 },
    );
    assert.deepEqual(profileCatalogQuery(NO_PREFS), {});
  });
});

describe("perfil recordado en el navegador", () => {
  const complete = "/pala-ideal/?nivel=intermedio&estilo=polivalente&lado=ambos&forma=cualquiera&tacto=cualquiera&presupuesto=180";

  it("acepta la dirección de un resultado completo y la devuelve normalizada", () => {
    assert.equal(parseSavedProfile(complete), complete);
    const answers = parseFinderAnswers({
      nivel: "intermedio",
      estilo: "polivalente",
      lado: "ambos",
      forma: "cualquiera",
      tacto: "cualquiera",
      presupuesto: "180",
    });
    assert.equal(finderPath(answers), complete);
  });

  it("descarta lo incompleto, lo desconocido y cualquier otra dirección", () => {
    assert.equal(parseSavedProfile(null), null);
    assert.equal(parseSavedProfile(""), null);
    assert.equal(parseSavedProfile("/pala-ideal/?nivel=intermedio"), null);
    assert.equal(parseSavedProfile(complete.replace("intermedio", "experto")), null);
    assert.equal(parseSavedProfile(`https://otro.sitio${complete}`), null);
    assert.equal(parseSavedProfile(`/mis-alertas/?acceso=${"a".repeat(40)}`), null);
    assert.equal(parseSavedProfile(`${complete}&x=${"y".repeat(400)}`), null);
  });

  it("no conserva parámetros que no sean respuestas", () => {
    assert.equal(parseSavedProfile(`${complete}&correo=alguien%40example.com`), complete);
  });
});
