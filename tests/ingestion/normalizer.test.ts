import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeListing } from "@/ingestion/normalizer";
import { DAY_1, listing } from "./fixtures";

const SHIPPING = { cost: 3.95, freeFrom: 50 };

describe("normalización de precios", () => {
  it("aplica el envío de la tienda por debajo del umbral y lo quita por encima", () => {
    const cheap = normalizeListing(listing({ title: "Pala", price: 39.95 }), SHIPPING, DAY_1);
    const expensive = normalizeListing(listing({ title: "Pala", price: 199.95 }), SHIPPING, DAY_1);

    assert.ok(cheap.ok && expensive.ok);
    assert.equal(cheap.offer.shipping, 3.95);
    assert.equal(cheap.offer.total, 43.9);
    assert.equal(expensive.offer.shipping, 0);
    assert.equal(expensive.offer.total, 199.95);
  });

  it("descarta precios en una moneda que no es el euro", () => {
    const result = normalizeListing(
      listing({ title: "Pala", price: 199.95, currency: "GBP" }),
      SHIPPING,
      DAY_1,
    );

    assert.equal(result.ok, false);
  });

  it("descarta precios no válidos en lugar de guardarlos", () => {
    for (const price of [0, -5, Number.NaN]) {
      assert.equal(normalizeListing(listing({ title: "Pala", price }), SHIPPING, DAY_1).ok, false);
    }
  });

  it("no acepta una fecha de comprobación posterior a la fecha actual", () => {
    const result = normalizeListing(
      listing({ title: "Pala", price: 100, checkedAt: "2030-01-01T00:00:00Z" }),
      SHIPPING,
      DAY_1,
    );

    assert.ok(result.ok);
    assert.equal(result.offer.checkedAt, DAY_1.toISOString());
  });

  it("ignora un precio de lista que no es mayor que el de venta", () => {
    const result = normalizeListing(
      listing({ title: "Pala", price: 100, listPrice: 100 }),
      SHIPPING,
      DAY_1,
    );

    assert.ok(result.ok);
    assert.equal(result.offer.listPrice, null);
  });
});
