// El workflow programado valida la tienda contra una lista escrita a mano: tiene
// que ser la de los adaptadores registrados, o una tienda nueva no podría lanzarse.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { availableStores } from "@/ingestion/adapters";

const workflow = readFileSync(join(process.cwd(), ".github", "workflows", "price-ingestion.yml"), "utf8");

describe("workflow de ingestión programada", () => {
  it("acepta exactamente las tiendas que tienen adaptador", () => {
    const declared = /^\s*TIENDAS_VALIDAS:\s*"([^"]*)"/m.exec(workflow)?.[1];
    assert.ok(declared, "el workflow debe declarar TIENDAS_VALIDAS");
    assert.deepEqual(declared.split(" ").sort(), [...availableStores].sort());
  });
});
