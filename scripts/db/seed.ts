// Carga el CATÁLOGO de la semilla (marcas, palas, alternativas y EAN) en la
// base de datos de DATABASE_URL. No borra nada ni toca tiendas, precios,
// histórico ni emparejamientos: se puede ejecutar sobre datos reales.
//   npm run db:seed
import { refreshPriceStats, schemaExists, upsertCatalog } from "@/data/db/admin";
import { buildSeed } from "@/data/seed/build";
import { runDbScript } from "./run";

runDbScript(async (sql) => {
  if (!(await schemaExists(sql))) {
    throw new Error("El esquema no existe todavía. Ejecuta antes: npm run db:migrate");
  }

  const now = new Date();
  const seed = buildSeed(now);
  await upsertCatalog(sql, seed);
  const withPrice = await refreshPriceStats(sql, now);

  console.log(
    `Catálogo actualizado: ${seed.brands.length} marcas, ${seed.rackets.length} palas, ${seed.racketIdentifiers.length} EAN.`,
  );
  console.log("No se han tocado tiendas, precios, histórico ni emparejamientos.");
  console.log(`Agregados de precio calculados para ${withPrice} palas.`);
});
