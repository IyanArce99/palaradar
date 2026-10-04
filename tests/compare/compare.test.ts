// Comparador: URLs, filas enfrentadas, diferencia de precio, histórico y pares curados.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRepository } from "@/data/memory-repository";
import {
  buildCompareRows,
  canonicalPair,
  comparePath,
  compareSelectPath,
  describeDifferences,
  displayValue,
  hasEnoughHistory,
  isCuratedPair,
  MIN_HISTORY_DAYS,
  priceDifference,
  priceHeading,
  resolvePair,
  uniquePairs,
} from "@/lib/compare";
import type { Pala, PricePoint } from "@/types/catalog";
import type { PriceSummary } from "@/types/pricing";

const repository = createMemoryRepository();

/** Dos palas de la semilla que son «parecidas» entre sí, y una tercera que no lo es de la primera. */
async function fixtures(): Promise<{ a: Pala; b: Pala; unrelated: Pala }> {
  const [[slugA, slugB]] = await repository.getAlternativePairs();
  const a = await repository.getPalaBySlug(slugA);
  const b = await repository.getPalaBySlug(slugB);
  assert.ok(a && b);

  const related = new Set([a.slug, ...a.alternatives.map(({ pala }) => pala.slug)]);
  for (const slug of await repository.getAllPalaSlugs()) {
    const candidate = await repository.getPalaBySlug(slug);
    if (!candidate || related.has(candidate.slug)) continue;
    if (candidate.alternatives.some(({ pala }) => pala.slug === a.slug)) continue;
    return { a, b, unrelated: candidate };
  }
  throw new Error("La semilla no tiene una pala sin relación con la primera");
}

function withPrice(pala: Pala, changes: Partial<PriceSummary> | null): Pala {
  if (changes === null) return { ...pala, price: null };
  assert.ok(pala.price, `${pala.slug} debería tener precio en la semilla`);
  return { ...pala, price: { ...pala.price, ...changes } };
}

function days(count: number): PricePoint[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    price: 200,
  }));
}

describe("URLs del comparador", () => {
  it("ordena el par alfabéticamente por slug", () => {
    assert.deepEqual(canonicalPair("nox-at10-2026", "adidas-metalbone-2026"), [
      "adidas-metalbone-2026",
      "nox-at10-2026",
    ]);
    assert.equal(
      comparePath("nox-at10-2026", "adidas-metalbone-2026"),
      "/comparar/adidas-metalbone-2026-vs-nox-at10-2026/",
    );
  });

  it("acepta el par en orden canónico", () => {
    assert.deepEqual(resolvePair("adidas-metalbone-2026-vs-nox-at10-2026"), {
      type: "ok",
      a: "adidas-metalbone-2026",
      b: "nox-at10-2026",
    });
  });

  it("redirige el orden inverso al canónico", () => {
    assert.deepEqual(resolvePair("nox-at10-2026-vs-adidas-metalbone-2026"), {
      type: "reorder",
      path: "/comparar/adidas-metalbone-2026-vs-nox-at10-2026/",
    });
  });

  it("detecta la misma pala dos veces", () => {
    assert.deepEqual(resolvePair("nox-at10-2026-vs-nox-at10-2026"), {
      type: "same",
      slug: "nox-at10-2026",
    });
  });

  it("rechaza las URLs mal formadas", () => {
    for (const segment of ["nox-at10-2026", "-vs-nox-at10-2026", "a-vs-b-vs-c", "A-vs-b", "a_b-vs-c", ""]) {
      assert.deepEqual(resolvePair(segment), { type: "invalid" }, segment);
    }
  });

  it("construye la URL de selección solo con las palas elegidas", () => {
    assert.equal(compareSelectPath(), "/comparar/");
    assert.equal(compareSelectPath({ a: "x-2026", b: null }), "/comparar/?a=x-2026");
    assert.equal(compareSelectPath({ a: "x-2026", b: "y-2026" }), "/comparar/?a=x-2026&b=y-2026");
  });
});

describe("filas enfrentadas", () => {
  it("muestra el atributo cuando existe en las dos palas", async () => {
    const { a, b } = await fixtures();
    const row = buildCompareRows(a, b).find((item) => item.label === "Forma");
    assert.ok(row?.a && row.b);
  });

  it("deja sin datos la pala que no declara el atributo", async () => {
    const { a, b } = await fixtures();
    const rows = buildCompareRows({ ...a, balance: "alto" }, { ...b, balance: null });
    assert.deepEqual(
      rows.find((row) => row.label === "Balance"),
      { label: "Balance", a: "Alto", b: null },
    );
  });

  it("oculta la fila que no declara ninguna de las dos", async () => {
    const { a, b } = await fixtures();
    const rows = buildCompareRows(
      { ...a, hardness: null, player: null },
      { ...b, hardness: null, player: null },
    );
    assert.equal(rows.some((row) => row.label === "Dureza" || row.label === "Jugador"), false);
    assert.ok(rows.every((row) => row.a !== null || row.b !== null));
  });

  it("normaliza los valores solo para mostrarlos", () => {
    assert.equal(displayValue("arenosa"), "Arenosa");
    assert.equal(displayValue("Dura, Media"), "Dura / Media");
    assert.equal(displayValue("  "), null);
    assert.equal(displayValue(null), null);
  });
});

describe("precio en la comparación", () => {
  it("usa los mismos rótulos de frescura que la ficha", async () => {
    const { a } = await fixtures();
    assert.equal(priceHeading(withPrice(a, { freshness: "current" }).price), "Mejor precio hoy");
    assert.equal(priceHeading(withPrice(a, { freshness: "stale" }).price), "Último precio conocido");
    assert.equal(priceHeading(null), "Sin precio ahora mismo");
  });

  it("da la diferencia cuando los dos precios están vigentes", async () => {
    const { a, b } = await fixtures();
    const difference = priceDifference(
      withPrice(a, { current: 239.95, freshness: "current" }),
      withPrice(b, { current: 199.95, freshness: "recent" }),
    );
    assert.deepEqual(difference, { cheaper: "b", amount: 40 });
  });

  it("no compara si una de las dos no tiene precio", async () => {
    const { a, b } = await fixtures();
    assert.equal(priceDifference(a, withPrice(b, null)), null);
  });

  it("no compara un precio caducado como si fuera actual", async () => {
    const { a, b } = await fixtures();
    assert.equal(priceDifference(a, withPrice(b, { freshness: "stale" })), null);
  });

  it("reconoce que cuestan lo mismo", async () => {
    const { a, b } = await fixtures();
    const same = { current: 180, freshness: "current" } as const;
    assert.deepEqual(priceDifference(withPrice(a, same), withPrice(b, same)), {
      cheaper: null,
      amount: 0,
    });
  });
});

describe("histórico en la comparación", () => {
  it("no basta con menos de 14 días registrados", async () => {
    const { a } = await fixtures();
    assert.equal(hasEnoughHistory({ ...a, priceHistory: days(MIN_HISTORY_DAYS - 1) }), false);
  });

  it("basta con 14 días o más, si la pala tiene precio", async () => {
    const { a } = await fixtures();
    assert.equal(hasEnoughHistory({ ...a, priceHistory: days(MIN_HISTORY_DAYS) }), true);
    assert.equal(hasEnoughHistory({ ...withPrice(a, null), priceHistory: days(30) }), false);
  });
});

describe("«En qué se diferencian»", () => {
  it("describe forma, balance y peso sin valorar", async () => {
    const { a, b } = await fixtures();
    const text = describeDifferences(
      { ...a, model: "Uno", shape: "diamante", balance: "alto", weight: { min: 370, max: 370 } },
      { ...b, model: "Dos", shape: "redonda", balance: "medio", weight: { min: 360, max: 360 } },
    ).join(" ");

    assert.match(text, /La Uno tiene forma diamante y balance alto\./);
    assert.match(text, /La Dos tiene forma redonda y balance medio y pesa 10 g menos\./);
    assert.doesNotMatch(text, /mejor|peor|potente|manejable|recomend/i);
  });

  it("nombra los materiales que las dos declaran y no coinciden", async () => {
    const { a, b } = await fixtures();
    const text = describeDifferences(
      { ...a, model: "Uno", hardness: "Dura", specs: [{ label: "Núcleo", value: "MultiEva" }] },
      { ...b, model: "Dos", hardness: "media", specs: [{ label: "Núcleo", value: "MultiEva" }] },
    ).join(" ");

    assert.match(text, /También cambian: dureza \(Dura en la Uno, Media en la Dos\)\./);
    assert.doesNotMatch(text, /núcleo/);
  });

  it("no menciona el peso si alguna no lo declara", async () => {
    const { a, b } = await fixtures();
    const text = describeDifferences({ ...a, weight: null }, b).join(" ");
    assert.doesNotMatch(text, /pesa/);
  });
});

describe("pares curados", () => {
  it("un par de palas «parecidas» es curado en los dos sentidos", async () => {
    const { a, b } = await fixtures();
    assert.equal(isCuratedPair(a, b), true);
    assert.equal(isCuratedPair(b, a), true);
  });

  it("una combinación cualquiera no es curada", async () => {
    const { a, unrelated } = await fixtures();
    assert.equal(isCuratedPair(a, unrelated), false);
  });

  it("los pares del sitemap no se repiten y van en orden canónico", async () => {
    const pairs = uniquePairs([
      ["b-2026", "a-2026"],
      ["a-2026", "b-2026"],
      ["c-2026", "a-2026"],
    ]);
    assert.deepEqual(pairs, [
      ["a-2026", "b-2026"],
      ["a-2026", "c-2026"],
    ]);
  });
});
