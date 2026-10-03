import { getDatabaseUrl, getSql, type Sql } from "@/data/db/client";

/** Ejecuta una tarea de base de datos con una conexión que se cierra al terminar. */
export function runDbScript(task: (sql: Sql) => Promise<void>): void {
  if (!getDatabaseUrl()) {
    console.error("DATABASE_URL no está configurada. Revisa .env.local (ver .env.example).");
    process.exit(1);
  }

  const sql = getSql();
  task(sql)
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => sql.end());
}
