// Recalcula racket_price_stats a partir de store_prices y price_history.
// Hay que ejecutarlo después de cambiar precios para que el catálogo
// (filtros y orden por precio, ofertas) refleje los nuevos valores.
//   npm run db:stats
import { refreshPriceStats } from "@/data/db/admin";
import { runDbScript } from "./run";

runDbScript(async (sql) => {
  const count = await refreshPriceStats(sql, new Date());
  console.log(`Agregados de precio recalculados para ${count} palas.`);
});
