// Comparación entre temporadas de un mismo modelo: solo datos declarados y
// precios vigentes; nunca se dice que una edición sea mejor que otra.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRepository } from "@/data/memory-repository";
import { compareSeasons, seasonPriceGap } from "@/lib/seasons";
import type { Pala } from "@/types/catalog";

const repository = createMemoryRepository();
const NBSP = " ";

/** Una pala de la semilla con precio, de la que se derivan las dos ediciones. */
async function base(): Promise<Pala> {
  const [slug] = await repository.getPricedPalaSlugs();
  const pala = await repository.getPalaBySlug(slug);
  assert.ok(pala?.price);
  return pala;
}

function edition(pala: Pala, year: number, price: number | null, changes: Partial<Pala> = {}): Pala {
  assert.ok(pala.price);
  return {
    ...pala,
    slug: `${pala.slug}-${year}`,
    year,
    price: price === null ? null : { ...pala.price, current: price, freshness: "current", storeCount: 2 },
    ...changes,
  };
}

describe("diferencia de precio entre ediciones", () => {
  it("en euros y en tanto por ciento sobre la pala de la ficha", async () => {
    const pala = await base();
    assert.deepEqual(seasonPriceGap(edition(pala, 2026, 250), edition(pala, 2025, 200)), {
      current: 250,
      other: 200,
      difference: -50,
      percent: -20,
    });
  });

  it("no existe si alguna no tiene precio o lo tiene sin confirmar", async () => {
    const pala = await base();
    const current = edition(pala, 2026, 250);
    assert.equal(seasonPriceGap(current, edition(pala, 2025, null)), null);

    const stale = edition(pala, 2025, 200);
    assert.ok(stale.price);
    assert.equal(seasonPriceGap(current, { ...stale, price: { ...stale.price, freshness: "stale" } }), null);
  });
});

describe("comparación de dos ediciones", () => {
  it("separa lo que cambia, lo que se mantiene y lo que no se puede comparar", async () => {
    const pala = await base();
    const current = edition(pala, 2026, 250, { balance: "alto", hardness: "Dura", player: "Jugador de ejemplo" });
    const older = edition(pala, 2025, 200, { balance: "medio", hardness: "Dura", player: null });
    const comparison = compareSeasons(current, older);

    assert.deepEqual(comparison.changed, [{ label: "Balance", current: "Alto", other: "Medio" }]);
    assert.ok(comparison.same.includes("Forma"));
    assert.ok(comparison.same.includes("Dureza"));
    assert.ok(comparison.unknown.includes("Jugador"));
    // El año distingue a las ediciones: no es una diferencia que contar.
    assert.ok(![...comparison.same, ...comparison.unknown, ...comparison.changed.map((row) => row.label)].includes("Año"));
    assert.equal(comparison.year, 2025);
    assert.equal(comparison.storeCount, 2);
  });

  it("el mismo dato escrito de otra manera no cuenta como cambio", async () => {
    const pala = await base();
    const comparison = compareSeasons(
      edition(pala, 2026, 250, { specs: [{ label: "Núcleo", value: "MultiEVA" }] }),
      edition(pala, 2025, 200, { specs: [{ label: "Núcleo", value: "Multi Eva" }] }),
    );
    assert.ok(comparison.same.includes("Núcleo"));
    assert.ok(!comparison.changed.some((change) => change.label === "Núcleo"));
  });

  it("una cifra con otro decimal sí es un cambio", async () => {
    const pala = await base();
    const withThickness = (value: string) => ({ specs: [{ label: "Grosor", value }] });
    const changed = compareSeasons(edition(pala, 2026, 250, withThickness("38 mm")), edition(pala, 2025, 200, withThickness("3.8 mm")));
    assert.deepEqual(changed.changed, [{ label: "Grosor", current: "38 mm", other: "3.8 mm" }]);

    // Solo el espaciado no es un cambio.
    const same = compareSeasons(edition(pala, 2026, 250, withThickness("38 mm")), edition(pala, 2025, 200, withThickness("38mm")));
    assert.ok(same.same.includes("Grosor"));

    const carbon = (value: string) => ({ specs: [{ label: "Caras", value }] });
    assert.equal(compareSeasons(edition(pala, 2026, 250, carbon("Carbono 3K")), edition(pala, 2025, 200, carbon("Carbono 12K"))).changed.length, 1);
  });

  it("un porcentaje que redondea a cero no se enseña", async () => {
    const pala = await base();
    const comparison = compareSeasons(edition(pala, 2026, 300), edition(pala, 2025, 301));
    assert.equal(comparison.price?.percent, 0);
    assert.ok(comparison.conclusion?.startsWith(`La edición de 2025 cuesta hoy 1${NBSP}€ más.`));
    assert.ok(!comparison.conclusion?.includes("%"));
  });

  it("la conclusión da el ahorro de la edición anterior sin decir cuál es mejor", async () => {
    const pala = await base();
    const comparison = compareSeasons(
      edition(pala, 2026, 250, { balance: "alto" }),
      edition(pala, 2025, 200, { balance: "medio" }),
    );

    assert.ok(comparison.conclusion);
    assert.ok(comparison.conclusion.startsWith(`La edición de 2025 cuesta hoy 50${NBSP}€ menos (20${NBSP}%).`));
    assert.ok(comparison.conclusion.includes("Cambian 1 de las"));
    assert.ok(comparison.conclusion.endsWith("revísalas para valorar si te compensa pagar la diferencia."));
    assert.doesNotMatch(comparison.conclusion, /mejor|peor|superior|inferior/i);
  });

  it("si la edición posterior es más cara, se dice sin consejo de ahorro", async () => {
    const pala = await base();
    const comparison = compareSeasons(edition(pala, 2025, 200), edition(pala, 2026, 250));
    assert.ok(comparison.conclusion?.startsWith(`La edición de 2026 cuesta hoy 50${NBSP}€ más (25${NBSP}%).`));
    assert.ok(!comparison.conclusion?.includes("compensa"));
  });

  it("sin precio en las dos no hay conclusión", async () => {
    const pala = await base();
    const comparison = compareSeasons(edition(pala, 2026, 250), edition(pala, 2025, null));
    assert.equal(comparison.price, null);
    assert.equal(comparison.conclusion, null);
    assert.equal(comparison.storeCount, 0);
  });

  it("con el mismo precio no se inventa un ahorro", async () => {
    const pala = await base();
    const comparison = compareSeasons(edition(pala, 2026, 200), edition(pala, 2025, 200.2));
    assert.equal(comparison.conclusion, "La edición de 2025 cuesta hoy prácticamente lo mismo que la de 2026.");
  });
});
