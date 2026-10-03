// Bloqueo de ingestión, fallos de la tienda y recuperación.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currentPrice } from "@/data/mappers";
import { createMockAdapter, GTIN_METALBONE_34_2025 } from "@/ingestion/adapters/mock";
import { INTERRUPTED_RUN_MESSAGE } from "@/ingestion/repository";
import { IngestionLockedError, runIngestion } from "@/ingestion/run";
import type { StoreAdapter, StoreListing } from "@/ingestion/types";
import { priceFreshness } from "@/lib/pricing";
import type { RacketCatalogRow } from "@/types/db";
import { createRepository, DAY_1, DAY_2, DAY_3, listing } from "./fixtures";

function metalbone(price: number, at: Date): StoreListing {
  return listing(
    { externalId: "MB34", title: "Pala Adidas Metalbone 3.4 2025", brand: "Adidas", ean: GTIN_METALBONE_34_2025, price },
    at,
  );
}

/** Adaptador cuya descarga no termina hasta que el test la suelta. */
function slowAdapter(listings: StoreListing[]) {
  let release: () => void = () => {};
  const downloading = new Promise<void>((resolve) => {
    release = resolve;
  });
  const adapter: StoreAdapter = {
    ...createMockAdapter(listings),
    async fetchProducts() {
      await downloading;
      return listings;
    },
  };
  return { adapter, release };
}

describe("dos ingestiones a la vez", () => {
  it("la segunda detecta el bloqueo y aborta sin escribir nada", async () => {
    const repository = createRepository();
    const slow = slowAdapter([metalbone(249.95, DAY_1)]);

    const first = runIngestion(slow.adapter, repository, DAY_1);
    // Deja que la primera tome el bloqueo y se quede descargando.
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(repository.state.locked, true);

    await assert.rejects(
      runIngestion(createMockAdapter([metalbone(1, DAY_1)]), repository, DAY_1),
      IngestionLockedError,
    );
    // La segunda no ha registrado ejecución ni ha tocado productos o precios.
    assert.equal(repository.state.runs.length, 1);
    assert.equal(repository.state.storeProducts.length, 0);
    assert.equal(repository.state.publishedPrices.length, 0);

    slow.release();
    const summary = await first;

    assert.equal(summary.status, "success");
    assert.equal(repository.state.publishedPrices[0].price, 249.95);
    assert.equal(repository.state.locked, false);
  });
});

describe("liberación del bloqueo", () => {
  it("se libera después de una ejecución correcta", async () => {
    const repository = createRepository();
    await runIngestion(createMockAdapter([metalbone(249.95, DAY_1)]), repository, DAY_1);
    assert.equal(repository.state.locked, false);

    const second = await runIngestion(createMockAdapter([metalbone(239.95, DAY_2)]), repository, DAY_2);
    assert.equal(second.status, "success");
  });

  it("se libera después de un fallo de la tienda", async () => {
    const repository = createRepository();
    const failed = await runIngestion(createMockAdapter([], { fail: "La tienda no responde" }), repository, DAY_1);

    assert.equal(failed.status, "failed");
    assert.equal(repository.state.locked, false);

    const next = await runIngestion(createMockAdapter([metalbone(249.95, DAY_2)]), repository, DAY_2);
    assert.equal(next.status, "success");
  });

  it("se libera aunque falle el propio registro de la ejecución", async () => {
    const repository = createRepository();
    const finishRun = repository.finishRun;
    repository.finishRun = async () => {
      throw new Error("Base de datos caída");
    };

    await assert.rejects(
      runIngestion(createMockAdapter([metalbone(249.95, DAY_1)]), repository, DAY_1),
      /Base de datos caída/,
    );
    assert.equal(repository.state.locked, false);

    // La ejecución que quedó «en marcha» se da por fallida en la siguiente.
    repository.finishRun = finishRun;
    const next = await runIngestion(createMockAdapter([metalbone(249.95, DAY_2)]), repository, DAY_2);

    assert.equal(next.status, "success");
    assert.equal(repository.state.runs[0].status, "failed");
    assert.equal(repository.state.runs[0].errorMessage, INTERRUPTED_RUN_MESSAGE);
    assert.equal(repository.state.runs[1].status, "success");
  });
});

describe("tienda que falla y se recupera", () => {
  /** Lo que el catálogo sabría de la pala con el precio publicado en el repositorio. */
  function catalogRow(checkedAt: string, price: number): RacketCatalogRow {
    return {
      id: "metalbone-34-2025", slug: "metalbone", model: "Metalbone 3.4", year: 2025, images: [],
      shape: "diamante", balance: null, play_style: null, levels: [], description: "", rating: 0,
      review_count: 0, brand_slug: "adidas", brand_name: "Adidas", search_text: "",
      best_price: price, store_count: 1, previous_price: null, drop_percent: null, min_price: price,
      price_30d_ago: null, price_status: "fair", price_checked_at: checkedAt,
    };
  }

  it("conserva precio e histórico mientras falla, lo deja caducar y lo recupera al volver", async () => {
    const repository = createRepository();
    const broken = createMockAdapter([], { fail: "La tienda no responde" });
    const day4 = new Date("2026-10-08T06:00:00Z");

    await runIngestion(createMockAdapter([metalbone(249.95, DAY_1)]), repository, DAY_1);
    const historyBefore = structuredClone(repository.state.priceHistory);

    // Dos días seguidos sin poder leer la tienda.
    assert.equal((await runIngestion(broken, repository, DAY_2)).status, "failed");
    assert.equal((await runIngestion(broken, repository, DAY_3)).status, "failed");

    const [kept] = repository.state.publishedPrices;
    assert.equal(kept.price, 249.95);
    assert.equal(kept.checkedAt, DAY_1.toISOString());
    assert.deepEqual(repository.state.priceHistory, historyBefore);
    assert.equal(repository.state.storeProducts[0].missedRuns, 0);

    // El precio sigue guardado, pero a las 24 h deja de ser «de hoy» y a las 48 h caduca.
    assert.equal(priceFreshness(kept.checkedAt, DAY_1), "current");
    assert.equal(priceFreshness(kept.checkedAt, DAY_2), "current");
    assert.equal(priceFreshness(kept.checkedAt, new Date("2026-10-06T18:00:00Z")), "recent");
    assert.equal(priceFreshness(kept.checkedAt, day4), "stale");
    assert.equal(currentPrice(catalogRow(kept.checkedAt, kept.price), day4), null);

    // La tienda vuelve: sin intervención, el precio vuelve a ser actual.
    const recovered = await runIngestion(createMockAdapter([metalbone(239.95, day4)]), repository, day4);
    const [price] = repository.state.publishedPrices;

    assert.equal(recovered.status, "success");
    assert.equal(price.price, 239.95);
    assert.equal(price.previousPrice, 249.95);
    assert.equal(price.checkedAt, day4.toISOString());
    assert.equal(priceFreshness(price.checkedAt, day4), "current");
    assert.equal(currentPrice(catalogRow(price.checkedAt, price.price), day4), 239.95);
    assert.deepEqual(
      repository.state.priceHistory.map((row) => [row.price_date, row.price]),
      [["2026-10-05", 249.95], ["2026-10-08", 239.95]],
    );
    assert.deepEqual(
      repository.state.runs.map((run) => run.status),
      ["success", "failed", "failed", "success"],
    );
  });
});
