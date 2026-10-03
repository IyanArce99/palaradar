// Separación entre datos reales y de demostración, y protección del seed.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveIncludeDemoStores } from "@/config/pricing";
import { resolveDataSource } from "@/data";
import { devSeedBlocker } from "@/data/db/admin";
import { buildSeed } from "@/data/seed/build";
import { getAdapter, availableStores } from "@/ingestion/adapters";
import { createMockAdapter } from "@/ingestion/adapters/mock";

describe("tiendas de demostración", () => {
  it("no cuentan nunca en producción, aunque se pida", () => {
    assert.equal(resolveIncludeDemoStores({ NODE_ENV: "production", INCLUDE_DEMO_PRICES: "true" }), false);
    assert.equal(resolveIncludeDemoStores({ NODE_ENV: "production" }), false);
  });

  it("en desarrollo solo cuentan si se pide expresamente", () => {
    assert.equal(resolveIncludeDemoStores({ NODE_ENV: "development" }), false);
    assert.equal(resolveIncludeDemoStores({}), false);
    assert.equal(resolveIncludeDemoStores({ NODE_ENV: "development", INCLUDE_DEMO_PRICES: "true" }), true);
  });

  it("todas las tiendas de la semilla están marcadas como demo", () => {
    const seed = buildSeed(new Date("2026-10-05T06:00:00Z"));
    assert.ok(seed.stores.length > 0);
    assert.ok(seed.stores.every((store) => store.is_demo));
  });

  it("el adaptador de prueba se declara demo y los reales no", () => {
    assert.equal(createMockAdapter([]).store.isDemo, true);
    assert.ok(availableStores.includes("padelproshop"));
    for (const slug of availableStores) assert.equal(getAdapter(slug).store.isDemo, false);
  });
});

describe("origen de datos", () => {
  it("en producción no cae en silencio a los datos de demostración", () => {
    assert.throws(() => resolveDataSource({ NODE_ENV: "production" }, false), /DATABASE_URL/);
    assert.throws(
      () => resolveDataSource({ NODE_ENV: "production", DATA_SOURCE: "database" }, false),
      /DATABASE_URL/,
    );
  });

  it("en producción usa la base de datos, o los datos demo solo si se piden", () => {
    assert.equal(resolveDataSource({ NODE_ENV: "production" }, true), "database");
    assert.equal(resolveDataSource({ NODE_ENV: "production", DATA_SOURCE: "mock" }, false), "mock");
  });

  it("en desarrollo arranca con la semilla si no hay base de datos", () => {
    assert.equal(resolveDataSource({ NODE_ENV: "development" }, false), "mock");
    assert.equal(resolveDataSource({}, true), "database");
  });
});

describe("seed de desarrollo (destructivo)", () => {
  it("no se ejecuta en producción, ni forzándolo", () => {
    assert.match(
      devSeedBlocker({ nodeEnv: "production", realStores: [], force: false }) ?? "",
      /production/,
    );
    assert.match(
      devSeedBlocker({ nodeEnv: "production", realStores: ["padelproshop"], force: true }) ?? "",
      /production/,
    );
  });

  it("se niega si hay datos de tiendas reales", () => {
    const blocker = devSeedBlocker({ nodeEnv: "development", realStores: ["padelproshop"], force: false });
    assert.match(blocker ?? "", /padelproshop/);
  });

  it("se permite en desarrollo sin datos reales, o pidiéndolo expresamente", () => {
    assert.equal(devSeedBlocker({ nodeEnv: undefined, realStores: [], force: false }), null);
    assert.equal(devSeedBlocker({ nodeEnv: "development", realStores: ["padelproshop"], force: true }), null);
  });
});
