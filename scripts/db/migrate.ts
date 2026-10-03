// Aplica db/schema.sql a la base de datos de DATABASE_URL.
//   npm run db:migrate            crea el esquema; no hace nada si ya existe
//   npm run db:migrate -- --reset borra las tablas de PalaRadar y las vuelve a crear
import { applySchema, dropSchema, schemaExists } from "@/data/db/admin";
import { runDbScript } from "./run";

const reset = process.argv.includes("--reset");

runDbScript(async (sql) => {
  if (await schemaExists(sql)) {
    if (!reset) {
      console.log("El esquema ya existe; no se ha cambiado nada.");
      console.log("Para recrearlo (BORRA los datos de PalaRadar): npm run db:migrate -- --reset");
      return;
    }
    console.log("Borrando tablas, vistas y tipos de PalaRadar…");
    await dropSchema(sql);
  }

  await applySchema(sql);
  console.log("Esquema aplicado. Siguiente paso: npm run db:seed");
});
