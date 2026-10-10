// Favoritas guardadas en el navegador: lo que se lee del almacenamiento no es de
// fiar, así que se valida todo; y el cambio de precio solo se afirma con los dos
// precios en la mano.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  favoritePriceChange,
  isFavoritePala,
  localDay,
  MAX_FAVORITES,
  parseFavorites,
  parseSlugList,
  toggleFavorite,
  type FavoritePala,
} from "@/lib/favorites";

const favorite = (slug: string, savedPrice: number | null = 199.95): FavoritePala => ({
  slug,
  name: `Pala ${slug}`,
  savedPrice,
  savedAt: "2026-10-09",
});

describe("lectura de las favoritas guardadas", () => {
  it("devuelve vacío con nada, con algo que no es JSON o con algo que no es una lista", () => {
    assert.deepEqual(parseFavorites(null), []);
    assert.deepEqual(parseFavorites(""), []);
    assert.deepEqual(parseFavorites("no es json"), []);
    assert.deepEqual(parseFavorites('{"slug":"a"}'), []);
  });

  it("descarta entradas mal formadas, repetidas y campos que no esperaba", () => {
    const raw = JSON.stringify([
      favorite("pala-a"),
      { ...favorite("pala-b"), email: "alguien@example.com" },
      favorite("pala-a"),
      { slug: "Con Espacios", name: "x", savedPrice: null, savedAt: "2026-10-09" },
      { slug: "sin-fecha", name: "x", savedPrice: 10 },
      { slug: "precio-raro", name: "x", savedPrice: -5, savedAt: "2026-10-09" },
      "texto",
      null,
    ]);
    assert.deepEqual(parseFavorites(raw), [favorite("pala-a"), favorite("pala-b")]);
  });

  it("recupera lo que se guardó tal cual", () => {
    const saved = [favorite("pala-a"), favorite("pala-b", null)];
    assert.deepEqual(parseFavorites(JSON.stringify(saved)), saved);
  });

  it("no pasa del tope", () => {
    const many = Array.from({ length: MAX_FAVORITES + 10 }, (_, i) => favorite(`pala-${i}`));
    assert.equal(parseFavorites(JSON.stringify(many)).length, MAX_FAVORITES);
  });
});

describe("guardar y quitar", () => {
  it("añade al principio y quita la que ya estaba", () => {
    const a = favorite("pala-a");
    const b = favorite("pala-b");
    assert.deepEqual(toggleFavorite([], a), [a]);
    assert.deepEqual(toggleFavorite([a], b), [b, a]);
    assert.deepEqual(toggleFavorite([b, a], a), [b]);
    assert.equal(isFavoritePala([b, a], "pala-a"), true);
    assert.equal(isFavoritePala([b], "pala-a"), false);
  });

  it("con la lista llena no añade, pero sí deja quitar", () => {
    const full = Array.from({ length: MAX_FAVORITES }, (_, i) => favorite(`pala-${i}`));
    assert.equal(toggleFavorite(full, favorite("otra")), full);
    assert.equal(toggleFavorite(full, favorite("pala-0")).length, MAX_FAVORITES - 1);
  });
});

describe("cambio de precio desde que se guardó", () => {
  it("dice cuánto ha bajado o subido", () => {
    assert.deepEqual(favoritePriceChange(200, 170), { difference: -30, percent: -15 });
    assert.deepEqual(favoritePriceChange(200, 210), { difference: 10, percent: 5 });
  });

  it("no afirma nada sin los dos precios o sin cambio", () => {
    assert.equal(favoritePriceChange(null, 170), null);
    assert.equal(favoritePriceChange(200, null), null);
    assert.equal(favoritePriceChange(200, 200), null);
  });
});

describe("día en que se guarda", () => {
  it("es el día local de quien guarda, no el de UTC", () => {
    // Construida en hora local: pasada la medianoche sigue siendo ese día.
    assert.equal(localDay(new Date(2026, 9, 10, 0, 30)), "2026-10-10");
    assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
    assert.deepEqual(parseFavorites(JSON.stringify([{ ...favorite("pala-a"), savedAt: localDay(new Date()) }])).length, 1);
  });
});

describe("lista de slugs de la petición de precios", () => {
  it("se queda con slugs válidos, sin repetir y con tope", () => {
    assert.deepEqual(parseSlugList("pala-a, pala-b,pala-a,,../etc,UNA,pala-c"), ["pala-a", "pala-b", "pala-c"]);
    assert.deepEqual(parseSlugList(null), []);
    const many = Array.from({ length: MAX_FAVORITES + 5 }, (_, i) => `pala-${i}`).join(",");
    assert.equal(parseSlugList(many).length, MAX_FAVORITES);
  });
});
