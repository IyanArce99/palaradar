// Aplica las migraciones pendientes (db/schema.sql y db/migrations/*.sql) a la
// base de datos de DATABASE_URL.
//   npm run db:migrate            aplica solo lo que falte; no borra nada
//   npm run db:migrate -- --reset borra las tablas de PalaRadar y las vuelve a crear
import { dropSchema, migrate } from "@/data/db/admin";
import { runDbScript } from "./run";

const reset = process.argv.includes("--reset");

runDbScript(async (sql) => {
  if (reset) {
    console.log("Borrando tablas, vistas y tipos de PalaRadar…");
    await dropSchema(sql);
  }

  const applied = await migrate(sql);
  console.log(
    applied.length > 0
      ? `Migraciones aplicadas: ${applied.join(", ")}.`
      : "La base de datos ya está al día; no se ha cambiado nada.",
  );
});
