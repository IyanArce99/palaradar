// El veredicto de precio se calcula sobre 30 días y no existe hasta que el
// seguimiento de la pala cubre esa ventana.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPalaSummary, toPriceStatsRow } from "@/data/mappers";
import {
  buildPriceSummary,
  classifyPrice,
  computePriceStats,
  hasEnoughHistory,
  HISTORY_WINDOW_DAYS,
  priceCardNote,
} from "@/lib/pricing";
import type { PricePoint, StoreOffer } from "@/types/catalog";
import type { RacketCatalogRow } from "@/types/db";

const NOW = new Date("2026-11-20T12:00:00Z");
const DAY_MS = 86_400_000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS).toISOString().slice(0, 10);

function offer(price: number): StoreOffer {
  return {
    store: { id: "tienda", slug: "tienda", name: "Tienda", url: "https://example.com" },
    price,
    shipping: 0,
    previousPrice: null,
    availability: "En stock",
    url: null,
    checkedAt: NOW.toISOString(),
  };
}

/** Un registro por día durante `days` días, hasta hoy: el precio de cada día lo da `priceAt(díasAtrás)`. */
function history(days: number, priceAt: (ago: number) => number): PricePoint[] {
  return Array.from({ length: days }, (_, i) => days - 1 - i).map((ago) => ({ date: daysAgo(ago), price: priceAt(ago) }));
}

const flat = (price: number) => () => price;

describe("histórico insuficiente: «Precio reciente»", () => {
  // Días de seguimiento contando hoy. Con 30 registros diarios el primero es de hace 29 días.
  for (const days of [1, 2, 7, 15, 30]) {
    it(`con ${days} día(s) de histórico no hay veredicto, media ni mínimo`, () => {
      // Hoy está más barata que nunca: justo el caso que antes daba «Buen momento para comprar».
      const points = history(days, (ago) => (ago === 0 ? 180 : 220));
      const stats = computePriceStats([offer(180)], points, NOW);
      const summary = buildPriceSummary([offer(180)], points, NOW);

      assert.equal(hasEnoughHistory(points, NOW), false);
      assert.equal(stats?.status, "recent");
      assert.equal(stats?.average30, null);
      assert.equal(stats?.minPrice, null);
      assert.equal(stats?.price30dAgo, null);
      assert.equal(stats?.trackedSince, daysAgo(days - 1));

      assert.equal(summary?.verdict.status, "recent");
      assert.equal(summary?.verdict.label, "Precio reciente");
      assert.equal(summary?.average30, null);
      assert.equal(summary?.min30, null);
      assert.equal(summary?.trackedSince, daysAgo(days - 1));
      // Dice desde cuándo se sigue y no afirma nada sobre el momento de compra.
      assert.match(summary?.verdict.detail ?? "", /^Seguimos este precio desde el \d+ de \w+ de 2026\./);
      assert.doesNotMatch(`${summary?.verdict.detail} ${summary?.verdict.answer}`, /buen momento|más bajo|mínimo|media/i);
      assert.equal(priceCardNote({ status: "recent", bestPrice: 180, minPrice: null }, "current"), null);
    });
  }

  it("sin ningún registro, la fecha es la de la comprobación del precio", () => {
    const summary = buildPriceSummary([offer(180)], [], NOW);
    assert.equal(summary?.verdict.status, "recent");
    assert.equal(summary?.trackedSince, null);
    assert.match(summary?.verdict.detail ?? "", /desde el 20 de noviembre de 2026/);
  });

  it("en el catálogo no lleva nota ni entra en «Mejor precio hoy»", () => {
    const stats = computePriceStats([offer(180)], history(7, flat(180)), NOW);
    assert.ok(stats);
    const stored = toPriceStatsRow("r1", stats);
    assert.equal(stored.price_status, "recent");
    assert.equal(stored.avg_30d, null);
    assert.equal(stored.min_price, null);
    assert.equal(stored.tracked_since, daysAgo(6));

    const row: RacketCatalogRow = {
      id: "r1", slug: "pala", model: "Pala", year: 2026, images: [], shape: "redonda", balance: null, play_style: null,
      levels: [], description: "", rating: 0, review_count: 0, brand_slug: "marca", brand_name: "Marca", search_text: "",
      best_price: stored.best_price, store_count: 1, previous_price: null, drop_percent: null, min_price: stored.min_price,
      price_30d_ago: stored.price_30d_ago, price_status: stored.price_status, price_checked_at: stored.price_checked_at,
    };
    assert.equal(toPalaSummary(row, NOW).priceNote, null);

    // Las tarjetas lo indican solo si hay precio actual y aún no hay veredicto.
    assert.equal(toPalaSummary(row, NOW).priceRecent, true);
    assert.equal(toPalaSummary({ ...row, price_status: "fair" }, NOW).priceRecent, false);
    assert.equal(toPalaSummary({ ...row, price_status: "good" }, NOW).priceRecent, false);
    const stale = new Date(NOW.getTime() - 100 * 3_600_000).toISOString();
    assert.equal(toPalaSummary({ ...row, price_checked_at: stale }, NOW).priceRecent, false);
    assert.equal(toPalaSummary({ ...row, best_price: null, price_status: null, price_checked_at: null }, NOW).priceRecent, false);
  });
});

describe("con 30 días de histórico o más: veredicto sobre los últimos 30 días", () => {
  it("la ventana se cubre cuando el primer registro tiene 30 días", () => {
    assert.equal(HISTORY_WINDOW_DAYS, 30);
    assert.equal(hasEnoughHistory(history(30, flat(200)), NOW), false);
    assert.equal(hasEnoughHistory(history(31, flat(200)), NOW), true);
    // También si el seguimiento empezó hace más y hay días sin registro.
    assert.equal(hasEnoughHistory([{ date: daysAgo(45), price: 200 }, { date: daysAgo(0), price: 200 }], NOW), true);
  });

  it("un precio que no se ha movido es «Precio normal», no una oportunidad", () => {
    const points = history(40, flat(200));
    const summary = buildPriceSummary([offer(200)], points, NOW);

    assert.equal(summary?.verdict.status, "fair");
    assert.equal(summary?.verdict.label, "Precio normal");
    assert.equal(summary?.average30, 200);
    assert.deepEqual(summary?.min30?.price, 200);
    assert.match(summary?.verdict.detail ?? "", /últimos 30 días/);
    assert.equal(priceCardNote({ status: "fair", bestPrice: 200, minPrice: 200 }, "current"), null);
  });

  it("una bajada real sobre la media de 30 días es «Buen momento para comprar»", () => {
    // 220 € durante un mes y hoy 180 €: mínimo de la ventana y un 18 % bajo la media.
    const points = history(40, (ago) => (ago === 0 ? 180 : 220));
    const stats = computePriceStats([offer(180)], points, NOW);
    const summary = buildPriceSummary([offer(180)], points, NOW);

    assert.equal(stats?.status, "good");
    assert.equal(stats?.minPrice, 180);
    assert.equal(stats?.price30dAgo, 220);
    assert.equal(summary?.verdict.label, "Buen momento para comprar");
    assert.match(summary?.verdict.detail ?? "", /por debajo de su precio medio de los últimos 30 días/);
    assert.match(summary?.verdict.answer ?? "", /precio más bajo de los últimos 30 días/);
    assert.equal(priceCardNote({ status: "good", bestPrice: 180, minPrice: 180 }, "current"), "Cerca de su mínimo");
  });

  it("lo que pasó hace más de 30 días no cuenta", () => {
    // Hace dos meses estuvo a 150 €; en los últimos 30 días, siempre a 200 €.
    const points = [...history(31, flat(200)), { date: daysAgo(60), price: 150 }].sort((a, b) => a.date.localeCompare(b.date));
    const stats = computePriceStats([offer(200)], points, NOW);

    assert.equal(stats?.minPrice, 200);
    assert.equal(stats?.average30, 200);
    assert.equal(stats?.status, "fair");
    assert.equal(stats?.trackedSince, daysAgo(60));
  });

  it("si en la ventana estuvo bastante más barata, «Puedes esperar»", () => {
    // 170 € hace dos semanas; ahora 200 €, por encima de la media.
    const points = history(40, (ago) => (ago >= 10 && ago <= 20 ? 170 : 200));
    const summary = buildPriceSummary([offer(200)], points, NOW);

    assert.equal(summary?.verdict.status, "wait");
    assert.equal(summary?.min30?.price, 170);
    assert.match(summary?.verdict.detail ?? "", /En los últimos 30 días ha llegado a estar a 170\s€/);
  });

  it("estar en el mínimo no basta si apenas está por debajo de la media", () => {
    assert.equal(classifyPrice(199, 200, 199), "fair");
    assert.equal(classifyPrice(193, 200, 193), "good");
    assert.equal(classifyPrice(184, 200, 170), "good");
  });

  it("un precio desactualizado sigue sin veredicto de histórico", () => {
    const stale = { ...offer(180), checkedAt: new Date(NOW.getTime() - 100 * 3_600_000).toISOString() };
    const summary = buildPriceSummary([stale], history(40, flat(220)), NOW);
    assert.equal(summary?.verdict.status, "stale");
  });
});
