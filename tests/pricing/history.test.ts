// Histórico global («mejor precio del mercado por día») y por tienda.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRepository } from "@/data/memory-repository";
import { buildPriceHistory, type StorePriceRecord } from "@/lib/pricing";
import type { Store } from "@/types/catalog";

const store = (slug: string): Store => ({ id: `id-${slug}`, slug, name: slug, url: `https://example.com/${slug}` });
const A = store("tienda-a");
const B = store("tienda-b");

const records: StorePriceRecord[] = [
  { store: A, date: "2026-10-01", price: 250 },
  { store: A, date: "2026-10-02", price: 240 },
  // La tienda B empieza a seguirse el día 2 y no tiene registro el día 3.
  { store: B, date: "2026-10-02", price: 230 },
  { store: A, date: "2026-10-03", price: 245 },
  { store: B, date: "2026-10-04", price: 260 },
  { store: A, date: "2026-10-04", price: 260 },
];

describe("histórico por tienda", () => {
  it("devuelve la serie de cada tienda por separado, en orden cronológico", () => {
    const { byStore } = buildPriceHistory([...records].reverse());

    assert.deepEqual(byStore.map((series) => series.store.slug), ["tienda-a", "tienda-b"]);
    assert.deepEqual(byStore[0].points, [
      { date: "2026-10-01", price: 250 },
      { date: "2026-10-02", price: 240 },
      { date: "2026-10-03", price: 245 },
      { date: "2026-10-04", price: 260 },
    ]);
    assert.deepEqual(byStore[1].points, [
      { date: "2026-10-02", price: 230 },
      { date: "2026-10-04", price: 260 },
    ]);
  });

  it("no inventa días: una tienda sin registro un día no tiene punto ese día", () => {
    const { byStore } = buildPriceHistory(records);
    assert.equal(byStore[1].points.some((point) => point.date === "2026-10-03"), false);
    assert.equal(byStore[1].points.some((point) => point.date === "2026-10-01"), false);
  });
});

describe("histórico global", () => {
  it("es el mejor precio de cada día, con la tienda que lo tenía y cuántas había", () => {
    const { market } = buildPriceHistory(records);

    assert.deepEqual(
      market.map((point) => [point.date, point.price, point.store.slug, point.storeCount]),
      [
        ["2026-10-01", 250, "tienda-a", 1],
        ["2026-10-02", 230, "tienda-b", 2],
        ["2026-10-03", 245, "tienda-a", 1],
        // Empate: gana la primera por orden alfabético.
        ["2026-10-04", 260, "tienda-a", 2],
      ],
    );
  });

  it("sin registros no hay histórico", () => {
    assert.deepEqual(buildPriceHistory([]), { market: [], byStore: [] });
  });
});

describe("repositorio", () => {
  it("el histórico global coincide con el que usa hoy el gráfico de la ficha", async () => {
    const repository = createMemoryRepository();
    const [slug] = await repository.getAllPalaSlugs();
    const pala = await repository.getPalaBySlug(slug);
    const history = await repository.getPriceHistory(slug);

    assert.ok(pala && history);
    assert.ok(history.market.length > 0);
    assert.deepEqual(
      history.market.map(({ date, price }) => ({ date, price })),
      pala.priceHistory,
    );
    // Cada tienda tiene su serie y el global nunca está por encima de ninguna ese día.
    assert.ok(history.byStore.length > 1);
    for (const series of history.byStore) {
      for (const point of series.points) {
        const market = history.market.find((item) => item.date === point.date);
        assert.ok(market && market.price <= point.price);
      }
    }
  });

  it("una pala que no existe no tiene histórico", async () => {
    assert.equal(await createMemoryRepository().getPriceHistory("no-existe"), null);
  });
});
