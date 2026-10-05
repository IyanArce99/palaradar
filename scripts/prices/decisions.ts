// Aplica un fichero de decisiones manuales sobre el emparejamiento
// (ingestion/decisions/*.json). Sin `--apply` es un ensayo: lo ejecuta todo en
// una transacción, cuenta lo que haría y la deshace.
//   npm run prices:decisions -- --file=ingestion/decisions/2026-10-05-auditoria.json
//   npm run prices:decisions -- --file=… --apply
// Después de aplicarlo, `npm run prices:ingest` publica los precios de los
// productos recién emparejados.
import { readFileSync } from "node:fs";
import { applyDecisions, type DecisionFile, type DecisionReport } from "@/ingestion/decisions";
import type { Sql } from "@/data/db/client";
import { runDbScript } from "../db/run";

const prefix = "--file=";
const path = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
const apply = process.argv.includes("--apply");

if (!path) {
  console.error("Indica el fichero: --file=ingestion/decisions/<fichero>.json");
  process.exit(1);
}

const ROLLBACK = new Error("ensayo");

function print(report: DecisionReport): void {
  for (const line of report.log) console.log(`  · ${line}`);
  console.log(`Palas corregidas:            ${report.racketsFixed}`);
  console.log(`Productos emparejados:       ${report.matched}`);
  console.log(`Productos rechazados:        ${report.rejected}`);
  console.log(`Productos que siguen en revisión, con motivo: ${report.inReview}`);
  console.log(`Decisiones ya aplicadas:     ${report.unchanged}`);
  console.log(`EAN añadidos a palas:        ${report.gtinsAdded}`);
  console.log(`Identificadores movidos:     ${report.identifiersMoved} · quitados: ${report.identifiersRemoved}`);
  console.log(`Precios publicados movidos:  ${report.pricesMoved} · retirados: ${report.pricesRemoved}`);
  console.log(`Histórico movido:            ${report.historyMoved} · borrado: ${report.historyDeleted}`);
  if (report.duplicates.length > 0) {
    console.log("Palas con más de un producto de la misma tienda:");
    for (const line of report.duplicates) console.log(`  · ${line}`);
  }
}

runDbScript(async (sql) => {
  const file = JSON.parse(readFileSync(path, "utf8")) as DecisionFile;
  console.log(`${file.title} (${file.decidedAt}): ${file.products.length} decisiones${apply ? "" : " · ENSAYO, no se guarda nada"}`);

  if (apply) {
    print(await applyDecisions(sql, file));
    console.log("Aplicado. Ejecuta `npm run prices:ingest` para publicar los precios.");
    return;
  }

  try {
    await sql.begin(async (tx) => {
      print(await applyDecisions(tx as unknown as Sql, file));
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
  console.log("Ensayo terminado: no se ha guardado nada. Repite con --apply para aplicarlo.");
});
