// Ingestión real de precios de una tienda en la base de datos de DATABASE_URL.
// Todos los datos se escriben en una única transacción: si falla, no cambia
// ningún precio y la ejecución queda registrada como fallida.
//   npm run prices:ingest -- --store=padelproshop
import { getQueryCount } from "@/data/db/client";
import { getAdapter } from "@/ingestion/adapters";
import { createPostgresIngestionRepository } from "@/ingestion/postgres-repository";
import { runIngestion, type RunTimings } from "@/ingestion/run";
import { runDbScript } from "../db/run";
import { storeFromArgs } from "./shared";

const storeSlug = storeFromArgs();
const adapter = getAdapter(storeSlug);

runDbScript(async (sql) => {
  console.log(`Ingestión de ${adapter.store.name}…`);
  const timings: RunTimings = {};
  const queriesBefore = getQueryCount();
  const startedAt = performance.now();
  const summary = await runIngestion(adapter, createPostgresIngestionRepository(sql), new Date(), timings);
  const seconds = (ms: number | undefined) => `${((ms ?? 0) / 1000).toFixed(1)} s`;

  console.log(`Tiempo total:           ${seconds(performance.now() - startedAt)}`);
  console.log(`  descarga de la tienda: ${seconds(timings.fetchMs)}`);
  console.log(`  base de datos:         ${seconds(timings.applyMs)}`);
  console.log(`Consultas a la base:    ${getQueryCount() - queriesBefore}`);

  console.log(`Resultado:              ${summary.status}`);
  console.log(`Productos vistos:       ${summary.productsSeen}`);
  console.log(`Emparejados:            ${summary.productsMatched}`);
  console.log(`Pendientes de revisión: ${summary.productsPending}`);
  console.log(`Precios actualizados:   ${summary.pricesUpdated}`);
  console.log(`Bajadas retenidas:      ${summary.pricesHeld}`);
  console.log(`Descartados por datos:  ${summary.productsInvalid}`);

  if (summary.status === "failed") {
    throw new Error(`La ingestión ha fallado y no se ha cambiado ningún precio: ${summary.errorMessage}`);
  }
});
