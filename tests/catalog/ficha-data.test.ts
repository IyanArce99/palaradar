// Lo que la ficha dice a partir de los datos: qué falta y dónde puntúa más alto
// y más bajo la pala en la fuente externa. Nada de eso se inventa.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRepository } from "@/data/memory-repository";
import { missingData, scoreHighlights } from "@/lib/pala-content";
import type { Pala } from "@/types/catalog";

const repository = createMemoryRepository();

async function pala(changes: Partial<Pala> = {}): Promise<Pala> {
  const [slug] = await repository.getPricedPalaSlugs();
  const found = await repository.getPalaBySlug(slug);
  assert.ok(found);
  return { ...found, ...changes };
}

const ratings = (scores: Record<string, number>) => ({
  source: "PadelZoom",
  total: null,
  scores: Object.entries(scores).map(([label, score]) => ({ label, score })),
});

describe("datos no disponibles", () => {
  it("una pala con todo declarado no tiene nada que avisar", async () => {
    const complete = await pala({
      weight: { min: 360, max: 370 },
      balance: "medio",
      levels: ["intermedio"],
      playStyle: "polivalente",
      hardness: "Media",
      specs: [
        { label: "Núcleo", value: "EVA Soft" },
        { label: "Caras", value: "Carbono 3K" },
      ],
    });
    assert.deepEqual(missingData(complete), []);
  });

  it("nombra cada característica que la pala no declara", async () => {
    const bare = await pala({ weight: null, balance: null, levels: [], playStyle: null, hardness: null, specs: [] });
    assert.deepEqual(missingData(bare), ["peso", "balance", "nivel", "estilo de juego", "tacto o dureza", "núcleo", "caras"]);
  });

  it("el tacto declarado cuenta aunque no haya dureza", async () => {
    const withTouch = await pala({ hardness: null, specs: [{ label: "Tacto", value: "Medio" }] });
    assert.ok(!missingData(withTouch).includes("tacto o dureza"));
  });
});

describe("puntos fuertes y a tener en cuenta", () => {
  it("salen de las notas de la fuente, con su nombre", async () => {
    const rated = await pala({ sourceRatings: ratings({ Potencia: 8.5, Control: 9, "Punto dulce": 9, Manejabilidad: 8 }) });
    assert.deepEqual(scoreHighlights(rated), {
      source: "PadelZoom",
      best: ["control (9,0)", "punto dulce (9,0)"],
      weakest: "manejabilidad (8,0)",
    });
  });

  it("si todas las notas se parecen, no se destaca ninguna", async () => {
    assert.equal(scoreHighlights(await pala({ sourceRatings: ratings({ Potencia: 8.4, Control: 8.6 }) })), null);
  });

  it("sin puntuaciones no hay nada que decir", async () => {
    assert.equal(scoreHighlights(await pala({ sourceRatings: null })), null);
  });
});
