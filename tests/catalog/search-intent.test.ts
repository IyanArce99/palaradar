// Buscador en lenguaje natural: solo se convierte en filtro lo que se reconoce
// sin duda, cada criterio se enseña, y lo ambiguo se busca como texto.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRepository } from "@/data/memory-repository";
import { catalogHref, DEFAULT_QUERY, getActiveFilters, parseCatalogQuery, type CatalogQuery } from "@/lib/catalog/query";
import {
  appliedCriteria,
  applyIntent,
  interpretSearch,
  relaxations,
  unappliedCriteria,
  type SearchContext,
} from "@/lib/catalog/search-intent";
import { catalogSeo } from "@/lib/catalog/seo";

const context: SearchContext = {
  brands: [
    { slug: "bullpadel", name: "Bullpadel" },
    { slug: "nox", name: "Nox" },
    { slug: "black-crown", name: "Black Crown" },
    { slug: "drop-shot", name: "Drop Shot" },
  ],
  years: [2026, 2025, 2024, 2023],
  currentYear: 2026,
};

const interpret = (text: string) => interpretSearch(text, context);
const labels = (text: string) => interpret(text).detected.map((item) => item.label);
const NBSP = " ";

describe("consultas admitidas", () => {
  it("«pala redonda por menos de 120 euros»", () => {
    const intent = interpret("Pala redonda por menos de 120 euros");
    assert.deepEqual(intent.filters, { maxPrice: 120, shapes: ["redonda"] });
    assert.deepEqual(labels("Pala redonda por menos de 120 euros"), [`Hasta 120${NBSP}€`, "Forma redonda"]);
    assert.equal(intent.text, "");
  });

  it("«pala manejable» es lo que define la colección: redonda y balance bajo", () => {
    const intent = interpret("pala manejable");
    assert.deepEqual(intent.filters, { shapes: ["redonda"], balances: ["bajo"] });
    assert.equal(intent.text, "");
  });

  it("«pala de control hasta 150 euros»", () => {
    assert.deepEqual(interpret("Pala de control hasta 150 euros").filters, { maxPrice: 150, styles: ["control"] });
  });

  it("«palas con precio confirmado» y «disponibles en dos tiendas»", () => {
    assert.deepEqual(interpret("palas con precio confirmado").filters, { coverage: ["con-precio"] });
    assert.deepEqual(interpret("Palas disponibles en dos tiendas").filters, { coverage: ["varias-tiendas", "con-precio"] });
  });

  it("«modelos de temporadas anteriores» son los años anteriores al actual", () => {
    assert.deepEqual(interpret("Modelos de temporadas anteriores").filters, { years: [2025, 2024, 2023] });
  });

  it("reconoce la marca, aunque tenga dos palabras, y deja el modelo como texto", () => {
    const intent = interpret("black crown piton 2025");
    assert.deepEqual(intent.filters, { brands: ["black-crown"], years: [2025] });
    assert.equal(intent.text, "piton");
    assert.deepEqual(interpret("bullpadel vertex").filters, { brands: ["bullpadel"] });
    assert.equal(interpret("bullpadel vertex").text, "vertex");
  });

  it("«pala híbrida de otra marca»: la forma sí, «otra marca» no se inventa como filtro", () => {
    const intent = interpret("Pala híbrida de otra marca");
    assert.deepEqual(intent.filters, { shapes: ["hibrida"] });
    assert.ok(intent.notes.some((note) => note.includes("«Otra marca» depende de una pala concreta")));
  });

  it("«una alternativa más barata a la vertex 04» apunta a un modelo de referencia", () => {
    const intent = interpret("Una alternativa más barata a la vertex 04");
    assert.equal(intent.reference, "vertex 04");
    assert.equal(intent.text, "vertex 04");
    assert.deepEqual(intent.filters, {});
    assert.ok(intent.notes.some((note) => note.includes("«Más barata»")));
  });

  it("nivel, ofertas y orden por precio", () => {
    assert.deepEqual(interpret("palas para principiantes en oferta").filters, { collection: "en-oferta", levels: ["iniciacion"] });
    assert.deepEqual(interpret("palas baratas de diamante").filters, { sort: "precio", shapes: ["diamante"] });
  });
});

describe("lo que no se interpreta", () => {
  it("un texto sin criterios se busca tal cual, como antes", () => {
    for (const text of ["vertex 04", "metalbone", "at10 genius 18k"]) {
      const intent = interpret(text);
      assert.deepEqual(intent.detected, [], text);
      assert.equal(intent.text, text);
    }
    // Con un año, el año es el único criterio y el resto del modelo sigue siendo texto.
    const withYear = interpret("hack 04 2026 comfort");
    assert.deepEqual(withYear.filters, { years: [2026] });
    assert.equal(withYear.text, "hack 04 comfort");
  });

  it("un número solo es un presupuesto si el contexto lo dice", () => {
    assert.equal(interpret("vertex 04").filters.maxPrice, undefined);
    assert.equal(interpret("genius 18k 12k").filters.maxPrice, undefined);
    assert.equal(interpret("pala 150").filters.maxPrice, undefined);
    assert.equal(interpret("pala 150 €").filters.maxPrice, 150);
    assert.equal(interpret("hasta 5 euros").filters.maxPrice, undefined);
  });

  it("un año que no está en el catálogo no se convierte en filtro", () => {
    assert.deepEqual(interpret("palas 2019").filters, {});
    assert.deepEqual(interpret("palas redondas 2019").filters, { shapes: ["redonda"] });
    assert.equal(interpret("palas redondas 2019").text, "2019");
  });

  it("«control» dentro del nombre de un modelo se busca como texto, y se avisa", () => {
    const intent = interpret("hack control 2026");
    assert.equal(intent.filters.styles, undefined);
    assert.deepEqual(intent.filters, { years: [2026] });
    assert.equal(intent.text, "hack control");
    assert.ok(intent.notes.some((note) => note.includes("«control» puede ser parte del nombre de un modelo")));
  });

  it("«control» es un criterio cuando la frase lo pide o no queda nada más", () => {
    assert.deepEqual(interpret("palas de control").filters, { styles: ["control"] });
    assert.deepEqual(interpret("nox control").filters, { brands: ["nox"], styles: ["control"] });
    assert.deepEqual(interpret("priorizar potencia").filters, { styles: ["potencia"] });
  });

  it("no hay criterio sin su explicación", () => {
    for (const text of ["pala redonda por menos de 120 euros", "pala manejable de nox", "diamante 2025 en oferta con precio"]) {
      const intent = interpret(text);
      const keys = new Set(intent.detected.map((item) => item.key));
      assert.deepEqual([...keys].sort(), Object.keys(intent.filters).sort(), text);
      assert.ok(intent.detected.every((item) => item.label.length > 0 && item.from.length > 0));
    }
  });

  it("vacío o solo espacios no es nada", () => {
    assert.deepEqual(interpret("   ").detected, []);
    assert.equal(interpret("").text, "");
  });
});

// Regresiones de la auditoría V5: lo que el catálogo no sabe filtrar no se convierte en
// el filtro que sí existe, y nunca desaparece sin una nota que lo diga.
describe("precios que no son un máximo", () => {
  const untouched = (text: string) => {
    const intent = interpret(text);
    assert.equal(intent.filters.maxPrice, undefined, text);
    assert.ok(!intent.detected.some((item) => item.key === "maxPrice"), text);
    return intent;
  };

  it("un límite inferior no se convierte en «Hasta…» (B-01)", () => {
    const cases: [string, string][] = [
      ["pala de más de 200 euros", "más de 200 euros"],
      ["pala desde 150", "desde 150"],
      ["pala a partir de 200 €", "a partir de 200 €"],
      ["pala por encima de 180 euros", "por encima de 180 euros"],
      ["pala > 150 €", "> 150 €"],
      ["mínimo 100 euros", "mínimo 100 euros"],
      ["no menos de 150 euros", "no menos de 150 euros"],
    ];
    for (const [text, phrase] of cases) {
      const intent = untouched(text);
      assert.deepEqual(intent.notes, [`No filtramos por precio mínimo: «${phrase}» no se ha aplicado.`], text);
      // El importe no se busca como si fuera el nombre de una pala.
      assert.equal(intent.text, "", text);
    }
  });

  it("el resto de la consulta se sigue interpretando, y la nota cita lo escrito", () => {
    const intent = untouched("Pala redonda de MÁS de 200 euros");
    assert.deepEqual(intent.filters, { shapes: ["redonda"] });
    assert.deepEqual(intent.notes, ["No filtramos por precio mínimo: «MÁS de 200 euros» no se ha aplicado."]);
  });

  it("«no más de» sí es un máximo", () => {
    assert.deepEqual(interpret("no más de 150 euros").filters, { maxPrice: 150 });
    assert.deepEqual(interpret("no más de 150 euros").notes, []);
  });

  it("un rango no se queda en su extremo superior ni deja restos en el texto (B-02)", () => {
    for (const [text, phrase] of [
      ["pala entre 100 y 150 euros", "entre 100 y 150 euros"],
      ["pala de 100 a 150 €", "de 100 a 150 €"],
      ["pala 200€ - 300€", "200€ - 300€"],
    ]) {
      const intent = untouched(text);
      assert.equal(intent.text, "", text);
      assert.deepEqual(intent.notes, [
        `No filtramos por rango de precios: «${phrase}» no se ha aplicado. Puedes fijar un precio máximo en los filtros.`,
      ]);
    }
  });

  it("con varios importes no se elige uno ni se enseñan como aplicados (B-02)", () => {
    for (const text of [
      "pala de menos de 100 y más de 200 euros",
      "más de 100 y menos de 200 euros",
      "menos de 100€ o de hasta 150€",
      "pala redonda hasta 100 euros o 150 euros",
    ]) {
      const intent = untouched(text);
      assert.equal(intent.notes.length, 1, text);
      assert.match(intent.notes[0], /^Hay varios importes \(«.+», «.+»\) y no sabemos combinarlos: no hemos aplicado ningún filtro de precio\.$/);
      assert.doesNotMatch(intent.text, /\d/, text);
    }
    assert.deepEqual(interpret("pala redonda hasta 100 euros o 150 euros").filters, { shapes: ["redonda"] });
  });

  it("el mismo máximo escrito dos veces es un solo máximo", () => {
    const intent = interpret("hasta 150 euros, 150 €");
    assert.deepEqual(intent.filters, { maxPrice: 150 });
    assert.deepEqual(labels("hasta 150 euros, 150 €"), [`Hasta 150${NBSP}€`]);
  });

  it("al aplicarlo, la consulta no lleva ni el precio ni el texto del importe", () => {
    const typed: CatalogQuery = { ...DEFAULT_QUERY, q: "nox entre 100 y 150 euros" };
    const query = applyIntent(typed, interpret(typed.q));
    assert.deepEqual({ q: query.q, brands: query.brands, maxPrice: query.maxPrice }, { q: "", brands: ["nox"], maxPrice: null });
  });
});

describe("negaciones", () => {
  it("un criterio negado no se aplica en positivo, y se dice (B-03)", () => {
    const cases: [string, Partial<CatalogQuery>, string][] = [
      ["pala redonda no diamante", { shapes: ["redonda"] }, "no diamante"],
      ["pala no redonda", {}, "no redonda"],
      ["pala sin oferta", {}, "sin oferta"],
      ["pala no disponible", {}, "no disponible"],
      ["palas que no estén en oferta", {}, "no estén en oferta"],
      ["nox sin potencia", { brands: ["nox"] }, "sin potencia"],
      ["bullpadel excepto 2025", { brands: ["bullpadel"] }, "excepto 2025"],
      ["pala no muy potente para principiantes", { levels: ["iniciacion"] }, "no muy potente"],
    ];
    for (const [text, filters, phrase] of cases) {
      const intent = interpret(text);
      assert.deepEqual(intent.filters, filters, text);
      assert.deepEqual(intent.notes, [`No sabemos excluir un criterio: «${phrase}» no se ha aplicado.`], text);
      // La negación tampoco se busca como texto: «no» coincidiría con «Nox».
      assert.equal(intent.text, "", text);
    }
  });

  it("una marca negada tampoco se aplica, ni se busca «no» como texto", () => {
    for (const [text, phrase] of [
      ["pala no bullpadel", "no bullpadel"],
      ["quiero una pala que no sea de nox", "no sea de nox"],
      ["sin black crown", "sin black crown"],
      ["todas menos nox redondas", "menos nox"],
    ]) {
      const intent = interpret(text);
      assert.equal(intent.filters.brands, undefined, text);
      assert.deepEqual(intent.notes, [`No sabemos excluir un criterio: «${phrase}» no se ha aplicado.`], text);
      assert.doesNotMatch(intent.text, /\b(no|sin|menos)\b/, text);
    }
    assert.deepEqual(interpret("todas menos nox redondas").filters, { shapes: ["redonda"] });
    // Sin negación, la marca se sigue reconociendo.
    assert.deepEqual(interpret("pala de nox").filters, { brands: ["nox"] });
  });

  it("los restos de una frase interpretada a medias no se buscan como texto", () => {
    assert.equal(interpret("entre 2024 y 2025").text, "");
    assert.deepEqual(interpret("entre 2024 y 2025").filters, { years: [2024, 2025] });
    assert.equal(interpret("pala de 150 euros o menos").text, "");
    assert.equal(interpret("palas de la temporada 2025").text, "");
    const offers = interpret("no hay oferta");
    assert.deepEqual(offers.filters, {});
    assert.deepEqual(offers.notes, ["No sabemos excluir un criterio: «no hay oferta» no se ha aplicado."]);
  });

  it("cada criterio negado tiene su nota", () => {
    const intent = interpret("ni redonda ni diamante");
    assert.deepEqual(intent.filters, {});
    assert.equal(intent.notes.length, 2);
  });

  it("sin negación, los mismos criterios se siguen aplicando", () => {
    assert.deepEqual(interpret("pala redonda o diamante").filters, { shapes: ["redonda", "diamante"] });
    assert.deepEqual(interpret("palas en oferta").filters, { collection: "en-oferta" });
    assert.deepEqual(interpret("palas disponibles").filters, { coverage: ["con-precio"] });
  });

  it("una frase solo se reconoce como palabra entera", () => {
    assert.deepEqual(interpret("indisponible").detected, []);
    assert.equal(interpret("indisponible").text, "indisponible");
  });

  it("al aplicarlo, la consulta no gana filtros ni busca «no»", () => {
    const typed: CatalogQuery = { ...DEFAULT_QUERY, q: "pala sin oferta" };
    const query = applyIntent(typed, interpret(typed.q));
    assert.deepEqual({ q: query.q, collection: query.collection }, { q: "", collection: "todas" });
  });
});

describe("modelo de referencia", () => {
  it("no se come letras de la palabra siguiente (B-04)", () => {
    assert.equal(interpret("alternativa adidas metalbone").reference, "adidas metalbone");
    assert.equal(interpret("alternativa a elite w").reference, "elite w");
    assert.equal(interpret("similar a elite pro").reference, "elite pro");
    assert.equal(interpret("parecida a la alpha").reference, "alpha");
  });

  it("«como elegir pala» no apunta a ningún modelo: se busca tal cual", () => {
    const intent = interpret("como elegir pala");
    assert.equal(intent.reference, null);
    assert.equal(intent.text, "como elegir pala");
    assert.deepEqual(intent.notes, []);
  });

  it("mayúsculas, acentos y espacios de más no cambian el resultado", () => {
    assert.equal(interpret("COMO  LA Vertex 04").reference, "vertex 04");
    assert.equal(interpret("  Alternativa   más barata a la Vértex 04 ").reference, "vertex 04");
    assert.equal(interpret("Similares a la Élite Pro").reference, "elite pro");
  });
});

describe("«max» en el nombre de un modelo", () => {
  it("no es un presupuesto, y el año y la variante se conservan (B-05)", () => {
    const head = interpretSearch("head extreme max 2025", { ...context, brands: [...context.brands, { slug: "head", name: "Head" }] });
    assert.deepEqual(head.filters, { brands: ["head"], years: [2025] });
    assert.equal(head.text, "extreme max");

    const vertex = interpret("vertex 04 max 26");
    assert.deepEqual(vertex.detected, []);
    assert.equal(vertex.text, "vertex 04 max 26");

    const nox = interpret("nox at10 pro max 12k");
    assert.deepEqual(nox.filters, { brands: ["nox"] });
    assert.equal(nox.text, "at10 pro max 12k");
  });

  it("con la moneda sí es un máximo", () => {
    assert.deepEqual(interpret("pala max 100 €").filters, { maxPrice: 100 });
    assert.deepEqual(interpret("máximo 120").filters, { maxPrice: 120 });
  });

  it("un importe que no se aplica no se borra del texto", () => {
    const intent = interpret("bullpadel vertex 04 2025 hasta 2500");
    assert.deepEqual(intent.filters, { brands: ["bullpadel"], years: [2025] });
    assert.equal(intent.text, "vertex 04 hasta 2500");
  });

  it("lo que se enseña como interpretado coincide con los filtros reales", () => {
    for (const text of [
      "pala de más de 200 euros", "pala entre 100 y 150 euros", "pala redonda no diamante", "pala sin oferta",
      "head extreme max 2025", "vertex 04 max 26", "pala de menos de 100 y más de 200 euros",
    ]) {
      const intent = interpret(text);
      const keys = new Set(intent.detected.map((item) => item.key));
      assert.deepEqual([...keys].sort(), Object.keys(intent.filters).sort(), text);
    }
  });
});

describe("importes que no son un precio (B-06)", () => {
  it("un número seguido de una unidad de peso o medida no es un presupuesto", () => {
    for (const text of ["pala menos de 365 gramos", "pala hasta 370 g", "pala de hasta 360 gr", "nox hasta 12k"]) {
      const intent = interpret(text);
      assert.equal(intent.filters.maxPrice, undefined, text);
      assert.ok(!intent.detected.some((item) => item.key === "maxPrice"), text);
    }
    // Y el texto no pierde nada por el camino.
    assert.equal(interpret("pala menos de 365 gramos").text, "pala menos de 365 gramos");
  });

  it("un número no se parte: «1.200 euros» son 1.200 € y «12000» no es un precio", () => {
    assert.deepEqual(interpret("pala de 1.200 euros").filters, { maxPrice: 1200 });
    assert.deepEqual(labels("pala de 1.200 euros"), [`Hasta 1.200${NBSP}€`]);
    const huge = interpret("menos de 12000 euros");
    assert.equal(huge.filters.maxPrice, undefined);
    assert.equal(huge.text, "menos de 12000 euros");
  });

  it("un importe con decimales incluye la pala de ese precio exacto", () => {
    assert.deepEqual(interpret("pala por 99,95 €").filters, { maxPrice: 100 });
    assert.deepEqual(interpret("hasta 150,00 euros").filters, { maxPrice: 150 });
    assert.deepEqual(interpret("hasta 149.5 euros").filters, { maxPrice: 150 });
  });
});

describe("«del año pasado»", () => {
  it("es una sola temporada, la anterior a la actual", () => {
    assert.deepEqual(interpret("palas del año pasado").filters, { years: [2025] });
    assert.deepEqual(interpret("pala de la temporada pasada").filters, { years: [2025] });
    // «Temporadas pasadas», en plural, siguen siendo todas las anteriores.
    assert.deepEqual(interpret("palas de temporadas pasadas").filters, { years: [2025, 2024, 2023] });
  });

  it("si el catálogo no tiene esa temporada, no se inventa el filtro", () => {
    const intent = interpretSearch("palas del año pasado", { ...context, years: [2026] });
    assert.deepEqual(intent.filters, {});
    assert.equal(intent.text, "palas del año pasado");
  });
});

describe("lo que se enseña como interpretado es lo que rige (B-07)", () => {
  const typed = (q: string): CatalogQuery => ({ ...DEFAULT_QUERY, q });

  it("un filtro fijado a mano deja fuera al deducido del mismo tipo", () => {
    const explicit: CatalogQuery = { ...typed("redonda hasta 200 euros baratas"), maxPrice: 100, sort: "novedades" };
    const intent = interpret(explicit.q);
    const query = applyIntent(explicit, intent);
    assert.deepEqual(appliedCriteria(intent, query).map((item) => item.label), ["Forma redonda"]);
    // Sin filtros a mano, todo lo deducido rige.
    const plain = applyIntent(typed(explicit.q), intent);
    assert.deepEqual(appliedCriteria(intent, plain).map((item) => item.label), [`Hasta 200${NBSP}€`, "Ordenadas por precio", "Forma redonda"]);
  });

  it("el tope del deslizador anula el presupuesto deducido, y se distingue de un filtro fijado a mano", () => {
    const intent = interpret("palas hasta 500 euros");
    const explicit = typed("palas hasta 500 euros");
    const query = { ...applyIntent(explicit, intent), maxPrice: null };
    assert.deepEqual(appliedCriteria(intent, query), []);
    assert.deepEqual(
      unappliedCriteria(intent, query, explicit).map((item) => [item.criterion.label, item.reason]),
      [[`Hasta 500${NBSP}€`, "sin-efecto"]],
    );
    // El mismo criterio, pisado por un presupuesto elegido a mano.
    const byHand: CatalogQuery = { ...explicit, maxPrice: 100 };
    assert.deepEqual(
      unappliedCriteria(intent, applyIntent(byHand, intent), byHand).map((item) => item.reason),
      ["fijado-a-mano"],
    );
    assert.deepEqual(unappliedCriteria(intent, applyIntent(explicit, intent), explicit), []);
  });
});

describe("aplicar la interpretación a la consulta", () => {
  const typed = (q: string): CatalogQuery => ({ ...DEFAULT_QUERY, q });

  it("los criterios pasan a ser filtros y el texto que queda es el del modelo", () => {
    const query = applyIntent(typed("nox redonda menos de 150 euros at10"), interpret("nox redonda menos de 150 euros at10"));
    assert.deepEqual(
      { q: query.q, brands: query.brands, shapes: query.shapes, maxPrice: query.maxPrice },
      { q: "at10", brands: ["nox"], shapes: ["redonda"], maxPrice: 150 },
    );
  });

  it("lo elegido a mano manda sobre lo deducido", () => {
    const explicit: CatalogQuery = { ...typed("hasta 200 euros baratas"), maxPrice: 100, sort: "novedades" };
    const query = applyIntent(explicit, interpret(explicit.q));
    assert.equal(query.maxPrice, 100);
    assert.equal(query.sort, "novedades");
  });

  it("sin nada reconocido, la consulta no cambia", () => {
    const query = typed("vertex 04");
    assert.equal(applyIntent(query, interpret("vertex 04")), query);
  });

  it("cada filtro deducido se puede quitar como cualquier otro", () => {
    const query = applyIntent(typed("redonda con precio menos de 120 euros"), interpret("redonda con precio menos de 120 euros"));
    const filters = getActiveFilters(query, {});
    assert.deepEqual(filters.map((filter) => filter.label), ["Redonda", `Hasta 120${NBSP}€`, "Con precio hoy"]);
    // Quitar el presupuesto deja el resto, ya como parámetros explícitos de la URL.
    assert.equal(filters[1].href, "/palas-padel/?forma=redonda&cobertura=con-precio");
  });
});

describe("filtro de cobertura de precio", () => {
  it("viaja en la URL y solo admite valores conocidos", () => {
    const query = parseCatalogQuery({ cobertura: ["varias-tiendas", "inventado", "varias-tiendas"] });
    assert.deepEqual(query.coverage, ["varias-tiendas"]);
    assert.equal(catalogHref({ coverage: ["con-precio", "varias-tiendas"] }), "/palas-padel/?cobertura=con-precio&cobertura=varias-tiendas");
  });

  it("un listado filtrado por cobertura no se indexa", () => {
    assert.deepEqual(catalogSeo({ ...DEFAULT_QUERY, coverage: ["con-precio"] }), { canonical: null, index: false });
  });

  it("filtra con la misma regla de vigencia que el resto", async () => {
    const repository = createMemoryRepository();
    const all = await repository.countPalas();
    const priced = await repository.countPalas({ coverage: ["con-precio"] });
    const multi = await repository.countPalas({ coverage: ["varias-tiendas"] });
    assert.ok(priced > 0 && priced <= all);
    assert.ok(multi <= priced);
    // Un precio sin confirmar no cuenta: por eso puede haber menos que palas con algún precio guardado.
    assert.ok(priced <= (await repository.getPricedPalaSlugs()).length);
    const withPrice = await repository.searchCatalog({ ...DEFAULT_QUERY, coverage: ["con-precio"] }, { pageSize: 100 });
    assert.equal(withPrice.total, priced);
    assert.ok(withPrice.items.every((pala) => pala.price !== null));
    const { items } = await repository.searchCatalog({ ...DEFAULT_QUERY, coverage: ["varias-tiendas"] }, { pageSize: 100 });
    assert.ok(items.every((pala) => pala.price !== null && pala.storeCount >= 2));
  });
});

describe("cuando no hay resultados", () => {
  it("propone quitar un criterio cada vez, y dice cuál", () => {
    const query: CatalogQuery = { ...DEFAULT_QUERY, q: "vertex", shapes: ["redonda"], maxPrice: 60, coverage: ["con-precio"] };
    const options = relaxations(query);
    assert.deepEqual(options.map((option) => option.label), [
      `Sin el presupuesto de 60${NBSP}€`,
      "Sin exigir precio disponible",
      "Con cualquier forma",
      "Sin el texto «vertex»",
    ]);
    // Cada opción quita una sola cosa: el resto de criterios sigue ahí.
    assert.deepEqual(options[0].query, { ...query, maxPrice: null });
    assert.deepEqual(options[2].query.maxPrice, 60);
  });

  it("sin filtros no hay nada que quitar", () => {
    assert.deepEqual(relaxations(DEFAULT_QUERY), []);
  });
});
