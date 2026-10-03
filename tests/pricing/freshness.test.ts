// Un precio desactualizado no se presenta como precio actual.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currentPrice, toPalaSummary } from "@/data/mappers";
import { createMemoryRepository } from "@/data/memory-repository";
import { DEFAULT_QUERY } from "@/lib/catalog/query";
import { buildPriceSummary, computePriceStats, usableOffers } from "@/lib/pricing";
import type { StoreOffer } from "@/types/catalog";
import type { RacketCatalogRow } from "@/types/db";

const NOW = new Date("2026-10-05T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

function offer(storeId: string, price: number, checkedAt: string): StoreOffer {
  return {
    store: { id: storeId, slug: storeId, name: storeId, url: "https://example.com" },
    price,
    shipping: 0,
    previousPrice: null,
    availability: "En stock",
    url: null,
    checkedAt,
  };
}

function catalogRow(fields: Partial<RacketCatalogRow>): RacketCatalogRow {
  return {
    id: "r1",
    slug: "pala",
    model: "Pala",
    year: 2026,
    images: [],
    shape: "redonda",
    balance: null,
    play_style: null,
    levels: [],
    description: "",
    rating: 0,
    review_count: 0,
    brand_slug: "marca",
    brand_name: "Marca",
    search_text: "marca pala 2026",
    best_price: 199.95,
    store_count: 2,
    previous_price: 249.95,
    drop_percent: 20,
    min_price: 199.95,
    price_30d_ago: 249.95,
    price_status: "good",
    price_checked_at: hoursAgo(1),
    ...fields,
  };
}

describe("mejor precio con ofertas desactualizadas", () => {
  it("una oferta barata sin comprobar no gana a una comprobada", () => {
    const offers = [offer("vieja", 150, hoursAgo(200)), offer("fresca", 200, hoursAgo(2))];
    const stats = computePriceStats(offers, [], NOW);

    assert.deepEqual(usableOffers(offers, NOW).map((item) => item.store.id), ["fresca"]);
    assert.equal(stats?.bestPrice, 200);
    assert.equal(stats?.bestStoreId, "fresca");
    assert.equal(stats?.storeCount, 1);
    assert.equal(buildPriceSummary(offers, [], NOW)?.freshness, "current");
  });

  it("si todas están desactualizadas, el precio se presenta como sin confirmar", () => {
    const offers = [offer("a", 150, hoursAgo(200)), offer("b", 200, hoursAgo(100))];
    const summary = buildPriceSummary(offers, [], NOW);

    assert.equal(summary?.freshness, "stale");
    assert.equal(summary?.verdict.status, "stale");
    assert.equal(summary?.verdict.label, "Precio sin confirmar");
  });
});

describe("precio en los listados", () => {
  it("un precio comprobado se muestra", () => {
    const row = catalogRow({});
    assert.equal(currentPrice(row, NOW), 199.95);
    assert.equal(toPalaSummary(row, NOW).price, 199.95);
  });

  it("un precio desactualizado no se muestra ni cuenta como oferta", () => {
    const row = catalogRow({ price_checked_at: hoursAgo(72) });
    const summary = toPalaSummary(row, NOW);

    assert.equal(currentPrice(row, NOW), null);
    assert.equal(summary.price, null);
    assert.equal(summary.previousPrice, null);
    assert.equal(summary.dropPercent, null);
    assert.equal(summary.storeCount, 0);
    assert.equal(summary.priceNote, null);
  });

  it("una pala sin agregados no tiene precio", () => {
    const row = catalogRow({ best_price: null, price_checked_at: null, price_status: null });
    assert.equal(toPalaSummary(row, NOW).price, null);
  });
});

describe("catálogo en memoria", () => {
  it("las palas con precio desactualizado no entran en ofertas y van al final al ordenar por precio", async () => {
    const repository = createMemoryRepository();
    const all = await repository.searchCatalog({ ...DEFAULT_QUERY, sort: "precio" }, { pageSize: 100 });
    const deals = await repository.searchCatalog(
      { ...DEFAULT_QUERY, collection: "en-oferta" },
      { pageSize: 100 },
    );

    const prices = all.items.map((item) => item.price);
    const firstWithout = prices.indexOf(null);

    // La semilla deja a propósito algunas palas a 6 días de su última comprobación.
    assert.ok(firstWithout > 0, "debe haber palas con precio y palas sin precio actual");
    assert.ok(prices.slice(firstWithout).every((price) => price === null));
    assert.ok(deals.items.every((item) => item.price !== null));
  });
});
