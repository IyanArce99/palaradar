// Ficheros de decisiones manuales: validación previa y coherencia de los que están en el repositorio.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { validateDecisions, type DecisionFile, type ProductDecision } from "@/ingestion/decisions";

const product = (fields: Partial<ProductDecision> = {}): ProductDecision => ({
  store: "tienda", externalId: "SKU-1", title: "Pala de ejemplo", decision: "reject", reason: "Pack: no es la pala suelta", ...fields,
});
const file = (products: ProductDecision[], extra: Partial<DecisionFile> = {}): DecisionFile => ({
  title: "Prueba", decidedAt: "2026-10-05", products, ...extra,
});

describe("validación de un fichero de decisiones", () => {
  it("acepta emparejar, rechazar y dejar en revisión", () => {
    validateDecisions(
      file([
        product({ externalId: "A", decision: "match", racket: "marca-modelo-2026", confidence: "high", reason: "Mismo EAN" }),
        product({ externalId: "B" }),
        product({ externalId: "C", decision: "review", reason: "sin ficha equivalente en catálogo" }),
      ]),
    );
  });

  it("rechaza un producto repetido, un motivo vacío o un emparejamiento incompleto", () => {
    assert.throws(() => validateDecisions(file([product(), product()])), /aparece dos veces/);
    assert.throws(() => validateDecisions(file([product({ reason: " " })])), /no explica el motivo/);
    assert.throws(() => validateDecisions(file([product({ decision: "match", racket: "marca-modelo-2026" })])), /no indica la pala o la confianza/);
    assert.throws(() => validateDecisions(file([product({ racket: "marca-modelo-2026" })])), /no puede llevar pala/);
  });

  it("el histórico solo se toca al corregir un enlace, y solo se mueve hacia otra pala", () => {
    assert.throws(() => validateDecisions(file([product({ history: "delete" })])), /no de qué pala viene/);
    assert.throws(() => validateDecisions(file([product({ from: "marca-modelo-2026", history: "move" })])), /solo puede moverse a otra pala/);
    validateDecisions(file([product({ from: "marca-modelo-2026", history: "delete" })]));
  });

  it("rechaza identificadores o palas repetidos y correcciones que no cambian nada", () => {
    const identifier = { type: "manufacturer_ref" as const, value: "REF-1", racket: null, reason: "No era suya" };
    assert.throws(() => validateDecisions(file([], { identifiers: [identifier, identifier] })), /aparece dos veces/);
    assert.throws(() => validateDecisions(file([], { rackets: [{ slug: "a", set: {}, reason: "x" }] })), /no cambia nada/);
  });
});

describe("decisiones guardadas en el repositorio", () => {
  const dir = join(process.cwd(), "ingestion", "decisions");
  for (const name of readdirSync(dir).filter((entry) => entry.endsWith(".json"))) {
    it(`${name} es válido y cada emparejamiento explica su motivo`, () => {
      const decisions = JSON.parse(readFileSync(join(dir, name), "utf8")) as DecisionFile;
      validateDecisions(decisions);
      assert.ok(decisions.products.length > 0);
      for (const item of decisions.products.filter((entry) => entry.decision === "match")) {
        assert.match(item.racket ?? "", /^[a-z0-9-]+-20\d\d$/, `${item.externalId}: la pala es una dirección del catálogo`);
        assert.ok(item.reason.length > 15, `${item.externalId}: el motivo es demasiado corto`);
      }
    });
  }
});
