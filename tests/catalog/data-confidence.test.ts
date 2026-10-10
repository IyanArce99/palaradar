// Vocabulario común y confianza de los datos: un valor escrito de otra manera es
// el mismo valor, uno que no se reconoce es desconocido, y lo que falta se dice
// como ausencia, sin mezclar la confianza del precio con la de las características.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  attributeStatus,
  isUsablePrice,
  priceState,
  readiness,
  reliabilityNotes,
  SEASON_RELATION,
  type ReadinessInput,
  type ReliabilitySource,
} from "@/lib/data-confidence";
import {
  attributesInTitle,
  canonicalTouch,
  normalizeBalance,
  normalizeLevel,
  normalizeShape,
  normalizeStyle,
  parseWeight,
} from "@/lib/vocabulary";

describe("vocabulario", () => {
  it("reconoce sinónimos, plurales, acentos y mayúsculas", () => {
    assert.equal(normalizeShape("Lágrima"), "lagrima");
    assert.equal(normalizeShape(" REDONDAS "), "redonda");
    assert.equal(normalizeShape("Híbrida"), "hibrida");
    assert.equal(normalizeStyle("Versátil"), "polivalente");
    assert.equal(normalizeBalance("Alta"), "alto");
    assert.equal(normalizeLevel("Principiantes"), "iniciacion");
  });

  it("lo que no reconoce es desconocido, no una categoría por defecto", () => {
    for (const value of ["", null, undefined, "ovalada", "muy potente", "control total"]) {
      assert.equal(normalizeShape(value), null);
      assert.equal(normalizeStyle(value), null);
    }
    assert.equal(normalizeBalance("medio-alto"), null);
  });

  it("palabras parecidas no son el mismo atributo", () => {
    // «medio» es un balance, no un nivel; «potente» es un estilo, no un tacto.
    assert.equal(normalizeLevel("medio"), null);
    assert.equal(normalizeBalance("intermedio"), null);
    assert.equal(canonicalTouch("Potente"), "potente");
  });

  it("tacto y dureza comparten vocabulario; los valores múltiples se ordenan", () => {
    assert.equal(canonicalTouch("Media"), canonicalTouch("medio"));
    assert.equal(canonicalTouch("Dura, Media"), "duro, medio");
    assert.equal(canonicalTouch("media / dura"), "duro, medio");
    assert.equal(canonicalTouch(null), "");
  });

  it("lee pesos en gramos y kilos, sueltos o en rango", () => {
    assert.deepEqual(parseWeight("365 g"), { min: 365, max: 365 });
    assert.deepEqual(parseWeight("360-375 gr"), { min: 360, max: 375 });
    assert.deepEqual(parseWeight("375 – 355 gramos"), { min: 355, max: 375 });
    assert.deepEqual(parseWeight("0,37 kg"), { min: 370, max: 370 });
    assert.deepEqual(parseWeight("365"), { min: 365, max: 365 });
  });

  it("una unidad equivocada o un texto que no es un peso se descartan, no se corrigen", () => {
    for (const value of ["365 kg", "36 g", "ligera", "", null, "365 g aprox.", "3650"]) {
      assert.equal(parseWeight(value), null, String(value));
    }
  });

  it("del título de una tienda solo saca la forma si es inequívoca", () => {
    assert.deepEqual(attributesInTitle("Pala Nox ML10 Redonda 2025"), { shape: "redonda" });
    assert.deepEqual(attributesInTitle("Bullpadel Vertex 04 Hybrid 2025"), { shape: null });
    assert.deepEqual(attributesInTitle("Pack redonda y diamante"), { shape: null });
  });
});

describe("estado del precio", () => {
  it("sale de la vigencia de siempre y no se mezcla con nada más", () => {
    assert.equal(priceState("current"), "reciente");
    assert.equal(priceState("recent"), "antiguo");
    assert.equal(priceState("stale"), "sin-confirmar");
    assert.equal(priceState(null), "sin-precio");
  });

  it("solo un precio vigente sirve para recomendar o calcular un ahorro", () => {
    assert.deepEqual(["reciente", "antiguo", "sin-confirmar", "sin-precio"].map((state) => isUsablePrice(state as never)), [true, true, false, false]);
  });
});

describe("estado de un atributo", () => {
  it("distingue verificado, declarado, deducido y desconocido", () => {
    assert.equal(attributeStatus("alto"), "declarado");
    assert.equal(attributeStatus("8445402973897", { verified: true }), "verificado");
    assert.equal(attributeStatus("alto", { inferred: true }), "inferido");
    for (const empty of [null, undefined, "", []]) assert.equal(attributeStatus(empty, { verified: true }), "desconocido");
  });

  it("la relación entre temporadas es provisional y lo dice", () => {
    assert.equal(SEASON_RELATION.status, "provisional");
    assert.match(SEASON_RELATION.note, /no una confirmación del fabricante/);
  });
});

describe("para qué alcanza lo que se sabe de una pala", () => {
  const full: ReadinessInput = {
    hasUsablePrice: true,
    storeCount: 2,
    balance: "medio",
    playStyle: "control",
    levels: ["intermedio"],
    hasWeight: true,
    hasTouch: true,
    hasRatings: true,
  };

  it("con todo, sirve para todo", () => {
    assert.ok(Object.values(readiness(full)).every((item) => item.ready && item.reason === null));
  });

  it("sin precio vigente no se recomienda ni se propone, y se dice por qué", () => {
    const result = readiness({ ...full, hasUsablePrice: false, storeCount: 0 });
    assert.deepEqual(
      [result.alternativas, result.recomendador, result["comparar-tiendas"]].map((item) => item.reason),
      ["No hay precio actual confirmado.", "No hay precio actual confirmado.", "No hay precio actual confirmado."],
    );
    // Las puntuaciones no dependen del precio.
    assert.equal(result["comparar-rendimiento"].ready, true);
  });

  it("con una sola tienda no se compara entre tiendas", () => {
    assert.equal(readiness({ ...full, storeCount: 1 })["comparar-tiendas"].reason, "Solo hay una tienda con precio disponible.");
  });

  it("con pocos datos de perfil baja lo que puede alimentar", () => {
    const sparse = readiness({ ...full, balance: null, playStyle: null });
    assert.equal(sparse.alternativas.ready, false);
    assert.equal(sparse.recomendador.ready, true);
    assert.equal(readiness({ ...full, balance: null, playStyle: null, levels: [] }).recomendador.reason, "No declara ni nivel ni estilo de juego.");
    assert.equal(readiness({ ...full, hasTouch: false })["perfil-completo"].ready, false);
  });
});

describe("lo que se le dice al usuario", () => {
  const store = (name: string) => ({ id: name, slug: name, name, url: "" });
  const offer = (name: string, shipping: number | null) => ({
    store: store(name),
    price: 200,
    shipping,
    previousPrice: null,
    availability: "En stock",
    url: null,
    checkedAt: "2026-10-09T10:00:00Z",
    total: 200,
  });
  const base: ReliabilitySource = {
    price: {
      freshness: "current",
      checkedAt: "2026-10-09T10:00:00Z",
      asOf: "2026-10-09T12:00:00Z",
      storeCount: 2,
      offers: [offer("Tienda A", null), offer("Tienda B", 0)],
      trackedSince: "2026-10-03",
    },
    missing: ["peso"],
    gtin: "declarado",
    ratingsSource: "PadelZoom",
  };
  const texts = (source: ReliabilitySource) => reliabilityNotes(source).map((note) => `${note.tone}: ${note.text}`);

  it("explica cada cosa por separado: precio, tiendas, envío, origen y lo que falta", () => {
    assert.deepEqual(texts(base), [
      "ok: Precio comprobado hace 2 horas.",
      "ok: Precio comparado en 2 tiendas.",
      "aviso: Gastos de envío no verificados en Tienda A.",
      "ok: Las características son las que declara la fuente; no son mediciones propias.",
      "aviso: El código de barras (EAN) es el que declara la fuente; no lo hemos contrastado con otra.",
      "ok: Las puntuaciones técnicas son de PadelZoom, no de PalaRadar.",
      "falta: No se ha podido verificar: peso.",
    ]);
  });

  it("que exista un EAN no lo presenta como verificado (C-01)", () => {
    const declared = texts({ ...base, gtin: "declarado" });
    assert.ok(!declared.some((text) => /verificado\.$/.test(text) && text.includes("EAN")));
    assert.ok(!declared.some((text) => text.startsWith("ok:") && text.includes("EAN")));
    // «Verificado» queda para quien pueda demostrarlo; sin EAN no se dice nada de él.
    assert.ok(texts({ ...base, gtin: "verificado" }).includes("ok: El código de barras (EAN) está verificado."));
    assert.ok(!texts({ ...base, gtin: null }).some((text) => text.includes("EAN")));
  });

  it("la ficha solo declara el EAN: no tiene con qué demostrar una verificación", () => {
    const component = readFileSync(join(process.cwd(), "components/ficha/DataReliability.tsx"), "utf8");
    assert.match(component, /gtin: pala\.gtin === null \? null : "declarado"/);
    assert.doesNotMatch(component, /"verificado"/);
  });

  it("sin precio lo dice, y no habla de tiendas ni de envíos", () => {
    const notes = texts({ ...base, price: null, missing: [], gtin: null, ratingsSource: null });
    assert.deepEqual(notes, [
      "falta: No hay precio actual confirmado: ninguna de las tiendas que seguimos la tiene a la venta.",
      "ok: Las características son las que declara la fuente; no son mediciones propias.",
    ]);
  });

  it("un precio antiguo o sin confirmar es un aviso, no un dato comprobado", () => {
    assert.ok(base.price);
    const recent = texts({ ...base, price: { ...base.price, freshness: "recent", checkedAt: "2026-10-08T06:00:00Z" } });
    assert.match(recent[0], /^aviso: Precio conocido, pero antiguo: se comprobó hace 30 horas/);
    const stale = texts({ ...base, price: { ...base.price, freshness: "stale", checkedAt: "2026-10-05T06:00:00Z" } });
    assert.match(stale[0], /^aviso: Precio sin confirmar desde el 5 de octubre de 2026/);
    // Con el precio sin confirmar no se presume de comparación entre tiendas.
    assert.ok(!stale.some((text) => text.includes("comparado en")));
  });

  it("una sola tienda es una limitación, y se dice", () => {
    assert.ok(base.price);
    const notes = texts({ ...base, price: { ...base.price, storeCount: 1, offers: [offer("Tienda B", 0)] } });
    assert.ok(notes.includes("aviso: Solo hay una tienda con precio disponible: no podemos compararlo con otra."));
  });

  it("ninguna frase presenta una ausencia como un defecto", () => {
    assert.doesNotMatch(texts({ ...base, missing: ["peso", "balance", "nivel"] }).join(" "), /error|defecto|incorrect|mal |fallo/i);
  });
});
