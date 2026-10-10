// Decisiones manuales sobre el emparejamiento: lo que una persona ha revisado y
// fijado, en un fichero versionado (ingestion/decisions/*.json). Aplicarlas es
// repetible: una decisión ya aplicada no cambia nada, y una cuyo punto de partida
// ya no es el que se revisó detiene la carga sin escribir nada.
//
// Un `match` sin `from` sobre un producto ya emparejado con esa misma pala es una
// confirmación: solo actualiza la confianza y el motivo. Cambiar de pala sigue
// exigiendo `from`, que es lo que retira el precio y decide qué pasa con el histórico.
//
// Todo queda con `matching_method = 'manual'`, que la ingestión respeta y no
// recalcula (ver resolveMatch en run.ts).
import { refreshPriceStats } from "@/data/db/admin";
import { inTransaction, type Sql } from "@/data/db/client";
import { tryPriceWriteLock } from "@/data/db/lock";
import { normalizeGtin } from "./gtin";

/** Corrección de una pala del catálogo: modelo, año o dirección mal cargados. */
export interface RacketFix {
  slug: string;
  set: { slug?: string; model?: string; year?: number };
  reason: string;
}

/** Un identificador que estaba en la pala equivocada. `racket: null` lo quita. */
export interface IdentifierFix {
  type: "gtin" | "manufacturer_ref";
  value: string;
  racket: string | null;
  reason: string;
}

export interface ProductDecision {
  store: string;
  externalId: string;
  /** Título del producto cuando se revisó; solo sirve para leer el fichero */
  title: string;
  /** match: es esta pala · reject: no es una pala comparable · review: sigue en revisión, con el motivo fijado */
  decision: "match" | "reject" | "review";
  /** Pala (slug) de un `match` */
  racket?: string;
  confidence?: "high" | "medium";
  reason: string;
  /** Solo al corregir un enlace que ya existía: la pala (slug) a la que estaba enlazado */
  from?: string;
  /** Qué hacer con el histórico que el producto dejó en esa pala: llevárselo a la nueva o borrarlo */
  history?: "move" | "delete";
}

export interface DecisionFile {
  title: string;
  decidedAt: string;
  rackets?: RacketFix[];
  identifiers?: IdentifierFix[];
  products: ProductDecision[];
}

export interface DecisionReport {
  racketsFixed: number;
  matched: number;
  rejected: number;
  inReview: number;
  /** Enlaces que ya existían con esa misma pala y solo cambian de confianza o de motivo */
  confirmed: number;
  /** Decisiones que ya estaban aplicadas */
  unchanged: number;
  gtinsAdded: number;
  identifiersMoved: number;
  identifiersRemoved: number;
  /** Precios publicados que cambian de pala o se retiran al corregir un enlace */
  pricesMoved: number;
  pricesRemoved: number;
  historyMoved: number;
  historyDeleted: number;
  /** Palas que quedan con más de un producto de la misma tienda enlazado */
  duplicates: string[];
  /** Qué se ha hecho, en frases */
  log: string[];
}

function validateProduct(product: ProductDecision): void {
  const key = `${product.store}/${product.externalId}`;
  if (!product.reason?.trim()) throw new Error(`La decisión de ${key} no explica el motivo.`);
  if (product.decision === "match" && (!product.racket || !product.confidence)) {
    throw new Error(`El emparejamiento de ${key} no indica la pala o la confianza.`);
  }
  if (product.decision !== "match" && (product.racket || product.confidence)) {
    throw new Error(`${key} no es un emparejamiento: no puede llevar pala ni confianza.`);
  }
  if (product.history && !product.from) {
    throw new Error(`${key} indica qué hacer con el histórico, pero no de qué pala viene.`);
  }
  if (product.history === "move" && product.decision !== "match") {
    throw new Error(`${key}: el histórico solo puede moverse a otra pala.`);
  }
}

/** Lanza si `keys` repite alguna clave. */
function assertUnique(keys: string[], what: string): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) throw new Error(`${what} ${key} aparece dos veces.`);
    seen.add(key);
  }
}

/** Comprueba el fichero antes de tocar la base de datos. */
export function validateDecisions(file: DecisionFile): void {
  assertUnique(file.products.map((product) => `${product.store}/${product.externalId}`), "El producto");
  file.products.forEach(validateProduct);
  assertUnique((file.identifiers ?? []).map((identifier) => `${identifier.type}/${identifier.value}`), "El identificador");
  assertUnique((file.rackets ?? []).map((racket) => racket.slug), "La pala");
  for (const racket of file.rackets ?? []) {
    if (Object.keys(racket.set).length === 0) throw new Error(`La corrección de ${racket.slug} no cambia nada.`);
  }
}

interface ProductRow {
  id: string;
  racket_id: string | null;
  url: string;
  gtin: string | null;
  price: number | null;
  matching_status: "matched" | "pending_review" | "rejected";
  matching_method: "gtin" | "attributes" | "manual" | null;
  matching_confidence: string | null;
  matching_note: string | null;
}

const STATUS = { match: "matched", reject: "rejected", review: "pending_review" } as const;

/** Lo que comparten los pasos de una aplicación. */
interface Context {
  tx: Sql;
  now: string;
  report: DecisionReport;
  /** Id de una pala por su slug; lanza si no existe */
  racketId: (slug: string) => string;
  /** Palas cuyos enlaces han cambiado */
  touched: Set<string>;
}

/** Un producto con su decisión ya resuelta contra la base de datos. */
interface Resolved {
  decision: ProductDecision;
  key: string;
  storeId: string;
  product: ProductRow;
  /** Pala nueva, o null si queda sin enlazar */
  toId: string | null;
  /** Pala de la que sale, al corregir un enlace */
  fromId: string | null;
  gtin: string | null;
}

async function fixRackets({ tx, report }: Pick<Context, "tx" | "report">, fixes: RacketFix[]): Promise<void> {
  const bySlug = async (slug: string) =>
    (await tx<{ id: string; slug: string; model: string; year: number }[]>`
      select id, slug, model, year from rackets where slug = ${slug}`)[0];

  for (const fix of fixes) {
    const target = fix.set.slug ?? fix.slug;
    const current = await bySlug(fix.slug);
    const taken = target === fix.slug ? undefined : await bySlug(target);
    // Sin la dirección antigua y con la nueva ya ocupada: la corrección ya está hecha.
    if (!current && taken) continue;
    if (!current) throw new Error(`No existe la pala ${fix.slug}.`);
    if (taken) throw new Error(`Ya existe otra pala con la dirección ${target}.`);

    const next = { slug: target, model: fix.set.model ?? current.model, year: fix.set.year ?? current.year };
    if (next.slug === current.slug && next.model === current.model && next.year === current.year) continue;
    await tx`update rackets set slug = ${next.slug}, model = ${next.model}, year = ${next.year} where id = ${current.id}`;
    report.racketsFixed++;
    report.log.push(`Pala ${current.slug} («${current.model}», ${current.year}) → ${next.slug} («${next.model}», ${next.year})`);
  }
}

/** El EAN del producto emparejado pasa a ser un identificador de su pala. */
async function saveGtin({ tx, now, report }: Context, item: Resolved): Promise<void> {
  const { gtin, toId, fromId, key, decision } = item;
  if (!toId || !gtin) return;

  const [owner] = await tx<{ racket_id: string }[]>`
    select racket_id from racket_identifiers where type = 'gtin' and value = ${gtin}`;
  if (owner?.racket_id === toId) return;
  if (owner && owner.racket_id === fromId) {
    // Se guardó en la pala equivocada junto con el enlace: se va con el producto.
    await tx`update racket_identifiers set racket_id = ${toId} where type = 'gtin' and value = ${gtin}`;
    report.identifiersMoved++;
    report.log.push(`EAN ${gtin} de ${key}: de ${decision.from} a ${decision.racket}`);
    return;
  }
  if (owner) throw new Error(`El EAN ${gtin} de ${key} ya pertenece a otra pala.`);

  const others = await tx<{ value: string }[]>`
    select value from racket_identifiers where type = 'gtin' and racket_id = ${toId}`;
  if (others.length > 0) {
    throw new Error(`${decision.racket} ya tiene otro EAN (${others.map((row) => row.value).join(", ")}): ${key} sería otro color u otra edición.`);
  }
  await tx`
    insert into racket_identifiers (racket_id, type, value, source, verified_at)
    values (${toId}, 'gtin', ${gtin}, ${decision.store}, ${now})`;
  report.gtinsAdded++;
}

/** Al corregir un enlace: el precio que el producto tenía publicado en la pala anterior. */
async function relocatePrice({ tx, report }: Context, item: Resolved): Promise<void> {
  const { fromId, toId, storeId, product, key, decision } = item;
  const [published] = await tx<{ current_price: number }[]>`
    select current_price from store_prices
    where racket_id = ${fromId} and store_id = ${storeId} and product_url = ${product.url}`;
  if (!published) return;

  const [taken] = toId
    ? await tx<{ racket_id: string }[]>`select racket_id from store_prices where racket_id = ${toId} and store_id = ${storeId}`
    : [];
  if (toId && !taken) {
    await tx`update store_prices set racket_id = ${toId} where racket_id = ${fromId} and store_id = ${storeId}`;
    report.pricesMoved++;
    report.log.push(`Precio publicado de ${key} (${published.current_price} €): de ${decision.from} a ${decision.racket}`);
  } else {
    await tx`delete from store_prices where racket_id = ${fromId} and store_id = ${storeId}`;
    report.pricesRemoved++;
    report.log.push(`Precio publicado de ${key} (${published.current_price} €): retirado de ${decision.from}`);
  }
}

/**
 * Al corregir un enlace: del histórico de la pala anterior en esa tienda, las
 * filas con el precio de este producto. Las demás no se tocan.
 */
async function relocateHistory({ tx, report }: Context, item: Resolved): Promise<void> {
  const { fromId, toId, storeId, product, key, decision } = item;
  if (!decision.history || product.price === null) return;

  const rows = await tx<{ price_date: string; price: number }[]>`
    select price_date, price from price_history
    where racket_id = ${fromId} and store_id = ${storeId} and price = ${product.price} order by price_date`;
  for (const row of rows) {
    const [exists] = decision.history === "move"
      ? await tx<{ racket_id: string }[]>`
          select racket_id from price_history
          where racket_id = ${toId} and store_id = ${storeId} and price_date = ${row.price_date}`
      : [];
    if (decision.history === "move" && !exists) {
      await tx`
        update price_history set racket_id = ${toId}
        where racket_id = ${fromId} and store_id = ${storeId} and price_date = ${row.price_date}`;
      report.historyMoved++;
      report.log.push(`Histórico de ${key} (${row.price_date}, ${row.price} €): de ${decision.from} a ${decision.racket}`);
    } else {
      await tx`delete from price_history where racket_id = ${fromId} and store_id = ${storeId} and price_date = ${row.price_date}`;
      report.historyDeleted++;
      report.log.push(`Histórico de ${key} (${row.price_date}, ${row.price} €): borrado de ${decision.from}`);
    }
  }
}

/** Corrección de un enlace: lo que el producto dejó en la pala anterior no era suyo. */
async function undoPreviousLink(context: Context, item: Resolved): Promise<void> {
  const { tx, report } = context;
  const { fromId, toId, gtin, key, decision } = item;
  if (!fromId) return;

  if (!toId && gtin) {
    // Sin pala nueva, el EAN que este producto dejó en la anterior sobra.
    const removed = await tx`
      delete from racket_identifiers where type = 'gtin' and value = ${gtin} and racket_id = ${fromId} returning value`;
    if (removed.length > 0) {
      report.identifiersRemoved++;
      report.log.push(`EAN ${gtin} de ${key}: quitado de ${decision.from}`);
    }
  }
  await relocatePrice(context, item);
  await relocateHistory(context, item);
  context.touched.add(fromId);
  const destination = decision.racket ?? (decision.decision === "reject" ? "rechazado" : "revisión");
  report.log.push(`${key} «${decision.title}»: de ${decision.from} a ${destination}`);
}

async function applyProduct(context: Context, decision: ProductDecision, storeId: string): Promise<void> {
  const { tx, report, racketId } = context;
  const key = `${decision.store}/${decision.externalId}`;
  const [product] = await tx<ProductRow[]>`
    select id, racket_id, url, gtin, price, matching_status, matching_method, matching_confidence, matching_note
    from store_products where store_id = ${storeId} and external_id = ${decision.externalId}`;
  if (!product) throw new Error(`No existe el producto ${key} («${decision.title}»).`);

  const status = STATUS[decision.decision];
  const toId = decision.decision === "match" ? racketId(decision.racket as string) : null;
  const confidence = decision.decision === "match" ? (decision.confidence as string) : null;
  const applied =
    product.matching_status === status &&
    product.racket_id === toId &&
    product.matching_method === "manual" &&
    product.matching_confidence === confidence &&
    product.matching_note === decision.reason;
  if (applied) {
    report.unchanged++;
    return;
  }

  // Confirmación: el producto ya está emparejado con esa misma pala y la decisión
  // no corrige ningún enlace. Solo cambian la confianza y el motivo (y queda como
  // decisión manual): ni la pala, ni el precio publicado, ni el histórico, ni los
  // identificadores se tocan.
  if (decision.decision === "match" && !decision.from && product.matching_status === "matched" && product.racket_id === toId) {
    await tx`
      update store_products set matching_method = 'manual', matching_confidence = ${confidence}, matching_note = ${decision.reason}
      where id = ${product.id}`;
    report.confirmed++;
    report.log.push(
      `${key} «${decision.title}»: sigue en ${decision.racket}; confianza ${product.matching_confidence ?? "sin indicar"} → ${confidence}` +
        (product.matching_method === "manual" ? "" : `, método ${product.matching_method ?? "sin indicar"} → manual`),
    );
    return;
  }

  // El punto de partida tiene que ser el que se revisó.
  const fromId = decision.from ? racketId(decision.from) : null;
  if (fromId && product.racket_id !== fromId) {
    throw new Error(`${key} ya no está enlazado a ${decision.from}: revisa la decisión.`);
  }
  if (!fromId && (product.matching_status !== "pending_review" || product.matching_method === "manual")) {
    throw new Error(`${key} ya no está en revisión (${product.matching_status}): revisa la decisión.`);
  }

  await tx`
    update store_products set
      racket_id = ${toId}, matching_status = ${status}::matching_status,
      matching_method = 'manual', matching_confidence = ${confidence}, matching_note = ${decision.reason}
    where id = ${product.id}`;
  if (toId) context.touched.add(toId);
  if (decision.decision === "match") report.matched++;
  else if (decision.decision === "reject") report.rejected++;
  else report.inReview++;

  const item: Resolved = { decision, key, storeId, product, toId, fromId, gtin: normalizeGtin(product.gtin) };
  await saveGtin(context, item);
  await undoPreviousLink(context, item);
}

async function fixIdentifiers({ tx, now, report, racketId }: Context, fixes: IdentifierFix[]): Promise<void> {
  for (const fix of fixes) {
    const value = fix.type === "gtin" ? normalizeGtin(fix.value) : fix.value;
    if (!value) throw new Error(`El identificador ${fix.value} no es un EAN válido.`);
    const [current] = await tx<{ racket_id: string }[]>`
      select racket_id from racket_identifiers where type = ${fix.type}::identifier_type and value = ${value}`;

    if (fix.racket === null) {
      if (!current) continue;
      await tx`delete from racket_identifiers where type = ${fix.type}::identifier_type and value = ${value}`;
      report.identifiersRemoved++;
      report.log.push(`Identificador ${fix.type} ${value}: quitado`);
      continue;
    }

    const id = racketId(fix.racket);
    if (current?.racket_id === id) continue;
    if (current) {
      await tx`update racket_identifiers set racket_id = ${id} where type = ${fix.type}::identifier_type and value = ${value}`;
    } else {
      await tx`
        insert into racket_identifiers (racket_id, type, value, source, verified_at)
        values (${id}, ${fix.type}::identifier_type, ${value}, ${"decisión manual"}, ${now})`;
    }
    report.identifiersMoved++;
    report.log.push(`Identificador ${fix.type} ${value}: ahora en ${fix.racket}`);
  }
}

/** Palas que, de las tocadas, quedan con más de un producto de la misma tienda enlazado. */
async function findDuplicates(tx: Sql, racketIds: Set<string>): Promise<string[]> {
  if (racketIds.size === 0) return [];
  const rows = await tx<{ slug: string; store: string; products: string }[]>`
    select r.slug, s.slug as store, string_agg(p.external_id, ', ' order by p.external_id) as products
    from store_products p join rackets r on r.id = p.racket_id join stores s on s.id = p.store_id
    where p.matching_status = 'matched' and p.racket_id in ${tx([...racketIds])}
    group by r.slug, s.slug having count(*) > 1`;
  return rows.map((row) => `${row.slug} en ${row.store}: ${row.products}`);
}

/**
 * Aplica un fichero de decisiones en una única transacción. Si `sql` ya es una
 * transacción abierta, queda dentro de ella (así se puede ensayar y deshacer).
 */
export async function applyDecisions(sql: Sql, file: DecisionFile, now: Date = new Date()): Promise<DecisionReport> {
  validateDecisions(file);

  return inTransaction(sql, async (tx) => {
    // Cambia emparejamientos y precios publicados: no debe coincidir con una ingestión.
    if (!(await tryPriceWriteLock(tx))) {
      throw new Error("Hay una ingestión de precios en marcha. Repite la carga cuando termine.");
    }

    const report: DecisionReport = {
      racketsFixed: 0, matched: 0, rejected: 0, inReview: 0, confirmed: 0, unchanged: 0, gtinsAdded: 0,
      identifiersMoved: 0, identifiersRemoved: 0, pricesMoved: 0, pricesRemoved: 0,
      historyMoved: 0, historyDeleted: 0, duplicates: [], log: [],
    };

    // Primero el catálogo: las decisiones de producto usan ya las direcciones corregidas.
    await fixRackets({ tx, report }, file.rackets ?? []);

    const racketIds = new Map(
      (await tx<{ id: string; slug: string }[]>`select id, slug from rackets`).map((racket) => [racket.slug, racket.id]),
    );
    const stores = new Map(
      (await tx<{ id: string; slug: string }[]>`select id, slug from stores`).map((store) => [store.slug, store.id]),
    );
    const context: Context = {
      tx,
      now: now.toISOString(),
      report,
      touched: new Set(),
      racketId: (slug) => {
        const id = racketIds.get(slug);
        if (!id) throw new Error(`No existe la pala ${slug}.`);
        return id;
      },
    };

    // En el orden del fichero: una corrección puede liberar la pala que recibe el siguiente producto.
    for (const decision of file.products) {
      const storeId = stores.get(decision.store);
      if (!storeId) throw new Error(`No existe la tienda ${decision.store}.`);
      await applyProduct(context, decision, storeId);
    }
    await fixIdentifiers(context, file.identifiers ?? []);

    report.duplicates = await findDuplicates(tx, context.touched);
    // Los agregados de precio se recalculan con los enlaces ya corregidos. Si
    // ningún enlace ni identificador ha cambiado (solo confirmaciones o decisiones
    // ya aplicadas), no hay nada que recalcular y no se toca ningún dato de precio.
    const linksChanged =
      report.racketsFixed + report.matched + report.rejected + report.inReview +
      report.gtinsAdded + report.identifiersMoved + report.identifiersRemoved > 0;
    if (linksChanged) await refreshPriceStats(tx, now);
    return report;
  });
}
