// Diferencia de precio entre tiendas: solo entre ofertas vigentes de la misma
// pala, en céntimos enteros, y sin afirmar un coste final si falta algún envío.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spreadBoxSentence, spreadSentence } from "@/components/pala/StoreSpreadNote";
import { spreadAmount, storeSpread, toCents } from "@/lib/store-spread";
import type { StoreOffer } from "@/types/catalog";

const NOW = new Date("2026-10-09T12:00:00Z");
const HOUR = 3_600_000;
const NBSP = " ";

const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR).toISOString();

function offer(store: string, price: number, changes: Partial<StoreOffer> = {}): StoreOffer {
  return {
    store: { id: store, slug: store, name: `Tienda ${store.toUpperCase()}`, url: `https://${store}.example` },
    price,
    shipping: 0,
    previousPrice: null,
    availability: "En stock",
    url: `https://${store}.example/pala`,
    checkedAt: ago(1),
    ...changes,
  };
}

describe("cuándo hay algo que comparar", () => {
  it("hacen falta dos tiendas con precio vigente", () => {
    assert.equal(storeSpread([], NOW), null);
    assert.equal(storeSpread([offer("a", 200)], NOW), null);
    // La segunda tienda tiene el precio sin confirmar (más de 48 h): no es una oferta activa.
    assert.equal(storeSpread([offer("a", 200), offer("b", 150, { checkedAt: ago(60) })], NOW), null);
  });

  it("un precio antiguo pero vigente sí se compara, y se dice desde cuándo", () => {
    const spread = storeSpread([offer("a", 200), offer("b", 180, { checkedAt: ago(30) })], NOW);
    assert.ok(spread);
    assert.equal(spread.cheapest.freshness, "recent");
    assert.equal(spread.oldestCheck, ago(30));
  });

  it("descarta precios que no son válidos y no cuenta dos veces la misma tienda", () => {
    assert.equal(storeSpread([offer("a", 200), offer("b", 0), offer("c", Number.NaN), offer("d", -5)], NOW), null);
    const spread = storeSpread([offer("a", 200), offer("a", 190), offer("b", 210)], NOW);
    assert.equal(spread?.stores, 2);
    assert.equal(spread?.cheapest.price, 190);
  });
});

describe("cálculo", () => {
  it("diferencia absoluta y porcentaje sobre el precio más alto", () => {
    const spread = storeSpread([offer("a", 199.95), offer("b", 219), offer("c", 205)], NOW);
    assert.ok(spread);
    assert.equal(spread.stores, 3);
    assert.equal(spread.cheapest.store.slug, "a");
    assert.equal(spread.priciest.store.slug, "b");
    assert.equal(spread.difference, 19.05);
    // (219 − 199,95) / 219 × 100 = 8,698… → 8,7
    assert.equal(spread.percent, 8.7);
  });

  it("no arrastra errores de coma flotante", () => {
    // 0,1 + 0,2 en coma flotante no es 0,3; en céntimos, sí.
    assert.equal(toCents(0.1) + toCents(0.2), 30);
    const spread = storeSpread([offer("a", 100.1), offer("b", 100.3)], NOW);
    assert.equal(spread?.difference, 0.2);
    assert.equal(storeSpread([offer("a", 149.99), offer("b", 150)], NOW)?.difference, 0.01);
  });

  it("con el mismo precio la diferencia es cero, no nula", () => {
    const spread = storeSpread([offer("b", 150), offer("a", 150)], NOW);
    assert.equal(spread?.difference, 0);
    assert.equal(spread?.percent, 0);
    // A igualdad, un orden fijo: el resultado no depende de cómo lleguen las ofertas.
    assert.equal(spread?.cheapest.store.slug, "a");
  });

  it("es el mismo resultado llegue como llegue la lista", () => {
    const offers = [offer("a", 180), offer("b", 210), offer("c", 195)];
    assert.deepEqual(storeSpread(offers, NOW), storeSpread([...offers].reverse(), NOW));
  });
});

describe("gastos de envío", () => {
  it("con todos los envíos verificados compara el total con envío", () => {
    // La tienda A es más barata de precio, pero más cara con su envío.
    const spread = storeSpread([offer("a", 200, { shipping: 6 }), offer("b", 203, { shipping: 0 })], NOW);
    assert.ok(spread);
    assert.equal(spread.basis, "total");
    assert.equal(spread.cheapest.store.slug, "b");
    assert.equal(spread.difference, 3);
    assert.equal(spreadAmount(spread.priciest, spread.basis), 206);
    assert.ok(spreadSentence(spread).endsWith("con el envío incluido."));
  });

  it("con algún envío sin verificar compara solo el precio de la pala y lo dice", () => {
    const spread = storeSpread([offer("a", 200, { shipping: 6 }), offer("b", 203, { shipping: null })], NOW);
    assert.ok(spread);
    assert.equal(spread.basis, "producto");
    assert.deepEqual(spread.unverifiedShipping.map((store) => store.slug), ["b"]);
    // Se compara 200 con 203: el envío conocido de A no se suma a un lado solo.
    assert.equal(spread.cheapest.store.slug, "a");
    assert.equal(spread.difference, 3);
    const sentence = spreadSentence(spread);
    assert.ok(sentence.startsWith("El precio de la pala es"));
    assert.doesNotMatch(sentence, /envío incluido|coste final|total/);
  });
});

describe("frase", () => {
  it("dice el ahorro con su porcentaje y entre qué tiendas", () => {
    const spread = storeSpread([offer("a", 180), offer("b", 200)], NOW);
    assert.ok(spread);
    assert.equal(spreadSentence(spread), `En Tienda A cuesta 20,00${NBSP}€ (10 %) menos que en Tienda B, con el envío incluido.`);
  });

  it("con menos de un euro de diferencia no presume de ahorro", () => {
    const spread = storeSpread([offer("a", 199.5), offer("b", 199.95)], NOW);
    assert.ok(spread);
    assert.equal(spreadSentence(spread), "Las 2 tiendas piden prácticamente lo mismo por esta pala.");
    assert.equal(spreadBoxSentence(spread), "Las 2 tiendas piden prácticamente lo mismo por esta pala.");
  });

  it("en el recuadro de la ficha no repite la cifra y avisa una sola vez del envío sin verificar", () => {
    const verified = storeSpread([offer("a", 180), offer("b", 200)], NOW);
    assert.ok(verified);
    assert.equal(spreadBoxSentence(verified), "Con el envío incluido, cuesta menos en Tienda A que en Tienda B.");

    const unverified = storeSpread([offer("a", 200, { shipping: 6 }), offer("b", 203, { shipping: null })], NOW);
    assert.ok(unverified);
    const sentence = spreadBoxSentence(unverified);
    assert.equal(
      sentence,
      "La pala cuesta menos en Tienda A que en Tienda B. Falta sumar el envío de Tienda B, que no hemos verificado y puede cambiar el orden.",
    );
    // La cifra y el porcentaje van encima, en grande: la frase no los repite.
    assert.doesNotMatch(sentence, /€|%/);
    // Con un envío sin verificar no se afirma cuál es la más barata ni el coste final.
    assert.doesNotMatch(sentence, /más barata|envío incluido/);
  });
});
