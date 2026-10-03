import { availableStores } from "@/ingestion/adapters";

/** Lee `--store=<slug>` de la línea de órdenes. */
export function storeFromArgs(defaultStore?: string): string {
  const arg = process.argv.find((value) => value.startsWith("--store="));
  const store = arg?.slice("--store=".length) ?? defaultStore;

  if (!store) {
    console.error(`Indica la tienda: --store=<slug>. Disponibles: ${availableStores.join(", ")}.`);
    process.exit(1);
  }
  return store;
}

export function euros(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2).replace(".", ",")} €`;
}
