import postgres from "postgres";

// Conexión a PostgreSQL. Es el único módulo, junto con el repositorio y los
// scripts de db/, que conoce la base de datos: nada de la interfaz lo importa.

const PLACEHOLDERS = ["[YOUR-PASSWORD]", "<password>"];

/** URL de conexión, o null si no está configurada (o sigue con el marcador de contraseña). */
export function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || PLACEHOLDERS.some((placeholder) => url.includes(placeholder))) return null;
  return url;
}

function isLocalHost(url: string): boolean {
  return /@(localhost|127\.0\.0\.1)[:/]/.test(url);
}

export function createSql(url: string, max: number) {
  return postgres(url, {
    max,
    // Compatible con el pooler de Supabase también en modo transacción.
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: isLocalHost(url) ? false : "require",
    onnotice: () => {},
    // Los tipos de fila (types/db.ts) esperan números y fechas ISO, no los
    // valores por defecto del driver (numeric como texto, fechas como Date).
    types: {
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (value: number) => String(value),
        parse: (value: string) => Number(value),
      },
      date: {
        to: 1082,
        from: [1082],
        serialize: (value: string) => value,
        parse: (value: string) => value,
      },
      timestamptz: {
        to: 1184,
        from: [1184],
        serialize: (value: string) => value,
        parse: (value: string) => new Date(value).toISOString(),
      },
    },
  });
}

export type Sql = ReturnType<typeof createSql>;

/**
 * Ejecuta `work` de forma atómica: en una transacción nueva o, si `sql` ya es
 * una transacción abierta, en un savepoint. Si `work` falla, no queda nada escrito.
 */
export async function inTransaction<T>(sql: Sql, work: (tx: Sql) => Promise<T>): Promise<T> {
  const open = sql as unknown as {
    savepoint?: (fn: (tx: unknown) => Promise<T>) => Promise<T>;
  };
  if (typeof open.savepoint === "function") {
    return open.savepoint((tx) => work(tx as Sql));
  }
  return sql.begin((tx) => work(tx as unknown as Sql)) as Promise<T>;
}

const globalForSql = globalThis as unknown as { palaradarSql?: Sql };

/** Conexión compartida por proceso (sobrevive a la recarga en caliente en desarrollo). */
export function getSql(): Sql {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL no está configurada. Revisa .env.local (ver .env.example).");
  }

  const max = Number(process.env.DATABASE_POOL_MAX) || 2;
  globalForSql.palaradarSql ??= createSql(url, max);
  return globalForSql.palaradarSql;
}
