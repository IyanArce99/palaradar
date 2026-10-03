// Carga la semilla en la base de datos de DATABASE_URL y recalcula los
// agregados de precio. SUSTITUYE el contenido de las tablas de PalaRadar.
//   npm run db:seed
import { loadSeed, refreshPriceStats, schemaExists } from "@/data/db/admin";
import { buildSeed } from "@/data/seed/build";
import { runDbScript } from "./run";

runDbScript(async (sql) => {
  if (!(await schemaExists(sql))) {
    throw new Error("El esquema no existe todavía. Ejecuta antes: npm run db:migrate");
  }

  const now = new Date();
  const seed = buildSeed(now);
  await loadSeed(sql, seed);
  const withPrice = await refreshPriceStats(sql, now);

  console.log(
    `Semilla cargada: ${seed.brands.length} marcas, ${seed.rackets.length} palas, ${seed.stores.length} tiendas.`,
  );
  console.log(
    `Precios de prueba: ${seed.storePrices.length} ofertas y ${seed.priceHistory.length} registros de histórico.`,
  );
  console.log(`Agregados de precio calculados para ${withPrice} palas.`);
});
