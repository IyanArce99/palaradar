// Ingestión real de precios en la base de datos de DATABASE_URL. Pensado para
// ejecutarse de forma programada (ver docs/price-ingestion.md):
//   · cada tienda escribe en una única transacción: si falla, no cambia ningún
//     precio y la ejecución queda registrada como fallida en ingestion_runs;
//   · nunca hay dos ingestiones a la vez (bloqueo en la base de datos).
//
//   npm run prices:ingest                          todas las tiendas, una tras otra
//   npm run prices:ingest -- --store=padelproshop  solo una
//
// Código de salida: 0 todo correcto · 1 alguna tienda ha fallado ·
// 3 no se ha ejecutado porque ya había otra ingestión en marcha.
import { getQueryCount } from "@/data/db/client";
import { getAdapter } from "@/ingestion/adapters";
import { createPostgresIngestionRepository } from "@/ingestion/postgres-repository";
import { IngestionLockedError, runIngestion, type RunTimings } from "@/ingestion/run";
import { sendDueAlerts } from "../alerts/shared";
import { runDbScript } from "../db/run";
import { storesFromArgs } from "./shared";

const EXIT_FAILED = 1;
const EXIT_LOCKED = 3;

const seconds = (ms: number | undefined) => `${((ms ?? 0) / 1000).toFixed(1)} s`;

// Los adaptadores se resuelven antes de conectar: una tienda mal escrita falla enseguida.
const adapters = storesFromArgs().map(getAdapter);

runDbScript(async (sql) => {
  const repository = createPostgresIngestionRepository(sql);
  const failed: string[] = [];

  for (const adapter of adapters) {
    console.log(`\nIngestión de ${adapter.store.name}…`);
    const timings: RunTimings = {};
    const queriesBefore = getQueryCount();
    const startedAt = performance.now();

    let summary;
    try {
      summary = await runIngestion(adapter, repository, new Date(), timings);
    } catch (error) {
      if (!(error instanceof IngestionLockedError)) throw error;
      console.error(error.message);
      process.exitCode = EXIT_LOCKED;
      return;
    }

    console.log(`Resultado:              ${summary.status}`);
    console.log(`Tiempo total:           ${seconds(performance.now() - startedAt)}`);
    console.log(`  descarga de la tienda: ${seconds(timings.fetchMs)}`);
    console.log(`  base de datos:         ${seconds(timings.applyMs)}`);
    console.log(`Consultas a la base:    ${getQueryCount() - queriesBefore}`);
    if (adapter.lastFetch) {
      const { announced, downloaded, duplicates, pages } = adapter.lastFetch;
      console.log(`Descarga:               ${downloaded} de ${announced} anunciados en ${pages} páginas · ${duplicates} duplicados`);
    }
    console.log(`Productos vistos:       ${summary.productsSeen}`);
    console.log(`Emparejados:            ${summary.productsMatched}`);
    console.log(`Pendientes de revisión: ${summary.productsPending}`);
    console.log(`Precios actualizados:   ${summary.pricesUpdated}`);
    console.log(`Bajadas retenidas:      ${summary.pricesHeld}`);
    console.log(`Descartados por datos:  ${summary.productsInvalid}`);

    if (summary.status === "failed") {
      // Una tienda que falla no impide actualizar las demás.
      console.error(`FALLO: no se ha cambiado ningún precio de ${adapter.store.name}: ${summary.errorMessage}`);
      failed.push(adapter.store.slug);
    }
  }

  // Con los precios al día, se avisa a las alertas que se cumplen. Un fallo aquí
  // no cambia el resultado de la ingestión.
  console.log("");
  await sendDueAlerts(sql);

  if (failed.length > 0) {
    console.error(`\nIngestión terminada con fallos en: ${failed.join(", ")}.`);
    process.exitCode = EXIT_FAILED;
  }
});
