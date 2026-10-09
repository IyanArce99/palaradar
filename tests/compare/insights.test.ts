// Lo que el comparador afirma de dos o tres palas: puntuaciones enfrentadas,
// «¿Cuál elegir?», precio, preguntas frecuentes y tarjetas de otras comparaciones.
// Todo debe salir de datos; sin el dato, la frase no aparece.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRepository } from "@/data/memory-repository";
import {
  buildScoreRows,
  buildVerdict,
  cardPalaFromSummary,
  comparisonCard,
  comparisonFaq,
  inStockCount,
  pickFeaturedPairs,
  priceConclusion,
  priceFacts,
  RECENT_MIN_WEEKLY,
  relatedComparisons,
} from "@/lib/compare-insights";
import type { Pala, PalaSummary } from "@/types/catalog";
import type { PriceSummary } from "@/types/pricing";

const repository = createMemoryRepository();
/** El espacio duro que pone lib/format.ts entre la cifra y su unidad */
const NBSP = " ";

/** Dos palas «parecidas» de la semilla y una tercera, todas con precio. */
async function fixtures(): Promise<{ a: Pala; b: Pala; c: Pala }> {
  const [[slugA, slugB]] = await repository.getAlternativePairs();
  const a = await repository.getPalaBySlug(slugA);
  const b = await repository.getPalaBySlug(slugB);
  assert.ok(a?.price && b?.price);

  for (const slug of await repository.getPricedPalaSlugs()) {
    const c = await repository.getPalaBySlug(slug);
    if (c?.price && c.slug !== a.slug && c.slug !== b.slug) return { a, b, c };
  }
  throw new Error("La semilla no tiene una tercera pala con precio");
}

function rated(pala: Pala, scores: Record<string, number>): Pala {
  return {
    ...pala,
    sourceRatings: {
      source: "PadelZoom",
      scores: Object.entries(scores).map(([label, score]) => ({ label, score })),
      total: null,
    },
  };
}

function priced(pala: Pala, current: number, changes: Partial<PriceSummary> = {}): Pala {
  assert.ok(pala.price);
  return { ...pala, price: { ...pala.price, current, freshness: "current", ...changes } };
}

describe("puntuaciones enfrentadas", () => {
  it("no hay comparación si solo una pala tiene puntuaciones", async () => {
    const { a, b } = await fixtures();
    assert.equal(buildScoreRows([rated(a, { Potencia: 9 }), { ...b, sourceRatings: null }]), null);
    assert.equal(buildScoreRows([{ ...a, sourceRatings: null }, { ...b, sourceRatings: null }]), null);
  });

  it("dice quién va por delante y por cuánto, con la fuente", async () => {
    const { a, b } = await fixtures();
    const scores = buildScoreRows([rated(a, { Potencia: 7.8, Control: 9 }), rated(b, { Potencia: 9.3, Control: 7.4 })]);

    assert.equal(scores?.source, "PadelZoom");
    assert.deepEqual(scores?.rows, [
      { label: "Potencia", scores: [7.8, 9.3], lead: { index: 1, gap: 1.5 } },
      { label: "Control", scores: [9, 7.4], lead: { index: 0, gap: 1.6 } },
    ]);
  });

  it("con menos de 0,3 puntos de diferencia son «muy parecidas»", async () => {
    const { a, b } = await fixtures();
    const scores = buildScoreRows([rated(a, { Potencia: 8.2, Control: 8.2 }), rated(b, { Potencia: 8.4, Control: 8.5 })]);
    assert.equal(scores?.rows[0].lead, null);
    assert.deepEqual(scores?.rows[1].lead, { index: 1, gap: 0.3 });
  });

  it("un aspecto que solo puntúa una pala no se enfrenta", async () => {
    const { a, b } = await fixtures();
    const scores = buildScoreRows([rated(a, { Potencia: 8, Control: 9 }), rated(b, { Potencia: 9 })]);
    assert.deepEqual(scores?.rows.map((row) => row.label), ["Potencia"]);
  });

  it("con tres palas, la ventaja es sobre la segunda", async () => {
    const { a, b, c } = await fixtures();
    const scores = buildScoreRows([rated(a, { Potencia: 7 }), rated(b, { Potencia: 9.5 }), rated(c, { Potencia: 8.5 })]);
    assert.deepEqual(scores?.rows[0], { label: "Potencia", scores: [7, 9.5, 8.5], lead: { index: 1, gap: 1 } });
  });
});

describe("«¿Cuál elegir?»", () => {
  it("cada ventaja lleva su dato y ninguna opina", async () => {
    const { a, b } = await fixtures();
    const verdict = buildVerdict([
      priced(rated({ ...a, shape: "lagrima", balance: "medio" }, { Potencia: 7.8, Control: 9, Manejabilidad: 8 }), 229),
      priced(rated({ ...b, shape: "diamante", balance: "alto" }, { Potencia: 9.3, Control: 8.5, Manejabilidad: 8 }), 259.95),
    ]);

    assert.ok(verdict.advantages[0].includes("Algo más de control: 9,0 frente a 8,5"));
    assert.ok(verdict.advantages[0].includes("Forma lágrima y balance medio"));
    assert.ok(verdict.advantages[0].includes(`30,95${NBSP}€ más barata hoy`));
    assert.ok(verdict.advantages[1].includes("Más potencia: 9,3 frente a 7,8"));
    assert.ok(verdict.advantages[1].includes("Forma diamante y balance alto"));
    // Empatadas en manejabilidad: no es ventaja de ninguna.
    assert.ok(!verdict.advantages.flat().some((line) => /manejabilidad/i.test(line)));
    assert.doesNotMatch(verdict.advantages.flat().join(" "), /mejor|peor|recomend|ideal|ofensiv/i);

    assert.deepEqual(verdict.summary, [
      { index: 0, text: "Si priorizas el control" },
      { index: 1, text: "Si priorizas la potencia" },
    ]);
    assert.equal(verdict.source, "PadelZoom");
  });

  it("un balance sin declarar no cuenta como diferencia", async () => {
    const { a, b } = await fixtures();
    const same: Pick<Pala, "shape" | "playStyle" | "levels" | "weight" | "sourceRatings"> = {
      shape: "diamante",
      playStyle: null,
      levels: [],
      weight: null,
      sourceRatings: null,
    };
    const verdict = buildVerdict([
      priced({ ...a, ...same, balance: "alto" }, 200),
      priced({ ...b, ...same, balance: null }, 200),
    ]);
    assert.deepEqual(verdict.advantages, [[], []]);
    assert.deepEqual(verdict.summary, []);
    assert.equal(verdict.source, null);
  });

  it("sin puntuaciones, el resumen sale del precio y no nombra ninguna fuente", async () => {
    const { a, b } = await fixtures();
    const verdict = buildVerdict([
      priced({ ...a, sourceRatings: null }, 180),
      priced({ ...b, sourceRatings: null }, 150),
    ]);
    assert.deepEqual(verdict.summary, [{ index: 1, text: "Si buscas el precio más bajo hoy" }]);
    assert.ok(verdict.advantages[1].includes(`30,00${NBSP}€ más barata hoy`));
    assert.equal(verdict.source, null);
  });

  it("no compara un precio caducado como si fuera actual", async () => {
    const { a, b } = await fixtures();
    const verdict = buildVerdict([
      priced({ ...a, sourceRatings: null }, 180),
      priced({ ...b, sourceRatings: null }, 150, { freshness: "stale" }),
    ]);
    assert.ok(!verdict.advantages.flat().some((line) => /barata/.test(line)));
  });

  it("con tres palas nombra a la que va por delante en cada cosa", async () => {
    const { a, b, c } = await fixtures();
    const verdict = buildVerdict([
      priced(rated(a, { Potencia: 7 }), 200),
      priced(rated(b, { Potencia: 9.5 }), 250),
      priced(rated(c, { Potencia: 8.5 }), 120),
    ]);
    assert.ok(verdict.advantages[1].includes("La de más potencia: 9,5 sobre 10"));
    assert.ok(verdict.advantages[2].includes(`La más barata hoy: 120,00${NBSP}€`));
  });

  it("con tres palas, un atributo solo distingue a la que no lo comparte con ninguna", async () => {
    const { a, b, c } = await fixtures();
    const plain = { sourceRatings: null, playStyle: null, levels: [], weight: null, balance: null, price: null };
    const verdict = buildVerdict([
      { ...a, ...plain, shape: "diamante" },
      { ...b, ...plain, shape: "diamante" },
      { ...c, ...plain, shape: "redonda" },
    ]);
    assert.deepEqual(verdict.advantages, [[], [], ["Forma redonda"]]);
  });
});

describe("precio en la comparación", () => {
  it("el ahorro sale del PVPR, solo si el precio vigente está por debajo", async () => {
    const { a } = await fixtures();
    assert.deepEqual(priceFacts(priced({ ...a, msrp: 300 }, 225)).saving, { amount: 75, percent: 25 });
    assert.equal(priceFacts(priced({ ...a, msrp: 200 }, 225)).saving, null);
    assert.equal(priceFacts(priced({ ...a, msrp: null }, 225)).msrp, null);
    // Un precio caducado no se presenta como actual: sin cifra vigente no hay ahorro.
    assert.equal(priceFacts(priced({ ...a, msrp: 300 }, 225, { freshness: "stale" })).current, null);
  });

  it("cuenta las tiendas que declaran stock", async () => {
    const { a } = await fixtures();
    assert.ok(a.price);
    const [offer] = a.price.offers;
    const offers = [
      { ...offer, availability: "En stock" },
      { ...offer, availability: "Sin stock" },
      { ...offer, availability: "en stock, envío en 24 h" },
    ];
    assert.equal(inStockCount(priced(a, 200, { offers })), 2);
    assert.equal(inStockCount({ ...a, price: null }), 0);
  });

  it("dice cuál es más barata y cuál tiene más descuento", async () => {
    const { a, b } = await fixtures();
    const conclusion = priceConclusion([
      priced({ ...a, model: "Uno", msrp: 300 }, 240),
      priced({ ...b, model: "Dos", msrp: 400 }, 200),
    ]);
    assert.equal(conclusion?.strong, `la Dos es 40,00${NBSP}€ más barata`);
    assert.match(conclusion?.after ?? "", new RegExp(`más descuento sobre su PVPR \\(50${NBSP}% frente a 20${NBSP}%\\)`));
  });

  it("si solo una tiene precio, no hay más barata", async () => {
    const { a, b } = await fixtures();
    const conclusion = priceConclusion([priced({ ...a, model: "Uno" }, 240), { ...b, price: null }]);
    assert.equal(conclusion?.strong, "la Uno tiene precio");
    assert.equal(priceConclusion([{ ...a, price: null }, { ...b, price: null }]), null);
  });

  it("reconoce que cuestan lo mismo", async () => {
    const { a, b } = await fixtures();
    assert.equal(priceConclusion([priced(a, 180), priced(b, 180)])?.strong, "Las dos cuestan lo mismo hoy");
  });
});

describe("preguntas frecuentes de la comparación", () => {
  it("sin puntuaciones no pregunta por potencia ni control", async () => {
    const { a, b } = await fixtures();
    const faq = comparisonFaq([{ ...a, sourceRatings: null }, { ...b, sourceRatings: null }]);
    assert.ok(!faq.some((item) => /potencia|control/.test(item.question)));
  });

  it("responde con los datos y nombra la fuente de las puntuaciones", async () => {
    const { a, b } = await fixtures();
    const faq = comparisonFaq([
      priced(rated({ ...a, model: "Uno" }, { Potencia: 7.8 }), 229),
      priced(rated({ ...b, model: "Dos" }, { Potencia: 9.3 }), 259.95),
    ]);
    const power = faq.find((item) => item.question === "¿Cuál tiene más potencia, la Uno o la Dos?");
    assert.match(power?.answer ?? "", /PadelZoom, la Dos\. Sobre 10 en potencia: Uno, 7,8; Dos, 9,3\./);

    const price = faq.find((item) => item.question === "¿Cuál está más barata ahora?");
    assert.match(price?.answer ?? "", /la Uno está a 229,00.€ y la Dos está a 259,95.€: 30,95.€ de diferencia/);
  });
});

describe("tarjetas de comparaciones", () => {
  const summary = (slug: string, changes: Partial<PalaSummary> = {}): PalaSummary => ({
    id: slug,
    slug,
    brand: { slug: "marca", name: "Marca" },
    model: slug,
    year: 2026,
    image: `https://example.supabase.co/storage/v1/object/public/media/rackets/${slug}/primary.jpg`,
    shape: "diamante",
    description: "",
    rating: 0,
    reviewCount: 0,
    price: 200,
    previousPrice: null,
    dropPercent: null,
    storeCount: 1,
    priceNote: null,
    priceRecent: true,
    ...changes,
  });

  it("enlaza a la URL canónica y resume formas y precio de partida", () => {
    const card = comparisonCard(
      cardPalaFromSummary(summary("nox-x-2026", { shape: "lagrima", price: 229 })),
      cardPalaFromSummary(summary("adidas-y-2026", { price: 219.5 })),
    );
    assert.equal(card.href, "/comparar/adidas-y-2026-vs-nox-x-2026/");
    assert.equal(card.a.slug, "adidas-y-2026");
    assert.equal(card.meta, `Diamante vs Lágrima · desde 219,50${NBSP}€`);
  });

  it("dos temporadas del mismo modelo se distinguen por el año", () => {
    const card = comparisonCard(
      cardPalaFromSummary(summary("m-vertex-2026", { model: "Vertex", price: null })),
      cardPalaFromSummary(summary("m-vertex-2025", { model: "Vertex", year: 2025, price: null })),
    );
    assert.equal(card.meta, "2025 vs 2026");
  });

  it("solo destaca pares con precio vigente y foto real en las dos palas", () => {
    const summaries = [
      summary("a-2026"),
      summary("b-2026"),
      summary("sin-precio-2026", { price: null }),
      summary("sin-foto-2026", { image: null }),
      summary("ilustracion-2026", { image: "/img/palas/ilustracion.svg" }),
    ];
    const cards = pickFeaturedPairs(
      [
        ["b-2026", "a-2026"],
        ["a-2026", "b-2026"],
        ["a-2026", "sin-precio-2026"],
        ["a-2026", "sin-foto-2026"],
        ["b-2026", "ilustracion-2026"],
        ["a-2026", "no-existe-2026"],
      ],
      summaries,
      6,
    );
    assert.deepEqual(cards.map((card) => card.href), ["/comparar/a-2026-vs-b-2026/"]);
  });

  it("reparte las palas para no repetir siempre la misma y respeta el límite", () => {
    const summaries = ["a", "b", "c", "d", "e"].map((name) => summary(`${name}-2026`));
    const pairs: [string, string][] = [
      ["a-2026", "b-2026"],
      ["a-2026", "c-2026"],
      ["a-2026", "d-2026"],
      ["d-2026", "e-2026"],
    ];
    const cards = pickFeaturedPairs(pairs, summaries, 2);
    assert.deepEqual(cards.map((card) => card.href), ["/comparar/a-2026-vs-b-2026/", "/comparar/d-2026-vs-e-2026/"]);
    assert.equal(pickFeaturedPairs(pairs, summaries, 10).length, 4);
  });

  it("las relacionadas enfrentan cada pala con sus parecidas, sin las que ya se comparan", async () => {
    const { a, b } = await fixtures();
    const cards = relatedComparisons([a, b], 3);
    assert.ok(cards.length <= 3);
    for (const card of cards) {
      const slugs = [card.a.slug, card.b.slug];
      assert.ok(slugs.includes(a.slug) || slugs.includes(b.slug));
      assert.ok(!(slugs.includes(a.slug) && slugs.includes(b.slug)));
    }
    assert.equal(new Set(cards.map((card) => card.href)).size, cards.length);
  });

  it("varias palas se piden de una vez y las que no existen no se devuelven", async () => {
    const { a, b } = await fixtures();
    const summaries = await repository.getPalaSummaries([b.slug, "no-existe-2026", a.slug]);
    assert.deepEqual(summaries.map((pala) => pala.slug).sort(), [a.slug, b.slug].sort());
    assert.deepEqual(await repository.getPalaSummaries([]), []);
  });
});

describe("comparaciones recientes", () => {
  it("solo se enseñan a partir de 20 comparaciones en siete días", () => {
    assert.equal(RECENT_MIN_WEEKLY, 20);
  });
});
