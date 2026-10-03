// Limpia de una base de datos las tiendas de DEMOSTRACIÓN (stores.is_demo) y
// todo lo que cuelga de ellas. Sirve para dejar una base de producción solo con
// datos reales. No toca marcas, palas, EAN, opiniones ni tiendas reales.
//
// Sin argumentos NO borra nada: solo muestra qué borraría.
//   npm run db:purge-demo
//
// Para borrar hay que escribir el nombre de la base de datos conectada, tal
// como lo muestra la ejecución anterior:
//   npm run db:purge-demo -- --confirm-database=<nombre>
import {
  countStoreData,
  databaseLabel,
  PURGE_DEMO_CONFIRM_FLAG,
  purgeDemoBlocker,
  purgeDemoData,
  type StoreDataCounts,
} from "@/data/db/admin";
import { getDatabaseUrl } from "@/data/db/client";
import { runDbScript } from "./run";

function report(title: string, counts: StoreDataCounts): void {
  console.log(`\n${title}`);
  console.log(`  stores                ${counts.stores.length}  (${counts.stores.join(", ") || "ninguna"})`);
  console.log(`  store_prices          ${counts.storePrices}`);
  console.log(`  price_history         ${counts.priceHistory}`);
  console.log(`  store_products        ${counts.storeProducts}`);
  console.log(`  ingestion_runs        ${counts.ingestionRuns}`);
  console.log(`  racket_price_stats    ${counts.priceStats}  (agregados cuyo mejor precio es de esas tiendas)`);
}

runDbScript(async (sql) => {
  const target = databaseLabel(getDatabaseUrl() as string);
  const prefix = `${PURGE_DEMO_CONFIRM_FLAG}=`;
  const confirmation = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);

  console.log(`Base de datos: ${target}`);
  const demo = await countStoreData(sql, true);
  report("Datos de tiendas DEMO (lo que se borraría):", demo);
  report("Datos de tiendas REALES (no se tocan):", await countStoreData(sql, false));

  if (demo.stores.length === 0) {
    console.log("\nNo hay tiendas demo: nada que borrar.");
    return;
  }

  const blocker = purgeDemoBlocker(confirmation, target);
  if (blocker) {
    console.log(`\n${blocker}`);
    // Una confirmación equivocada es un error; no haberla dado, no.
    if (confirmation !== undefined) process.exitCode = 1;
    return;
  }

  const deleted = await purgeDemoData(sql, { confirmation, target });
  report("BORRADO:", deleted);
  report("Datos de tiendas reales después del borrado:", await countStoreData(sql, false));
});
