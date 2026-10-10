// Panel interno de calidad: sugerencias de emparejamiento explicables que nunca
// confirman nada, e incidencias que distinguen un error de un dato que falta.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AMBIGUITY_MARGIN, suggestMatches, type CatalogCandidate } from "@/quality/matching";
import {
  buildQualityReport,
  duplicateKey,
  missingFields,
  type QualityInput,
  type RacketQualityRow,
  type StoreHealth,
} from "@/quality/report";

const NOW = new Date("2026-10-09T12:00:00Z");
const HOUR = 3_600_000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR).toISOString();

// Códigos con dígito de control válido (los inválidos se descartan al normalizar).
const GTIN_A = "08445402973897";
const GTIN_B = "08445402973903";
const OTHER_EAN = "8445402999996";

const catalog: CatalogCandidate[] = [
  { id: "1", slug: "bullpadel-vertex-04-2025", brand: "Bullpadel", model: "Vertex 04", year: 2025, shape: "diamante", gtins: [GTIN_A] },
  { id: "2", slug: "bullpadel-vertex-04-2024", brand: "Bullpadel", model: "Vertex 04", year: 2024, shape: "diamante", gtins: [] },
  { id: "3", slug: "bullpadel-vertex-04-comfort-2025", brand: "Bullpadel", model: "Vertex 04 Comfort", year: 2025, shape: "diamante", gtins: [] },
  { id: "4", slug: "bullpadel-vertex-04-hybrid-2025", brand: "Bullpadel", model: "Vertex 04 Hybrid", year: 2025, shape: "hibrida", gtins: [] },
  { id: "5", slug: "nox-at10-genius-18k-2025", brand: "Nox", model: "AT10 Genius 18K", year: 2025, shape: "lagrima", gtins: [GTIN_B] },
];

describe("sugerencias de emparejamiento", () => {
  it("el EAN que coincide manda, y aun así queda pendiente de una persona", () => {
    const review = suggestMatches({ title: "Pala Bullpadel Vertex 04 25", brand: "Bullpadel", gtin: "8445402973897" }, catalog);
    const [first] = review.suggestions;
    assert.equal(first.candidate.slug, "bullpadel-vertex-04-2025");
    assert.equal(first.gtinMatches, true);
    assert.equal(first.confidence, "alta");
    assert.equal(first.score, 100);
    assert.ok(first.reasons.includes("El EAN del producto es uno de los de esta pala."));
    assert.equal(review.verdict, "Coincidencia clara, pendiente de que alguien la confirme.");
  });

  it("nombre, año y variante iguales dan confianza alta sin EAN, diciendo que no hay EAN", () => {
    const review = suggestMatches({ title: "Bullpadel Vertex 04 Comfort 2025", brand: "Bullpadel", gtin: null }, catalog);
    const [first] = review.suggestions;
    assert.equal(first.candidate.slug, "bullpadel-vertex-04-comfort-2025");
    assert.equal(first.confidence, "alta");
    assert.equal(first.nameSimilarity, 1);
    assert.ok(first.reasons.includes("Mismo año: 2025."));
    assert.ok(first.reasons.includes("Misma variante: comfort."));
    assert.ok(first.differences.some((text) => text.startsWith("La tienda no publica el EAN")));
  });

  it("sin año en el título no hay confianza alta y se dice qué falta", () => {
    const review = suggestMatches({ title: "Bullpadel Vertex 04", brand: "Bullpadel", gtin: null }, catalog);
    assert.ok(review.suggestions.length >= 2);
    assert.ok(review.suggestions.every((item) => item.confidence !== "alta"));
    assert.ok(review.suggestions[0].differences.some((text) => text.startsWith("El título no indica el año")));
    // Las ediciones de 2024 y 2025 quedan igual de cerca: no se elige por el revisor.
    assert.equal(review.ambiguous, true);
    assert.ok(Math.abs(review.suggestions[0].score - review.suggestions[1].score) < AMBIGUITY_MARGIN);
    assert.equal(review.verdict, "Varias palas quedan igual de cerca: hay que distinguirlas a mano.");
  });

  it("una variante distinta penaliza y se explica", () => {
    const review = suggestMatches({ title: "Bullpadel Vertex 04 Hybrid 2025", brand: "Bullpadel", gtin: null }, catalog);
    assert.equal(review.suggestions[0].candidate.slug, "bullpadel-vertex-04-hybrid-2025");
    const plain = review.suggestions.find((item) => item.candidate.slug === "bullpadel-vertex-04-2025");
    assert.ok(plain);
    assert.equal(plain.confidence, "baja");
    assert.ok(plain.differences.some((text) => text.startsWith("Variante distinta")));
  });

  it("un EAN que contradice al de la pala nunca da confianza", () => {
    const review = suggestMatches({ title: "Bullpadel Vertex 04 2025", brand: "Bullpadel", gtin: OTHER_EAN }, catalog);
    const sameName = review.suggestions.find((item) => item.candidate.slug === "bullpadel-vertex-04-2025");
    assert.ok(sameName);
    assert.equal(sameName.confidence, "baja");
    assert.ok(sameName.differences.some((text) => text.startsWith("EAN distinto")));
  });

  it("un EAN con el dígito de control mal no cuenta como EAN", () => {
    const review = suggestMatches({ title: "Bullpadel Vertex 04 2025", brand: "Bullpadel", gtin: "8445402973896" }, catalog);
    assert.ok(review.suggestions.every((item) => !item.gtinMatches));
    assert.ok(!review.suggestions.some((item) => item.differences.some((text) => text.startsWith("EAN distinto"))));
  });

  it("solo propone palas de la misma marca, la declare la tienda o salga del título", () => {
    const declared = suggestMatches({ title: "AT10 Genius 18K 2025", brand: "Nox", gtin: null }, catalog);
    assert.deepEqual(declared.suggestions.map((item) => item.candidate.brand), ["Nox"]);
    const fromTitle = suggestMatches({ title: "Pala Nox AT10 Genius 18K 2025", brand: null, gtin: null }, catalog);
    assert.equal(fromTitle.suggestions[0].candidate.slug, "nox-at10-genius-18k-2025");
  });

  it("sin nada parecido no inventa un candidato", () => {
    const review = suggestMatches({ title: "Bullpadel Hack 04 2026", brand: "Bullpadel", gtin: null }, catalog);
    assert.deepEqual(review.suggestions, []);
    assert.equal(review.verdict, "Ninguna pala del catálogo se parece: probablemente falta su ficha.");
    assert.equal(suggestMatches({ title: "Pala desconocida", brand: null, gtin: null }, catalog).verdict, "Sin marca reconocible: no hay con qué compararlo.");
  });

  it("un pack no es una pala suelta, por mucho que se parezca el nombre", () => {
    const review = suggestMatches({ title: "Pack Bullpadel Vertex 04 2025 + paletero", brand: "Bullpadel", gtin: null }, catalog);
    assert.equal(review.verdict, "Pack: no es una pala suelta comparable.");
    const outlet = suggestMatches({ title: "Bullpadel Vertex 04 2025 Outlet", brand: "Bullpadel", gtin: null }, catalog);
    assert.equal(outlet.verdict, "Accesorio, pala de test, outlet o de segunda mano: no es una pala suelta comparable.");
  });

  it("es determinista y respeta el límite", () => {
    const product = { title: "Bullpadel Vertex 04", brand: "Bullpadel", gtin: null };
    assert.deepEqual(suggestMatches(product, catalog, 2), suggestMatches(product, [...catalog].reverse(), 2));
    assert.equal(suggestMatches(product, catalog, 2).suggestions.length, 2);
  });
});

// Regresiones de la auditoría V5: una sugerencia no debe animar a enlazar otra edición.
describe("sugerencias con nombres que no coinciden del todo (Q-01)", () => {
  const editions: CatalogCandidate[] = [
    { id: "a", slug: "adidas-metalbone-3-3-2024", brand: "Adidas", model: "Metalbone 3.3", year: 2024, shape: "diamante", gtins: [] },
    { id: "b", slug: "adidas-metalbone-ale-galan-2026", brand: "Adidas", model: "Metalbone Ale Galan", year: 2026, shape: "diamante", gtins: [] },
    { id: "c", slug: "bullpadel-hack-04-2026", brand: "Bullpadel", model: "Hack 04", year: 2026, shape: "diamante", gtins: [] },
    { id: "d", slug: "head-coello-pro-2026", brand: "Head", model: "Coello Pro", year: 2026, shape: "diamante", gtins: [GTIN_B] },
    { id: "e", slug: "starvie-basalto-pro-2024", brand: "StarVie", model: "Basalto Pro", year: 2024, shape: "redonda", gtins: [] },
  ];
  const top = (title: string, brand: string, gtin: string | null = null) => suggestMatches({ title, brand, gtin }, editions).suggestions[0];

  it("una palabra de más en el título baja la confianza y se nombra", () => {
    const cases: [string, string, string, string][] = [
      ["ADIDAS METALBONE YOUTH 3.3 2024", "Adidas", "adidas-metalbone-3-3-2024", "«youth»"],
      ["ADIDAS METALBONE RESERVE ALE GALÁN 2026", "Adidas", "adidas-metalbone-ale-galan-2026", "«reserve»"],
      ["BULLPADEL HACK 04 PREMIER PADEL 26", "Bullpadel", "bullpadel-hack-04-2026", "«premier»"],
      ["HEAD COELLO PRO SPECIAL PACKAGING 2026", "Head", "head-coello-pro-2026", "«packaging», «special»"],
    ];
    for (const [title, brand, slug, extra] of cases) {
      const suggestion = top(title, brand);
      assert.equal(suggestion.candidate.slug, slug, title);
      assert.equal(suggestion.confidence, "baja", title);
      assert.ok(
        suggestion.differences.includes(`El título tiene palabras que el modelo no tiene (${extra}): puede ser otra edición o variante.`),
        `${title}: ${suggestion.differences.join(" | ")}`,
      );
    }
  });

  it("una palabra del modelo que falta en el título también", () => {
    const suggestion = top("STARVIE BASALTO 2024", "StarVie");
    assert.equal(suggestion.candidate.slug, "starvie-basalto-pro-2024");
    assert.equal(suggestion.confidence, "baja");
    assert.ok(suggestion.differences.includes("Al título le faltan palabras del modelo («pro»): puede ser otra edición o variante."));
  });

  it("el nombre exacto conserva su confianza, y no se listan palabras sobrantes", () => {
    const exact = top("Adidas Metalbone 3.3 2024", "Adidas");
    assert.equal(exact.confidence, "alta");
    assert.ok(!exact.differences.some((text) => text.includes("palabras")));
    // Sin año: nombre idéntico y candidato único, confianza media como antes.
    assert.equal(top("Pala Bullpadel Hack 04", "Bullpadel").confidence, "media");
  });

  it("solo el EAN, que identifica el producto, pasa por encima de un nombre distinto", () => {
    const suggestion = top("HEAD COELLO PRO SPECIAL PACKAGING 2026", "Head", GTIN_B);
    assert.equal(suggestion.gtinMatches, true);
    assert.equal(suggestion.confidence, "alta");
    // La palabra sobrante se sigue enseñando: es una ayuda para quien revisa, no una decisión.
    assert.ok(suggestion.differences.some((text) => text.includes("«packaging», «special»")));
  });
});

describe("empates entre candidatos (Q-02)", () => {
  // Dos fichas con el mismo nombre y año (dos colores), sin EAN que las distinga.
  const colours: CatalogCandidate[] = [
    { id: "n", slug: "bullpadel-vertex-04-negra-2025", brand: "Bullpadel", model: "Vertex 04", year: 2025, shape: "diamante", gtins: [] },
    { id: "r", slug: "bullpadel-vertex-04-roja-2025", brand: "Bullpadel", model: "Vertex 04", year: 2025, shape: "diamante", gtins: [] },
  ];
  const product = { title: "Bullpadel Vertex 04 2025", brand: "Bullpadel", gtin: GTIN_A };

  it("dos palas empatadas no tienen confianza alta, y se dice con cuál empatan", () => {
    const review = suggestMatches(product, colours);
    assert.equal(review.ambiguous, true);
    assert.equal(review.suggestions[0].score, review.suggestions[1].score);
    assert.deepEqual(review.suggestions.map((item) => item.confidence), ["media", "media"]);
    assert.ok(review.suggestions[0].differences.some((text) => text.includes("queda igual de cerca (bullpadel-vertex-04-roja-2025)")));
    assert.ok(review.suggestions[1].differences.some((text) => text.includes("queda igual de cerca (bullpadel-vertex-04-negra-2025)")));
    assert.equal(review.verdict, "Varias palas quedan igual de cerca: hay que distinguirlas a mano.");
  });

  it("el empate existe aunque solo se pida una sugerencia", () => {
    const review = suggestMatches(product, colours, 1);
    assert.equal(review.ambiguous, true);
    assert.equal(review.suggestions.length, 1);
    assert.equal(review.suggestions[0].confidence, "media");
    assert.ok(review.suggestions[0].differences.some((text) => text.includes("igual de cerca")));
    assert.equal(review.verdict, "Varias palas quedan igual de cerca: hay que distinguirlas a mano.");
  });

  it("se dice cuando el EAN del producto no se puede contrastar o la marca no cuadra", () => {
    // La pala no tiene EAN guardado: el del producto no confirma nada.
    const [noGtin] = suggestMatches({ title: "Bullpadel Vertex 04 Comfort 2025", brand: "Bullpadel", gtin: OTHER_EAN }, catalog).suggestions;
    assert.equal(noGtin.candidate.slug, "bullpadel-vertex-04-comfort-2025");
    assert.ok(noGtin.differences.includes("La pala del catálogo no tiene EAN guardado: el del producto no se puede contrastar."));
    // El EAN coincide, pero la tienda declara otra marca: ni con EAN se zanja solo.
    const [otherBrand] = suggestMatches({ title: "Nox Vertex 04 2025", brand: "Nox", gtin: "8445402973897" }, catalog).suggestions;
    assert.equal(otherBrand.candidate.slug, "bullpadel-vertex-04-2025");
    assert.equal(otherBrand.gtinMatches, true);
    assert.equal(otherBrand.confidence, "media");
    assert.ok(otherBrand.differences.includes("La tienda declara la marca «Nox» y la pala es de Bullpadel."));
  });

  it("el empate no depende del orden en que llegan las palas", () => {
    assert.deepEqual(suggestMatches(product, colours), suggestMatches(product, [...colours].reverse()));
  });

  it("un candidato claramente superior conserva la confianza alta", () => {
    const review = suggestMatches({ title: "Bullpadel Vertex 04 Comfort 2025", brand: "Bullpadel", gtin: null }, catalog);
    assert.equal(review.ambiguous, false);
    assert.equal(review.suggestions[0].confidence, "alta");
    assert.ok(!review.suggestions[0].differences.some((text) => text.includes("igual de cerca")));
  });

  it("sin candidatos válidos no hay empate ni confianza", () => {
    const review = suggestMatches({ title: "Bullpadel Hack 04 2026", brand: "Bullpadel", gtin: null }, colours);
    assert.deepEqual([review.suggestions.length, review.ambiguous], [0, false]);
  });

  it("en el informe, un empate no es trabajo rápido de prioridad alta", () => {
    const pending = { store: "Tienda A", brand: "Bullpadel", gtin: null, url: "https://tienda.example/p", note: null, price: 150, lastSeenAt: ago(2) };
    const rows = (models: string[]) => models.map((model, index) => racket(`pala-${index}`, { model, year: 2025, gtins: [] }));
    const severity = (models: string[], title: string) =>
      buildQualityReport({ rackets: rows(models), pending: [{ ...pending, title }], stores: [healthy] }, NOW).issues.find(
        (issue) => issue.type === "emparejamiento-pendiente",
      )?.severity;
    assert.equal(severity(["Vertex 04", "Vertex 04"], "Bullpadel Vertex 04 2025"), "media");
    assert.equal(severity(["Vertex 04", "Hack 04"], "Bullpadel Vertex 04 2025"), "alta");
  });
});

describe("posibles duplicados y el signo «+» (Q-03)", () => {
  const duplicates = (models: string[], brand = "Oxdog") =>
    buildQualityReport({ rackets: models.map((model, index) => racket(`pala-${index}`, { brand, model })), pending: [], stores: [healthy] }, NOW)
      .issues.filter((issue) => issue.type === "posible-duplicado")
      .map((issue) => issue.slug)
      .sort();

  it("«Pro» y «Pro+» son modelos distintos", () => {
    assert.deepEqual(duplicates(["Hyper Pro 2.0", "Hyper Pro+ 2.0"]), []);
    assert.deepEqual(duplicates(["Ultimate Pro", "Ultimate Pro+"]), []);
    assert.notEqual(duplicateKey("Ultimate Pro"), duplicateKey("Ultimate Pro+"));
  });

  it("las diferencias tipográficas inocuas siguen siendo un posible duplicado", () => {
    assert.deepEqual(duplicates(["Hyper Pro 2.0", "HYPER-PRO  2.0"]), ["pala-0", "pala-1"]);
    assert.deepEqual(duplicates(["Ultimate Pro+", "ultimate pro +"]), ["pala-0", "pala-1"]);
    // «+» y «Plus» nombran el mismo modelo, como al leer los títulos de las tiendas.
    assert.deepEqual(duplicates(["Ultimate Pro+", "Ultimate Pro Plus"]), ["pala-0", "pala-1"]);
    assert.deepEqual(duplicates(["Tritón", "Triton"], "StarVie"), ["pala-0", "pala-1"]);
  });

  it("otra variante, otra edición u otro año no son duplicados", () => {
    assert.deepEqual(duplicates(["Hyper Pro 2.0", "Hyper Pro 3.0"]), []);
    assert.deepEqual(duplicates(["Ultimate Pro", "Ultimate Pro Light"]), []);
    const years = buildQualityReport(
      { rackets: [racket("a", { model: "Ultimate Pro", year: 2025 }), racket("b", { model: "Ultimate Pro", year: 2026 })], pending: [], stores: [healthy] },
      NOW,
    ).issues.filter((issue) => issue.type === "posible-duplicado");
    assert.deepEqual(years, []);
  });
});

function racket(slug: string, changes: Partial<RacketQualityRow> = {}): RacketQualityRow {
  return {
    id: slug,
    slug,
    brand: "Bullpadel",
    model: slug,
    year: 2026,
    shape: "diamante",
    hasPhoto: true,
    bestPrice: 199.95,
    priceCheckedAt: ago(2),
    storeCount: 2,
    weightMin: 365,
    weightMax: 375,
    balance: "alto",
    playStyle: "potencia",
    levels: ["avanzado"],
    hasTouch: true,
    hasCore: true,
    hasFaces: true,
    hasRatings: true,
    gtins: [`0844540297${slug.length}${slug.charCodeAt(0)}`],
    hasManufacturerRef: false,
    msrp: 339,
    conflicts: 0,
    source: "padelzoom.es",
    ...changes,
  };
}

const healthy: StoreHealth = { store: "Tienda A", lastSuccessAt: ago(3), recentFailures: 0, lastError: null, matched: 300, pending: 0 };
const report = (input: Partial<QualityInput>) =>
  buildQualityReport({ rackets: [], pending: [], stores: [healthy], ...input }, NOW);
const typesOf = (input: Partial<QualityInput>) => report(input).issues.map((issue) => issue.type);

describe("incidencias", () => {
  it("una pala completa y con precio reciente no genera ninguna", () => {
    assert.deepEqual(report({ rackets: [racket("completa")] }).issues, []);
  });

  it("que falte un dato es un dato ausente, no un error", () => {
    const bare = racket("sin-datos", { hasPhoto: false, bestPrice: null, priceCheckedAt: null, storeCount: 0, balance: null, levels: [], gtins: [] });
    const issues = report({ rackets: [bare] }).issues;
    assert.deepEqual(issues.map((issue) => issue.type).sort(), ["datos-incompletos", "sin-foto", "sin-identificador", "sin-precio"]);
    assert.ok(issues.every((issue) => issue.nature === "dato-ausente"));
    assert.ok(issues.every((issue) => issue.severity === "baja"));
    assert.deepEqual(missingFields(bare), ["balance", "nivel"]);
  });

  it("una pala a la venta sin foto es prioridad alta", () => {
    const [issue] = report({ rackets: [racket("sin-foto", { hasPhoto: false })] }).issues;
    assert.equal(issue.type, "sin-foto");
    assert.equal(issue.severity, "alta");
  });

  it("un precio antiguo es un dato antiguo, con su antigüedad; sin confirmar es más grave", () => {
    const old = report({ rackets: [racket("antiguo", { priceCheckedAt: ago(30) })] }).issues[0];
    assert.deepEqual([old.type, old.nature, old.severity, old.ageDays], ["precio-antiguo", "dato-antiguo", "media", 1]);
    const stale = report({ rackets: [racket("caducado", { priceCheckedAt: ago(100) })] }).issues[0];
    assert.deepEqual([stale.nature, stale.severity, stale.ageDays], ["dato-antiguo", "alta", 4]);
  });

  it("el mismo EAN en dos palas es un error confirmado", () => {
    const issues = report({ rackets: [racket("pala-a", { gtins: [GTIN_A] }), racket("pala-b", { gtins: [GTIN_A] })] }).issues;
    assert.equal(issues.length, 2);
    assert.ok(issues.every((issue) => issue.type === "ean-compartido" && issue.nature === "error-confirmado" && issue.severity === "alta"));
    assert.ok(issues[0].detail.includes("pala-b") || issues[0].detail.includes("pala-a"));
  });

  it("mismo nombre y año es un posible duplicado, no un error: pueden ser dos colores", () => {
    const issues = report({
      rackets: [racket("vertex-negra", { model: "Vertex 04" }), racket("vertex-roja", { model: "VERTEX-04" }), racket("otra", { model: "Hack 04" })],
    }).issues;
    assert.deepEqual(issues.map((issue) => issue.slug).sort(), ["vertex-negra", "vertex-roja"]);
    assert.ok(issues.every((issue) => issue.type === "posible-duplicado" && issue.nature === "posible-error"));
    assert.ok(issues[0].detail.includes("dos colores"));
  });

  it("un peso imposible o un precio muy por encima del PVPR son posibles errores", () => {
    assert.deepEqual(typesOf({ rackets: [racket("ligera", { weightMin: 36, weightMax: 37 })] }), ["peso-fuera-de-rango"]);
    assert.deepEqual(typesOf({ rackets: [racket("cara", { bestPrice: 300, msrp: 200 })] }), ["precio-sobre-pvpr"]);
    assert.deepEqual(typesOf({ rackets: [racket("normal", { bestPrice: 210, msrp: 200 })] }), []);
  });

  it("las fuentes que no coinciden y los productos pendientes necesitan a una persona", () => {
    const result = report({
      rackets: [racket("conflicto", { conflicts: 3, model: "Vertex 04", year: 2025 })],
      pending: [{ store: "Tienda A", title: "Bullpadel Vertex 04 2025", brand: "Bullpadel", gtin: null, url: "https://tienda.example/p", note: "El título no indica el año.", price: 150, lastSeenAt: ago(72) }],
    });
    const pending = result.issues.find((issue) => issue.type === "emparejamiento-pendiente");
    assert.ok(pending?.match);
    assert.deepEqual([pending.nature, pending.review, pending.store, pending.ageDays], ["ambiguo", "en-cola", "Tienda A", 3]);
    assert.equal(pending.match.suggestions[0].candidate.slug, "conflicto");
    assert.equal(result.issues.find((issue) => issue.type === "conflicto-fuentes")?.nature, "ambiguo");
    assert.equal(result.metrics.pendingMatches, 1);
  });

  it("una tienda con fallos o sin actualizar aparece como incidencia de la fuente", () => {
    const failing: StoreHealth = { ...healthy, store: "Tienda B", recentFailures: 2, lastError: "fetch failed", lastSuccessAt: ago(30) };
    const never: StoreHealth = { ...healthy, store: "Tienda C", lastSuccessAt: null };
    const issues = report({ stores: [healthy, failing, never] }).issues;
    assert.deepEqual(
      issues.map((issue) => [issue.store, issue.type, issue.nature, issue.severity]),
      [
        ["Tienda B", "ingestion-atrasada", "dato-antiguo", "alta"],
        ["Tienda C", "ingestion-atrasada", "dato-antiguo", "alta"],
        ["Tienda B", "ingestion-fallida", "error-confirmado", "media"],
      ],
    );
    assert.equal(issues.find((issue) => issue.type === "ingestion-fallida")?.store, "Tienda B");
    assert.ok(issues.find((issue) => issue.type === "ingestion-fallida")?.detail.includes("fetch failed"));
  });

  it("van primero las más graves", () => {
    const issues = report({
      rackets: [racket("a", { gtins: [GTIN_A] }), racket("b", { gtins: [GTIN_A] }), racket("c", { balance: null })],
    }).issues;
    assert.equal(issues[0].severity, "alta");
    assert.equal(issues.at(-1)?.severity, "baja");
  });
});

describe("métricas", () => {
  it("se calculan con los datos, sin cifras fijas", () => {
    const { metrics } = report({
      rackets: [
        racket("completa"),
        racket("una-tienda", { storeCount: 1 }),
        racket("sin-precio", { bestPrice: null, priceCheckedAt: null, storeCount: 0, hasPhoto: false }),
        racket("caducada", { priceCheckedAt: ago(100), balance: null, playStyle: null, levels: [] }),
      ],
    });
    const value = (label: string) => metrics.indicators.find((item) => item.label === label);
    assert.equal(metrics.total, 4);
    assert.deepEqual(value("Con foto real"), { label: "Con foto real", count: 3, percent: 75 });
    assert.equal(value("Con precio reciente")?.count, 2);
    assert.equal(value("Con precio sin confirmar")?.count, 1);
    assert.equal(value("Sin precio")?.count, 1);
    assert.equal(value("Con precio en 2 tiendas o más")?.count, 1);

    const ready = (key: string) => metrics.readiness.find((item) => item.key === key)?.count;
    // Un precio sin confirmar no sirve para recomendar: solo cuentan las dos con precio reciente.
    assert.equal(ready("alternativas"), 2);
    assert.equal(ready("recomendador"), 2);
    assert.equal(ready("comparar-tiendas"), 1);
    assert.equal(ready("comparar-rendimiento"), 4);
    assert.deepEqual(metrics.priceAgeHours, { newest: 2, oldest: 100, median: 2 });
  });

  it("la antigüedad mediana con un número par de precios es la media de los dos centrales (R-01)", () => {
    const { metrics } = report({
      rackets: [racket("a", { priceCheckedAt: ago(1) }), racket("b", { priceCheckedAt: ago(3) }), racket("c", { priceCheckedAt: ago(30) }), racket("d", { priceCheckedAt: ago(100) })],
    });
    assert.deepEqual(metrics.priceAgeHours, { newest: 1, oldest: 100, median: 16.5 });
  });

  it("sin palas no divide entre cero", () => {
    const { metrics } = report({});
    assert.equal(metrics.total, 0);
    assert.ok(metrics.indicators.every((item) => item.percent === 0));
    assert.deepEqual(metrics.priceAgeHours, { newest: null, oldest: null, median: null });
  });
});
