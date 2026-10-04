// Avisa a las alertas de precio que se cumplen con los precios actuales. La
// ingestión de precios lo hace sola al terminar; este script sirve para lanzarlo
// a mano o reintentar tras un fallo de envío.   npm run alerts:send
import { runDbScript } from "../db/run";
import { sendDueAlerts } from "./shared";

runDbScript(async (sql) => {
  await sendDueAlerts(sql);
});
