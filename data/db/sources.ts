import { pricingConfig } from "@/config/pricing";
import type { Sql } from "./client";

/**
 * Condición SQL que decide qué tiendas cuentan como fuente de precios. Es el
 * único sitio donde se separan las tiendas reales de las de demostración: la
 * usan la ficha, el histórico y el cálculo de agregados.
 *
 * `storeAlias` es el alias de la tabla `stores` en la consulta.
 */
export function activeStores(
  sql: Sql,
  storeAlias: string,
  includeDemo: boolean = pricingConfig.includeDemoStores,
) {
  return includeDemo ? sql`true` : sql`not ${sql(storeAlias)}.is_demo`;
}
