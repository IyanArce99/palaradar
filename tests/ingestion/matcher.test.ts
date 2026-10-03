import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GTIN_METALBONE_34_2025,
  GTIN_VERTEX_05_2026,
} from "@/ingestion/adapters/mock";
import { normalizeGtin } from "@/ingestion/gtin";
import { matchProduct } from "@/ingestion/matcher";
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

  it("no empareja solo un pack, aunque el EAN coincida", () => {
    const result = match("Pack Adidas Metalbone 3.4 2025 + paletero", "Adidas", GTIN_METALBONE_34_2025);

    assert.equal(result.status, "pending_review");
  });

  it("rechaza un producto que no tiene equivalente en el catálogo", () => {
    const result = match("Pala Head Speed Motion 2026", "Head");

    assert.equal(result.status, "rejected");
    assert.equal(result.racketId, null);
  });
});
