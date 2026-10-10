import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GTIN_METALBONE_34_2025,
  GTIN_VERTEX_05_2026,
} from "@/ingestion/adapters/mock";
import { normalizeGtin } from "@/ingestion/gtin";
import { BUNDLE_NOTE, hasInvalidEan, INVALID_EAN_NOTE, matchProduct, PACK_NOTE, UNKNOWN_EAN_NOTE } from "@/ingestion/matcher";
import { isPack, parseTitle } from "@/ingestion/title";
import { catalog } from "./fixtures";

const match = (title: string, brand: string | null = null, ean: string | null = null) =>
  matchProduct({ title, brand, ean }, catalog);

describe("emparejamiento por EAN", () => {
  it("empareja automáticamente con el mismo EAN y la misma marca, diga lo que diga el título", () => {
    const result = match("Pala Adidas Ale Galán edición especial", "Adidas Padel", GTIN_METALBONE_34_2025);

    assert.equal(result.status, "matched");
    assert.equal(result.racketId, "metalbone-34-2025");
    assert.equal(result.method, "gtin");
  });

  it("reconoce la misma marca aunque la tienda la escriba separada o con coletilla", () => {
    const withGtin = [
      ...catalog.filter((racket) => racket.id !== "kyra-2027"),
      { id: "kyra-2027", brand: "StarVie", model: "Kyra", year: 2027, gtins: ["08436612942100"] },
    ];
    const byEan = matchProduct({ title: "Pala StarVie Kyra 2027", brand: "Star Vie", ean: "8436612942100" }, withGtin);
    const byName = match("Pala Star Vie Kyra 2027", "Star Vie");

    assert.equal(byEan.status, "matched");
    assert.equal(byEan.method, "gtin");
    assert.equal(byName.racketId, "kyra-2027");
  });

  it("manda a revisión un EAN conocido que llega con otra marca", () => {
    const result = match("Pala Metalbone 3.4 2025", "Nox", GTIN_METALBONE_34_2025);

    assert.equal(result.status, "pending_review");
    assert.equal(result.racketId, null);
  });

  it("nunca empareja si el EAN es distinto, aunque marca, modelo y año coincidan", () => {
    const result = match("Pala Bullpadel Vertex 04 2025", "Bullpadel", GTIN_VERTEX_05_2026);

    assert.equal(result.status, "rejected");
    assert.equal(result.racketId, null);
    assert.match(result.note ?? "", /EAN distinto/);
  });

  it("reconoce un UPC de 12 dígitos como el mismo código que su EAN-13", () => {
    assert.equal(normalizeGtin("198772101268"), normalizeGtin("0198772101268"));
    assert.equal(normalizeGtin("198772101268"), "00198772101268");
  });

  it("descarta códigos con dígito de control incorrecto o que no son un GTIN", () => {
    assert.equal(normalizeGtin("8435739402741"), null);
    assert.equal(normalizeGtin("113757-P"), null);
    assert.equal(normalizeGtin(null), null);
  });
});

describe("emparejamiento por marca, modelo, variante y año", () => {
  it("empareja automáticamente cuando hay un único candidato exacto", () => {
    const result = match("Pala Nox Equation Hard Advanced 2027", "Nox");

    assert.equal(result.status, "matched");
    assert.equal(result.racketId, "equation-hard-advanced-2027");
    assert.equal(result.method, "attributes");
  });

  it("entiende el año escrito con dos cifras y la marca tomada del título", () => {
    const result = match("Bullpadel Neuron 25");

    assert.equal(result.status, "matched");
    assert.equal(result.racketId, "neuron-2025");
  });

  it("nunca empareja una colección de otro año", () => {
    const result = match("Pala Bullpadel Neuron 2026", "Bullpadel");

    assert.equal(result.status, "rejected");
    assert.match(result.note ?? "", /Año distinto/);
  });

  it("nunca empareja una variante distinta del mismo modelo", () => {
    const woman = match("Pala Bullpadel Neuron Woman 2025", "Bullpadel");
    const light = match("Pala StarVie Kyra Light 2027", "StarVie");

    assert.equal(woman.status, "rejected");
    assert.match(woman.note ?? "", /Variante distinta/);
    assert.equal(light.status, "rejected");
  });

  it("distingue la variante «+» del modelo base", () => {
    assert.equal(match("Pala StarVie Drax + 2027", "StarVie").racketId, "drax-plus-2027");
    assert.equal(match("Pala StarVie Drax 2027", "StarVie").status, "rejected");
  });
});

describe("coincidencias ambiguas", () => {
  it("manda a revisión un título sin año", () => {
    const result = match("Pala Nox Equation Hard Advanced", "Nox");

    assert.equal(result.status, "pending_review");
    assert.equal(result.racketId, null);
    assert.match(result.note ?? "", /año/);
  });

  it("manda a revisión un nombre parecido que no coincide del todo", () => {
    const result = match("Pala Siux Fenix Pro Glow Purple 2026", "Siux");

    assert.equal(result.status, "pending_review");
  });

  it("manda a revisión cuando varias palas del catálogo podrían coincidir", () => {
    const twins = [
      ...catalog,
      { id: "fenix-pro-2026-bis", brand: "Siux", model: "Fenix Pro", year: 2026, gtins: [] },
    ];
    const result = matchProduct({ title: "Pala Siux Fenix Pro 2026", brand: "Siux", ean: null }, twins);

    assert.equal(result.status, "pending_review");
    assert.match(result.note ?? "", /Varias palas/);
  });

  it("un pack se rechaza con su motivo aunque el EAN coincida: no ocupa la cola de revisión", () => {
    const result = match("Pack Adidas Metalbone 3.4 2025 + paletero", "Adidas", GTIN_METALBONE_34_2025);

    assert.equal(result.status, "rejected");
    assert.equal(result.note, PACK_NOTE);
    assert.equal(result.racketId, null);
  });

  it("rechaza un producto que no tiene equivalente en el catálogo", () => {
    const result = match("Pala Head Speed Motion 2026", "Head");

    assert.equal(result.status, "rejected");
    assert.equal(result.racketId, null);
  });

  it("una revisión dice qué palas podrían ser", () => {
    const twins = [...catalog, { id: "fenix-pro-2026-bis", brand: "Siux", model: "Fenix Pro", year: 2026, gtins: [] }];
    const result = matchProduct({ title: "Pala Siux Fenix Pro 2026", brand: "Siux", ean: null }, twins);
    assert.deepEqual(result.candidates?.sort(), ["fenix-pro-2026", "fenix-pro-2026-bis"]);
    assert.deepEqual(match("Pala Nox Equation Hard Advanced", "Nox").candidates, ["equation-hard-advanced-2027"]);
  });
});

// Etapa 1 de la auditoría: lo que un emparejamiento automático no debe hacer.
describe("EAN que no cuadra con el catálogo", () => {
  it("un EAN desconocido no da por buena la pala sin EAN que queda al descartar las de su edición", () => {
    const colours = [
      ...catalog,
      { id: "vertex-04-2025-roja", brand: "Bullpadel", model: "Vertex 04", year: 2025, gtins: [] },
    ];
    const result = matchProduct({ title: "Pala Bullpadel Vertex 04 2025", brand: "Bullpadel", ean: GTIN_VERTEX_05_2026 }, colours);
    assert.equal(result.status, "pending_review");
    assert.equal(result.note, UNKNOWN_EAN_NOTE);
    assert.deepEqual(result.candidates, ["vertex-04-2025-roja"]);
  });

  it("sin palas con EAN que descartar, un EAN desconocido no impide emparejar por nombre", () => {
    const result = match("Pala Bullpadel Neuron 2025", "Bullpadel", GTIN_VERTEX_05_2026);
    assert.equal(result.status, "matched");
    assert.equal(result.racketId, "neuron-2025");
    assert.equal(result.note, null);
  });

  it("un EAN con el dígito de control mal no cuenta, y se avisa en el enlace", () => {
    const result = match("Pala Nox Equation Hard Advanced 2027", "Nox", "8435739402741");
    assert.equal(result.status, "matched");
    assert.equal(result.method, "attributes");
    assert.equal(result.note, INVALID_EAN_NOTE);
    assert.equal(hasInvalidEan({ ean: "8435739402741" }), true);
    assert.equal(hasInvalidEan({ ean: null }), false);
    assert.equal(hasInvalidEan({ ean: "  " }), false);
  });
});

describe("packs", () => {
  it("un pack inequívoco se rechaza con el motivo «Pack», con o sin EAN, exista o no el modelo", () => {
    const titles = [
      "Pack Pala Siux Fenix Pro 2026 + Paletero",
      "Pack dúo Pala Bullpadel Vertex 05 2026",
      "Pack dúo Pala Adidas Metalbone 3.4 2025 Ale Galán",
      "Pala Oxdog Ultimate Court + Paletero Oxdog FEP ultra tour padel bag + Bote de pelotas",
      "PACK NOX AT10 GENIUS 12K ALUM RIYADH EDITION AGUSTÍN TAPIA 2026",
      "Pack Nox Agustín Tapia AT10 Genius 18K Alum 2025",
      "2 Palas Adidas Metalbone 3.4 2025 x2",
      "Pack Pala Head Speed Motion 2026 + Paletero",
      "Mochila Bullpadel Vertex 04 2025",
    ];
    for (const title of titles) {
      for (const ean of [null, GTIN_METALBONE_34_2025]) {
        const result = match(title, null, ean);
        assert.equal(result.status, "rejected", `${title} · EAN ${ean}`);
        assert.equal(result.note, PACK_NOTE, title);
        assert.equal(result.racketId, null, title);
        assert.equal(result.candidates, undefined, title);
      }
    }
    assert.equal(isPack("Pack dúo Pala Bullpadel Xplo 2026"), true);
    assert.equal(isPack("Pala Bullpadel Xplo 2026"), false);
  });

  it("una palabra ambigua no convierte una pala suelta en pack", () => {
    // Variantes, jugadores, accesorios incluidos o estados no son packs: conservan su regla.
    assert.equal(match("Pala Nox Equation Hard Advanced 2027", "Nox").status, "matched");
    assert.equal(match("Pala StarVie Drax + 2027", "StarVie").racketId, "drax-plus-2027");
    assert.equal(match("Pala Bullpadel Neuron 25 Backpack Edition").status, "pending_review");
    for (const title of ["Pala Adidas Metalbone 3.4 2025 con protector incluido", "Funda Adidas Metalbone 3.4 2025"]) {
      const result = match(title, "Adidas", GTIN_METALBONE_34_2025);
      assert.notEqual(result.note, PACK_NOTE, title);
    }
  });
});

describe("outlet, segunda mano y accesorios", () => {
  it("no se emparejan solos ni con el EAN de la pala: van a revisión", () => {
    for (const title of [
      "Pala Adidas Metalbone 3.4 2025 Outlet",
      "Pala Adidas Metalbone 3.4 2025 Usada",
      "Pala Adidas Metalbone 3.4 2025 Seminueva",
      "Funda Adidas Metalbone 3.4 2025",
    ]) {
      const result = match(title, "Adidas", GTIN_METALBONE_34_2025);
      assert.equal(result.status, "pending_review", title);
      assert.equal(result.note, BUNDLE_NOTE, title);
    }
  });

  it("de un modelo que no está en el catálogo se rechazan, con el motivo", () => {
    const result = match("Pala Head Speed Motion 2026 Outlet", "Head");
    assert.equal(result.status, "rejected");
    assert.match(result.note ?? "", /Accesorio.*Sin equivalente/);
  });
});

describe("números del nombre del modelo que parecen años", () => {
  const numbered = [
    ...catalog,
    { id: "vertex-23-2026", brand: "Bullpadel", model: "Vertex 23", year: 2026, gtins: [] },
    { id: "nerbo-24-2024", brand: "Nox", model: "Nerbo 24", year: 2024, gtins: [] },
  ];
  const within = (title: string, brand: string) => matchProduct({ title, brand, ean: null }, numbered);

  it("el modelo base no se empareja con el modelo numerado", () => {
    const result = within("Pala Bullpadel Vertex 2026", "Bullpadel");
    assert.notEqual(result.status, "matched");
    assert.equal(result.racketId, null);
  });

  it("con el año de cuatro cifras, el número de dos es parte del modelo", () => {
    assert.equal(within("Pala Bullpadel Vertex 23 2026", "Bullpadel").racketId, "vertex-23-2026");
    assert.equal(within("Pala Nox Nerbo 24 2024", "Nox").racketId, "nerbo-24-2024");
    // Y en la pala del catálogo el número nunca es un año.
    assert.deepEqual([...parseTitle("Vertex 23", ["Bullpadel"], { years: false }).tokens], ["vertex", "23"]);
  });

  it("sin año de cuatro cifras, dos cifras siguen siendo la colección", () => {
    assert.equal(match("Bullpadel Neuron 25").racketId, "neuron-2025");
    assert.equal(parseTitle("Bullpadel Neuron 25", ["Bullpadel"]).year, 2025);
    assert.equal(parseTitle("Nox ML10 Pro Cup 22 2026", ["Nox"]).year, 2026);
    assert.ok(parseTitle("Nox ML10 Pro Cup 22 2026", ["Nox"]).tokens.has("22"));
  });
});

describe("resultado independiente del orden del catálogo", () => {
  it("la marca sacada del título es la más larga que encaja, llegue como llegue el catálogo", () => {
    const brands = [
      { id: "crown-1", brand: "Crown", model: "Piton", year: 2025, gtins: [] },
      { id: "black-crown-1", brand: "Black Crown", model: "Piton", year: 2025, gtins: [] },
    ];
    const listing = { title: "Pala Black Crown Piton 2025", brand: null, ean: null };
    assert.equal(matchProduct(listing, brands).racketId, "black-crown-1");
    assert.equal(matchProduct(listing, [...brands].reverse()).racketId, "black-crown-1");
  });

  it("el motivo del rechazo es el veto de la pala más parecida", () => {
    // Metalbone 3.4 2025 veta por variante; Metalbone Team Light 2026, más parecida, por año.
    const result = match("Pala Adidas Metalbone Team Light 2025", "Adidas");
    assert.equal(result.status, "rejected");
    assert.equal(result.note, "Año distinto.");
    assert.equal(matchProduct({ title: "Pala Adidas Metalbone Team Light 2025", brand: "Adidas", ean: null }, [...catalog].reverse()).note, "Año distinto.");
  });
});
