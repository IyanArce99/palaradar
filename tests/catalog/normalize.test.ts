// De las observaciones de una pala a sus valores publicados.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateImport } from "@/catalog/load";
import {
  genericArtPath,
  publishedValues,
  slugify,
  stableId,
  toBalance,
  toLevels,
  toPlayStyle,
  toShape,
  toWeightRange,
} from "@/catalog/normalize";
import type { CatalogImport, ImportFact, ImportRacket } from "@/catalog/types";

function fact(attribute: string, value: string, extra: Partial<ImportFact> = {}): ImportFact {
  return {
    attribute,
    value,
    raw: null,
    unit: null,
    source: "fabricante",
    url: "https://example.com/pala",
    kind: "fact",
    confidence: "high",
    selected: true,
    ...extra,
  };
}

function racket(fields: Partial<ImportRacket> = {}): ImportRacket {
  return {
    key: "pala-1",
    existingSlug: null,
    brand: "Adidas",
    model: "Metalbone",
    year: 2026,
    player: null,
    variants: [],
    available: true,
    unavailableReason: null,
    facts: [fact("shape", "diamante")],
    identifiers: [],
    content: [],
    media: [],
    legacyUrls: [],
    storeLinks: [],
    ...fields,
  };
}

const file = (rackets: ImportRacket[]): CatalogImport => ({
  generatedAt: "2026-10-04T10:00:00.000Z",
  sources: [
    { slug: "fabricante", name: "Fabricante", kind: "manufacturer", url: null },
    { slug: "tienda", name: "Tienda", kind: "store", url: null },
  ],
  rackets,
});

describe("vocabulario", () => {
  it("la forma admite cuatro valores, con «híbrida» como forma propia", () => {
    assert.equal(toShape("Diamante"), "diamante");
    assert.equal(toShape("Lágrima"), "lagrima");
    assert.equal(toShape("Round"), "redonda");
    assert.equal(toShape("Híbrida"), "hibrida");
    assert.equal(toShape("Allround"), "hibrida");
    assert.equal(toShape("Diamond Oversize"), "diamante");
  });

  it("una forma desconocida no se traduce a ninguna", () => {
    assert.equal(toShape("Ovalada"), null);
    assert.equal(toShape(""), null);
    assert.equal(toShape(null), null);
  });

  it("el balance se publica en tres valores", () => {
    assert.equal(toBalance("Head Heavy"), "alto");
    assert.equal(toBalance("medio-alto"), "alto");
    assert.equal(toBalance("Even"), "medio");
    assert.equal(toBalance("Bajo"), "bajo");
    assert.equal(toBalance("25 cm"), null);
  });

  it("el estilo de juego solo se publica si la fuente usa uno de los nuestros", () => {
    assert.equal(toPlayStyle("Control"), "control");
    assert.equal(toPlayStyle("Attack"), "potencia");
    assert.equal(toPlayStyle("Polivalente"), "polivalente");
    assert.equal(toPlayStyle("Atacante Técnico"), null);
  });

  it("los niveles se leen de lo que nombra la fuente", () => {
    assert.deepEqual(toLevels("Principiante / Intermedio"), ["iniciacion", "intermedio"]);
    assert.deepEqual(toLevels("Avanzado / Competición"), ["avanzado", "competicion"]);
    assert.deepEqual(toLevels("Profesional"), ["competicion"]);
    assert.deepEqual(toLevels("Pro"), ["competicion"]);
    assert.deepEqual(toLevels("Beginner"), ["iniciacion"]);
    assert.deepEqual(toLevels("Avanzado / Competición, Principiante / Intermedio"), ["iniciacion", "intermedio", "avanzado", "competicion"]);
  });

  it("un rango de niveles incluye los intermedios", () => {
    assert.deepEqual(toLevels("intermedio a avanzado"), ["intermedio", "avanzado"]);
    assert.deepEqual(toLevels("principiantes hasta avanzados"), ["iniciacion", "intermedio", "avanzado"]);
  });

  it("sin nivel reconocible no hay niveles", () => {
    assert.deepEqual(toLevels("Para todos"), []);
    assert.deepEqual(toLevels(null), []);
  });

  it("el peso es un rango o un valor único", () => {
    assert.deepEqual(toWeightRange("350-370"), [350, 370]);
    assert.deepEqual(toWeightRange("365"), [365, 365]);
    assert.equal(toWeightRange("370-350"), null);
    assert.equal(toWeightRange("ligera"), null);
  });

  it("direcciones, identificadores e ilustraciones son deterministas", () => {
    assert.equal(slugify("StarVie Drax + 2026"), "starvie-drax-plus-2026");
    assert.equal(slugify("Tritón Power"), "triton-power");
    assert.equal(stableId("racket:x"), stableId("racket:x"));
    assert.notEqual(stableId("racket:x"), stableId("racket:y"));
    assert.match(genericArtPath("hibrida", "pala-x"), /^\/img\/palas\/generica-hibrida-[0-8]\.svg$/);
    assert.equal(genericArtPath("hibrida", "pala-x"), genericArtPath("hibrida", "pala-x"));
  });
});

describe("valores publicados", () => {
  it("salen solo de las observaciones elegidas", () => {
    const values = publishedValues([
      fact("shape", "diamante", { selected: false, source: "tienda" }),
      fact("shape", "hibrida"),
      fact("weight", "350-365"),
      fact("balance", "alto", { raw: "Head Heavy" }),
      fact("level", "avanzado / competicion", { raw: "Avanzado / Competición" }),
      fact("play_style", "potencia", { raw: "Potencia" }),
      fact("thickness_mm", "38"),
      fact("core", "eva soft", { raw: "EVA Soft" }),
      fact("face", "carbono 12k", { raw: "Carbono 12K" }),
      fact("surface", "rugosa", { raw: "Rugosa" }),
      fact("msrp", "390"),
      // Las valoraciones de terceros se guardan, pero nunca se eligen ni se publican.
      fact("score_power", "10", { kind: "rating", selected: false }),
    ]);

    assert.equal(values.shape, "hibrida");
    assert.deepEqual([values.weightMin, values.weightMax], [350, 365]);
    assert.equal(values.balance, "alto");
    assert.deepEqual(values.levels, ["avanzado", "competicion"]);
    assert.equal(values.playStyle, "potencia");
    assert.equal(values.thicknessMm, 38);
    assert.equal(values.msrp, 390);
    assert.equal(values.surface, "Rugosa");
    assert.deepEqual(values.technicalSpecs, [
      { label: "Núcleo", value: "EVA Soft" },
      { label: "Caras", value: "Carbono 12K" },
      { label: "Grosor", value: "38 mm" },
      { label: "Superficie", value: "Rugosa" },
    ]);
    assert.equal(values.description, "Pala de potencia de forma híbrida y balance alto.");
    assert.deepEqual(values.idealFor, ["Jugadores de nivel avanzado, competición", "Quienes buscan potencia"]);
    assert.equal(values.enrichmentLevel, 2);
  });

  it("lo que ninguna fuente respalda queda vacío", () => {
    const values = publishedValues([fact("shape", "redonda"), fact("weight", "365")]);

    assert.equal(values.balance, null);
    assert.equal(values.playStyle, null);
    assert.deepEqual(values.levels, []);
    assert.equal(values.thicknessMm, null);
    assert.equal(values.msrp, null);
    assert.deepEqual(values.technicalSpecs, []);
    assert.deepEqual(values.idealFor, []);
    assert.equal(values.description, "Pala de forma redonda.");
    assert.equal(values.enrichmentLevel, 1);
  });

  it("sin forma elegida la pala no tiene forma publicada", () => {
    const values = publishedValues([
      fact("shape", "diamante", { selected: false }),
      fact("shape", "lagrima", { selected: false, source: "tienda" }),
    ]);
    assert.equal(values.shape, null);
  });
});

describe("comprobación del fichero", () => {
  it("acepta un fichero correcto", () => {
    assert.doesNotThrow(() => validateImport(file([racket(), racket({ key: "pala-2", model: "Metalbone CTRL" })])));
  });

  it("rechaza dos palas que darían la misma dirección", () => {
    assert.throws(() => validateImport(file([racket(), racket({ key: "pala-2" })])), /misma dirección/);
  });

  it("rechaza dos valores elegidos para el mismo atributo", () => {
    const facts = [fact("shape", "diamante"), fact("shape", "lagrima", { source: "tienda" })];
    assert.throws(() => validateImport(file([racket({ facts })])), /Dos valores elegidos/);
  });

  it("rechaza publicar un dato en revisión", () => {
    const facts = [fact("shape", "diamante", { confidence: "review" })];
    assert.throws(() => validateImport(file([racket({ facts })])), /en revisión no puede publicarse/);
  });

  it("rechaza datos vacíos y fuentes desconocidas", () => {
    assert.throws(() => validateImport(file([racket({ facts: [fact("shape", "")] })])), /Dato vacío/);
    assert.throws(
      () => validateImport(file([racket({ facts: [fact("shape", "diamante", { source: "otra" })] })])),
      /Fuente desconocida/,
    );
  });

  it("rechaza una pala sin identidad", () => {
    assert.throws(() => validateImport(file([racket({ model: "" })])), /sin marca, modelo o año/);
  });
});
