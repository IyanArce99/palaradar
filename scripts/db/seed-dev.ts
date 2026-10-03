// Seed de DESARROLLO: SUSTITUYE el contenido de todas las tablas de PalaRadar
// por la semilla, con tiendas y precios de demostración. Solo para una base de
// datos de desarrollo:
//   · no se ejecuta con NODE_ENV=production;
//   · si hay datos de tiendas reales, se niega salvo que se pida expresamente.
//   npm run db:seed:dev
//   npm run db:seed:dev -- --force-delete-real-data
import { DEV_SEED_FORCE_FLAG, loadDevSeed, refreshPriceStats, schemaExists } from "@/data/db/admin";
import { buildSeed } from "@/data/seed/build";
import { runDbScript } from "./run";

runDbScript(async (sql) => {
  if (!(await schemaExists(sql))) {
    throw new Error("El esquema no existe todavía. Ejecuta antes: npm run db:migrate");
  }

  const now = new Date();
  const seed = buildSeed(now);
  await loadDevSeed(sql, seed, { force: process.argv.includes(DEV_SEED_FORCE_FLAG) });
  // Los agregados incluyen las tiendas demo solo si INCLUDE_DEMO_PRICES=true.
  const withPrice = await refreshPriceStats(sql, now);

  console.log(
    `Seed de desarrollo cargado: ${seed.brands.length} marcas, ${seed.rackets.length} palas, ${seed.stores.length} tiendas demo.`,
  );
  console.log(
    `Precios de demostración: ${seed.storePrices.length} ofertas y ${seed.priceHistory.length} registros de histórico.`,
  );
  console.log(`Agregados de precio calculados para ${withPrice} palas.`);
  if (withPrice === 0) {
    console.log("Las tiendas demo no cuentan como precio: para verlas, INCLUDE_DEMO_PRICES=true y npm run db:stats.");
  }
});
