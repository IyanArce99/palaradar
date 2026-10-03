// Cola de revisión manual: productos de tienda con emparejamiento ambiguo
// (matching_status = 'pending_review'). Solo lectura.
//   npm run prices:pending
import { listPendingReview } from "@/ingestion/postgres-repository";
import { runDbScript } from "../db/run";
import { euros } from "./shared";

runDbScript(async (sql) => {
  const pending = await listPendingReview(sql);
  console.log(`Productos pendientes de revisión: ${pending.length}`);

  for (const product of pending) {
    console.log(`\n[${product.store}] ${product.title}`);
    console.log(`  id ${product.externalId} · EAN ${product.gtin ?? "—"} · ${euros(product.price)}`);
    console.log(`  ${product.url}`);
    console.log(`  → ${product.note ?? "sin nota"}`);
  }
});
