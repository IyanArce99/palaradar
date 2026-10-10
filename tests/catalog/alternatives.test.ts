// Alternativas a una pala: la puntuación es determinista, descarta lo que no
// cumple el requisito del modo, no da por igual un dato que falta y explica cada
// propuesta con lo que coincide, lo que cambia y lo que no se sabe.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRepository } from "@/data/memory-repository";
import {
  ALTERNATIVE_MODES,
  alternativeReasons,
  buildAlternativeGroups,
  canonicalTouch,
  findAlternatives,
  findUpgrades,
  priceReason,
  rawTouch,
  similarity,
  TRAIT_WEIGHTS,
  UNKNOWN_PENALTY,
  type AlternativeCandidate,
  type AlternativeTarget,
} from "@/lib/alternatives";
import type { PalaSummary } from "@/types/catalog";

/** El espacio duro que pone lib/format.ts entre la cifra y su unidad */
const NBSP = " ";

function summary(slug: string, price: number | null, changes: Partial<PalaSummary> = {}): PalaSummary {
  return {
    id: slug,
    slug,
    brand: { slug: "marca-a", name: "Marca A" },
    model: slug,
    year: 2026,
    image: "https://example.com/foto.webp",
    shape: "diamante",
    description: "",
    rating: 0,
    reviewCount: 0,
    price,
    previousPrice: null,
    dropPercent: null,
    storeCount: price === null ? 0 : 1,
    priceNote: null,
    priceRecent: true,
    ...changes,
  };
}

const target: AlternativeTarget = {
  id: "objetivo",
  brandSlug: "marca-a",
  year: 2026,
  shape: "diamante",
  balance: "alto",
  playStyle: "potencia",
  levels: ["avanzado", "competicion"],
  weight: { min: 365, max: 375 },
  touch: "Medio",
  price: 200,
};

function candidate(slug: string, price: number | null, changes: Partial<AlternativeCandidate> = {}): AlternativeCandidate {
  const { pala, ...traits } = changes;
  return {
    pala: pala ?? summary(slug, price),
    shape: "diamante",
    balance: "alto",
    playStyle: "potencia",
    levels: ["avanzado"],
    weight: { min: 360, max: 375 },
    touch: "medio",
    ...traits,
  };
}

const mode = (id: string) => {
  const found = ALTERNATIVE_MODES.find((item) => item.id === id);
  assert.ok(found, `no existe el modo ${id}`);
  return found;
};

describe("parecido entre dos palas", () => {
  it("suma el peso de cada atributo declarado que coincide", () => {
    const found = similarity(target, candidate("igual", 180));
    assert.deepEqual(found.shared, ["shape", "balance", "style", "level", "touch", "weight"]);
    assert.equal(found.score, Object.values(TRAIT_WEIGHTS).reduce((sum, weight) => sum + weight, 0));
    assert.deepEqual(found.different, []);
    assert.deepEqual(found.unknown, []);
  });

  it("un dato que la candidata no declara resta y no se da por igual", () => {
    const found = similarity(target, candidate("sin-datos", 180, { balance: null, weight: null, levels: [] }));
    assert.deepEqual(found.unknown, ["balance", "level", "weight"]);
    assert.ok(!found.shared.includes("balance"));
    assert.equal(found.score, TRAIT_WEIGHTS.shape + TRAIT_WEIGHTS.style + TRAIT_WEIGHTS.touch - 3 * UNKNOWN_PENALTY);
  });

  it("lo que la pala de la ficha no declara no se compara", () => {
    const bare = { ...target, balance: null, playStyle: null, levels: [], weight: null, touch: null };
    const found = similarity(bare, candidate("otra", 180));
    assert.deepEqual(found.shared, ["shape"]);
    assert.deepEqual(found.unknown, []);
  });

  it("el peso coincide solo si los puntos medios están cerca", () => {
    assert.ok(similarity(target, candidate("ligera", 180, { weight: { min: 340, max: 350 } })).different.includes("weight"));
    assert.ok(similarity(target, candidate("cerca", 180, { weight: { min: 370, max: 375 } })).shared.includes("weight"));
  });

  it("el tacto se compara con el dato en bruto: la misma dureza múltiple no es una diferencia", () => {
    const hardness = "Dura, Media";
    const touch = rawTouch({ specs: [], hardness });
    assert.equal(touch, hardness);
    assert.ok(similarity({ ...target, touch }, candidate("igual", 180, { touch: " dura, media " })).shared.includes("touch"));
    // El tacto declarado manda sobre la dureza; sin ninguno de los dos no hay dato.
    assert.equal(rawTouch({ specs: [{ label: "Tacto", value: " Medio " }], hardness }), "Medio");
    assert.equal(rawTouch({ specs: [], hardness: null }), null);
  });

  it("tacto y dureza son el mismo dato con dos vocabularios", () => {
    // La ficha declara tacto «Medio»; la candidata no declara tacto, pero sí dureza «Media».
    const found = similarity({ ...target, touch: "Medio" }, candidate("por-dureza", 180, { touch: "Media" }));
    assert.ok(found.shared.includes("touch"));
    assert.equal(canonicalTouch("Dura, Media"), canonicalTouch("media / dura"));
    assert.equal(canonicalTouch("Blanda"), "blando");
    assert.equal(canonicalTouch("Medio-Blando"), "medio-blando");
    assert.equal(canonicalTouch(null), "");
    // Un tacto de verdad distinto sigue siendo una diferencia, y se nombra en el mismo vocabulario.
    const other = candidate("dura", 180, { touch: "Dura" });
    assert.ok(similarity({ ...target, touch: "Medio" }, other).different.includes("touch"));
    assert.ok(alternativeReasons({ ...target, touch: "Medio" }, other).includes("Tacto distinto: duro"));
  });

  it("los atributos que el modo ya fija no puntúan", () => {
    const full = similarity(target, candidate("igual", 180));
    const ignoring = similarity(target, candidate("igual", 180), ["style"]);
    assert.equal(full.score - ignoring.score, TRAIT_WEIGHTS.style);
  });
});

describe("modos de búsqueda", () => {
  it("«más barata» exige un ahorro real y descarta las que no lo dan", () => {
    const items = findAlternatives(
      target,
      [candidate("barata", 150), candidate("casi-igual", 195), candidate("cara", 260), candidate("sin-precio", null)],
      mode("mas-barata"),
      5,
    );
    assert.deepEqual(items.map((item) => item.pala.slug), ["barata"]);
  });

  it("«más barata» no existe si la pala de la ficha no tiene precio", () => {
    assert.deepEqual(findAlternatives({ ...target, price: null }, [candidate("barata", 90)], mode("mas-barata"), 5), []);
  });

  it("un modo de estilo solo admite palas que declaran ese estilo", () => {
    const items = findAlternatives(
      target,
      [
        candidate("control", 180, { playStyle: "control" }),
        candidate("potencia", 180),
        candidate("sin-estilo", 180, { playStyle: null }),
      ],
      mode("control"),
      5,
    );
    assert.deepEqual(items.map((item) => item.pala.slug), ["control"]);
  });

  it("«más manejable» exige balance bajo declarado", () => {
    const items = findAlternatives(
      target,
      [candidate("baja", 180, { balance: "bajo" }), candidate("alta", 180), candidate("desconocido", 180, { balance: null })],
      mode("manejable"),
      5,
    );
    assert.deepEqual(items.map((item) => item.pala.slug), ["baja"]);
  });

  it("«otra marca» y «temporada anterior» mantienen la forma", () => {
    const otherBrand = summary("otra-marca", 180, { brand: { slug: "marca-b", name: "Marca B" } });
    const older = summary("del-2025", 150, { year: 2025 });
    const candidates = [
      candidate("otra-marca", 180, { pala: otherBrand }),
      candidate("otra-marca-redonda", 180, { pala: { ...otherBrand, id: "r", slug: "otra-marca-redonda" }, shape: "redonda" }),
      candidate("del-2025", 150, { pala: older }),
      candidate("misma-marca", 180),
    ];
    assert.deepEqual(findAlternatives(target, candidates, mode("otra-marca"), 5).map((item) => item.pala.slug), ["otra-marca"]);
    assert.deepEqual(findAlternatives(target, candidates, mode("temporada-anterior"), 5).map((item) => item.pala.slug), ["del-2025"]);
  });

  it("un presupuesto por encima del precio de la pala no es una alternativa", () => {
    const candidates = [candidate("de-90", 90), candidate("de-140", 140)];
    assert.deepEqual(findAlternatives(target, candidates, mode("hasta-100"), 5).map((item) => item.pala.slug), ["de-90"]);
    assert.deepEqual(findAlternatives({ ...target, price: 95 }, candidates, mode("hasta-100"), 5), []);
  });

  it("nunca se propone la propia pala ni una sin nada en común", () => {
    const self = candidate("objetivo", 150, { pala: summary("objetivo", 150) });
    const unrelated = candidate("nada-que-ver", 150, {
      shape: "redonda",
      balance: "bajo",
      playStyle: "control",
      levels: ["iniciacion"],
      weight: { min: 330, max: 340 },
      touch: "blando",
    });
    assert.deepEqual(findAlternatives(target, [self, unrelated], mode("control"), 5), []);
  });

  it("ordena por parecido y, a igualdad, por precio más cercano; siempre igual", () => {
    const candidates = [
      candidate("lejos", 120),
      candidate("cerca", 185),
      candidate("menos-parecida", 190, { balance: "medio" }),
    ];
    const order = () => findAlternatives(target, candidates, mode("potencia"), 5).map((item) => item.pala.slug);
    assert.deepEqual(order(), ["cerca", "lejos", "menos-parecida"]);
    assert.deepEqual(order(), order());
  });

  it("ningún rótulo promete «más» de algo que el modo no mide", () => {
    // El modo exige un estilo o un balance declarado; no compara cuánto control o potencia tiene cada pala.
    for (const item of ALTERNATIVE_MODES) {
      if (item.id !== "mas-barata") assert.doesNotMatch(item.label, /^Más /, item.id);
    }
    // Sobre una pala de potencia, el modo de potencia enseña otras de potencia: el rótulo debe seguir siendo cierto.
    assert.equal(mode("potencia").label, "Priorizar potencia");
    assert.equal(mode("temporada-anterior").label, "De temporadas anteriores");
  });

  it("solo devuelve los modos con alguna alternativa y respeta el límite", () => {
    const candidates = [candidate("a", 150), candidate("b", 160), candidate("c", 170)];
    const groups = buildAlternativeGroups(target, candidates, 2);
    assert.deepEqual(groups.map((group) => group.id), ["mas-barata", "potencia", "hasta-150"]);
    assert.ok(groups.every((group) => group.items.length <= 2 && group.criterion.length > 0));
  });
});

describe("explicación de cada alternativa", () => {
  it("dice la diferencia de precio en euros enteros", () => {
    assert.equal(priceReason(200, 165.05), `Cuesta 35${NBSP}€ menos`);
    assert.equal(priceReason(200, 230), `Cuesta 30${NBSP}€ más`);
    assert.equal(priceReason(200, 200.3), "Cuesta prácticamente lo mismo");
    assert.equal(priceReason(null, 150), null);
    assert.equal(priceReason(200, null), null);
  });

  it("nombra lo que comparte, lo que cambia y lo que no se ha podido verificar", () => {
    const reasons = alternativeReasons(target, candidate("otra", 165, { balance: "medio", weight: null }));
    assert.deepEqual(reasons, [
      `Cuesta 35${NBSP}€ menos`,
      "Comparte forma, estilo de juego, nivel y tacto declarados",
      "Balance distinto: medio",
      "No se ha podido verificar su peso",
    ]);
  });

  it("concuerda el adjetivo con el atributo: «forma distinta», «balance distinto»", () => {
    const reasons = alternativeReasons(target, candidate("otra", 165, { shape: "lagrima", balance: "medio" }));
    assert.ok(reasons.includes("Forma distinta: lágrima"), reasons.join(" | "));
    assert.ok(reasons.includes("Balance distinto: medio"));
    assert.ok(!reasons.some((reason) => reason.includes("Forma distinto")));
  });

  it("no usa adjetivos de valoración", () => {
    const reasons = alternativeReasons(target, candidate("otra", 165, { shape: "lagrima", playStyle: "polivalente" }));
    assert.doesNotMatch(reasons.join(" "), /mejor|peor|ideal|perfect|recomend/i);
  });
});

describe("«tengo esta pala y quiero cambiar»", () => {
  const cheapControl = candidate("barata-control", 120, { playStyle: "control" });
  const cheapPower = candidate("barata-potencia", 130);
  const priceyControl = candidate("cara-control", 240, { playStyle: "control" });
  const otherShape = candidate("lagrima-control", 110, { shape: "lagrima", playStyle: "control" });
  const pool = [cheapControl, cheapPower, priceyControl, otherShape];
  const upgrades = (request: Parameters<typeof findUpgrades>[2], from: AlternativeTarget = target) =>
    findUpgrades(from, pool, request);

  it("lo que se conserva y el presupuesto son requisitos", () => {
    const result = upgrades({ wants: ["control"], keeps: ["shape"], maxPrice: 150 });
    assert.deepEqual(result.items.map((item) => item.pala.slug), ["barata-control"]);
    // Sin conservar la forma entra también la de lágrima; el presupuesto sigue mandando.
    assert.deepEqual(
      upgrades({ wants: ["control"], keeps: [], maxPrice: 150 }).items.map((item) => item.pala.slug),
      ["barata-control", "lagrima-control"],
    );
  });

  it("de los cambios pedidos basta con cumplir alguno, y dice cuáles cumple y cuáles no", () => {
    const result = upgrades({ wants: ["mas-barata", "control"], keeps: ["shape"], maxPrice: null });
    assert.deepEqual(
      result.items.map((item) => [item.pala.slug, item.satisfied, item.unmet]),
      [
        ["barata-control", ["Más barata", "Priorizar control"], []],
        ["barata-potencia", ["Más barata"], ["Priorizar control"]],
        ["cara-control", ["Priorizar control"], ["Más barata"]],
      ],
    );
  });

  it("no se puede exigir conservar lo que la pala actual no declara, y se avisa", () => {
    const result = upgrades({ wants: ["control"], keeps: ["balance", "shape"], maxPrice: null }, { ...target, balance: null });
    assert.deepEqual(result.unknownKeeps, ["balance"]);
    assert.ok(result.items.length > 0);
  });

  it("«más barata» no cuenta si la pala actual no tiene precio", () => {
    const result = upgrades({ wants: ["mas-barata"], keeps: ["shape"], maxPrice: null }, { ...target, price: null });
    // Sin cambios aplicables se comporta como «parecidas que conservan la forma».
    assert.ok(result.items.every((item) => item.satisfied.length === 0 && item.unmet.length === 0));
    assert.ok(!result.items.some((item) => item.pala.slug === "lagrima-control"));
  });

  it("nunca propone la propia pala ni una sin precio, y no pasa del límite", () => {
    const self = candidate("objetivo", 100, { pala: summary("objetivo", 100) });
    const unpriced = candidate("sin-precio", null);
    const result = findUpgrades(target, [...pool, self, unpriced], { wants: [], keeps: [], maxPrice: null }, 2);
    assert.equal(result.items.length, 2);
    assert.ok(!result.items.some((item) => ["objetivo", "sin-precio"].includes(item.pala.slug)));
  });

  it("un cambio o un atributo repetido en la petición cuenta una sola vez (U-02)", () => {
    const once = upgrades({ wants: ["control"], keeps: ["shape"], maxPrice: null });
    const twice = upgrades({ wants: ["control", "control"], keeps: ["shape", "shape"], maxPrice: null });
    assert.deepEqual(twice, once);
    assert.deepEqual(twice.items[0].satisfied, ["Priorizar control"]);
    const unknown = upgrades({ wants: [], keeps: ["balance", "balance"], maxPrice: null }, { ...target, balance: null });
    assert.deepEqual(unknown.unknownKeeps, ["balance"]);
  });

  it("es reproducible", () => {
    const request = { wants: ["control" as const], keeps: ["shape" as const], maxPrice: 300 };
    assert.deepEqual(findUpgrades(target, pool, request), findUpgrades(target, [...pool].reverse(), request));
  });
});

describe("otras temporadas del mismo modelo, desde el repositorio", () => {
  it("solo devuelve la misma marca y el mismo nombre de modelo en otro año", async () => {
    const repository = createMemoryRepository();
    const slugs = await repository.getAllPalaSlugs();
    const palas = await repository.getPalaSummaries(slugs);
    for (const pala of palas) {
      const seasons = await repository.getModelSeasons(
        { slug: pala.slug, brandSlug: pala.brand.slug, model: pala.model, year: pala.year },
        4,
      );
      for (const season of seasons) {
        assert.equal(season.brand.slug, pala.brand.slug);
        assert.equal(season.model.trim().toLowerCase(), pala.model.trim().toLowerCase());
        assert.notEqual(season.year, pala.year);
        assert.notEqual(season.slug, pala.slug);
      }
    }
  });

  it("un nombre parecido no es el mismo modelo", async () => {
    const repository = createMemoryRepository();
    const [first] = await repository.getPalaSummaries(await repository.getAllPalaSlugs());
    const seasons = await repository.getModelSeasons(
      { slug: "otra", brandSlug: first.brand.slug, model: `${first.model} Pro`, year: first.year + 1 },
      4,
    );
    assert.deepEqual(seasons, []);
  });
});

describe("candidatas del repositorio", () => {
  it("todas tienen precio vigente y sus atributos declarados", async () => {
    const candidates = await createMemoryRepository().getAlternativeCandidates();
    assert.ok(candidates.length > 0);
    assert.ok(candidates.every((item) => item.pala.price !== null));
    assert.ok(candidates.every((item) => item.shape === item.pala.shape));
    assert.deepEqual(
      candidates.map((item) => item.pala.slug),
      [...candidates.map((item) => item.pala.slug)].sort((a, b) => a.localeCompare(b)),
    );
  });
});
