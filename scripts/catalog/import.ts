// Carga un catálogo enriquecido en la base de datos de DATABASE_URL. Es
// repetible y no borra palas, precios ni histórico. Después conviene ejecutar
// `npm run prices:ingest` para publicar los precios de las palas nuevas.
//   npm run catalog:import                         usa var/catalog/dataset.json
//   npm run catalog:import -- --file=otra/ruta.json
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadCatalog } from "@/catalog/load";
import type { CatalogImport } from "@/catalog/types";
import { refreshPriceStats } from "@/data/db/admin";
import { runDbScript } from "../db/run";

const prefix = "--file=";
const file =
  process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ??
  join(process.cwd(), "var", "catalog", "dataset.json");

runDbScript(async (sql) => {
  const data = JSON.parse(readFileSync(file, "utf8")) as CatalogImport;
  console.log(`Cargando ${data.rackets.length} palas de ${file}…`);

  const startedAt = performance.now();
  const summary = await loadCatalog(sql, data);
  await refreshPriceStats(sql, new Date());

  console.log(`Palas en el fichero:        ${summary.rackets}`);
  console.log(`  nuevas:                   ${summary.created}`);
  console.log(`  ya existentes ampliadas:  ${summary.enrichedExisting}`);
  console.log(`  no disponibles en la web: ${summary.unavailable}`);
  console.log(`Marcas nuevas:              ${summary.brandsCreated}`);
  console.log(`Datos con fuente:           ${summary.facts}`);
  console.log(`Identificadores nuevos:     ${summary.identifiers} (${summary.identifiersSkipped} ya eran de otra pala)`);
  console.log(`Textos de fuentes:          ${summary.content}`);
  console.log(`Imágenes de referencia:     ${summary.media}`);
  console.log(`Direcciones heredadas:      ${summary.legacyUrls}`);
  console.log(`Productos de tienda fijados: ${summary.storeLinks} (${summary.storeLinksMissing} no encontrados)`);
  console.log(`Tiempo:                     ${((performance.now() - startedAt) / 1000).toFixed(1)} s`);
});
