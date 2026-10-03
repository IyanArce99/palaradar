import { inTransaction, type Sql } from "./client";

// Bloqueo global de escritura de precios. Lo toman la ingestión y la limpieza
// de datos demo: nunca hay dos a la vez, porque las dos recalculan los
// agregados de todas las palas.
//
// Es un advisory lock de PostgreSQL a nivel de transacción: vive mientras dure
// la transacción que lo toma y el servidor lo suelta solo al terminar esta, por
// éxito, por error o porque el proceso muera y se corte la conexión. No hay
// nada que limpiar a mano. Al ir ligado a una transacción funciona igual con el
// pooler de Supabase en modo sesión que en modo transacción.

const LOCK_NAME = "palaradar:price-ingestion";

export type Locked<T> = { acquired: true; value: T } | { acquired: false };

/** Intenta tomar el bloqueo dentro de la transacción `tx`, sin esperar. */
export async function tryPriceWriteLock(tx: Sql): Promise<boolean> {
  const [{ locked }] = await tx<{ locked: boolean }[]>`
    select pg_try_advisory_xact_lock(hashtext(${LOCK_NAME})) as locked`;
  return locked;
}

/**
 * Ejecuta `work` con el bloqueo tomado. Si lo tiene otro proceso, no espera ni
 * ejecuta nada: devuelve `{ acquired: false }`.
 *
 * El bloqueo ocupa una conexión propia, con una transacción que no escribe
 * nada, durante todo `work`; `work` usa las demás conexiones de `sql`.
 */
export async function withPriceWriteLock<T>(sql: Sql, work: () => Promise<T>): Promise<Locked<T>> {
  const isTransaction = typeof (sql as unknown as { savepoint?: unknown }).savepoint === "function";
  if (!isTransaction && sql.options.max < 2) {
    throw new Error(
      "La ingestión necesita al menos 2 conexiones (una para el bloqueo): revisa DATABASE_POOL_MAX.",
    );
  }

  return inTransaction<Locked<T>>(sql, async (lock) => {
    if (!(await tryPriceWriteLock(lock))) return { acquired: false };
    return { acquired: true, value: await work() };
  });
}
