// Operaciones de administración de la base de datos: aplicar el esquema, cargar
// la semilla y recalcular los agregados de precio. Las usan los scripts de
// scripts/db/; la web no las llama.
//
// Hay tres clases de datos y cada una tiene su camino:
//   · catálogo (marcas, palas, EAN)  → upsertCatalog, no borra nada
//   · demostración (tiendas demo)    → loadDevSeed, destructivo y protegido
//   · reales (tiendas, precios…)     → solo los escribe la ingestión
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pricingConfig } from "@/config/pricing";
import { computePriceStats } from "@/lib/pricing";
import type { PricePoint, StoreOffer } from "@/types/catalog";
import type { RacketPriceStatsRow, RacketRow, StorePriceRow } from "@/types/db";
import { toPriceStatsRow, toStoreOffer } from "../mappers";
import type { SeedTables } from "../seed/build";
import { inTransaction, type Sql } from "./client";
import { tryPriceWriteLock } from "./lock";
import { activeStores } from "./sources";

const DB_DIR = join(process.cwd(), "db");
const MIGRATIONS_DIR = join(DB_DIR, "migrations");
const BASE_MIGRATION = "001_schema";
const INSERT_CHUNK = 1000;

// En orden de borrado seguro (primero las que dependen de otras).
const TABLES = [
  "legacy_urls",
  "racket_media",
  "racket_source_content",
  "racket_facts",
  "data_sources",
  "ingestion_runs",
  "store_products",
  "racket_identifiers",
  "racket_price_stats",
  "price_history",
  "store_prices",
  "reviews",
  "racket_alternatives",
  "rackets",
  "stores",
  "brands",
];
const VIEWS = ["racket_catalog", "racket_price_daily", "racket_fact_conflicts"];
const TYPES = [
  "pala_shape",
  "pala_balance",
  "player_level",
  "play_style",
  "price_status",
  "editorial_status",
  "identifier_type",
  "matching_status",
  "matching_method",
  "listing_status",
  "ingestion_status",
];

export async function schemaExists(sql: Sql): Promise<boolean> {
  const [{ exists }] = await sql<{ exists: boolean }[]>`
    select to_regclass('public.rackets') is not null as exists`;
  return exists;
}

interface Migration {
  name: string;
  file: string;
}

/** db/schema.sql es la migración base; después, db/migrations/*.sql en orden de nombre. */
async function listMigrations(): Promise<Migration[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
  return [
    { name: BASE_MIGRATION, file: join(DB_DIR, "schema.sql") },
    ...files.map((file) => ({ name: file.replace(/\.sql$/, ""), file: join(MIGRATIONS_DIR, file) })),
  ];
}

/**
 * Aplica las migraciones pendientes, cada una en su transacción, y devuelve sus
 * nombres. No borra nada: lo ya aplicado se salta.
 */
export async function migrate(sql: Sql): Promise<string[]> {
  await sql`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`;
  await sql`alter table schema_migrations enable row level security`;

  // Bases creadas antes de llevar registro: el esquema base ya está aplicado.
  if (await schemaExists(sql)) {
    await sql`insert into schema_migrations (name) values (${BASE_MIGRATION}) on conflict do nothing`;
  }

  const done = new Set(
    (await sql<{ name: string }[]>`select name from schema_migrations`).map((row) => row.name),
  );
  const applied: string[] = [];

  for (const migration of await listMigrations()) {
    if (done.has(migration.name)) continue;

    const statements = await readFile(migration.file, "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(statements);
      await tx`insert into schema_migrations (name) values (${migration.name})`;
    });
    applied.push(migration.name);
  }

  return applied;
}

/** Borra SOLO los objetos de PalaRadar (tablas, vistas y tipos de este esquema). */
export async function dropSchema(sql: Sql): Promise<void> {
  for (const view of VIEWS) await sql.unsafe(`drop view if exists ${view} cascade`);
  for (const table of TABLES) await sql.unsafe(`drop table if exists ${table} cascade`);
  for (const type of TYPES) await sql.unsafe(`drop type if exists ${type} cascade`);
  await sql.unsafe("drop table if exists schema_migrations");
}

/** Literal de array de PostgreSQL: {"a","b"}. Evita depender de la inferencia de tipos del driver. */
function pgArray(values: readonly string[]): string {
  const quoted = values.map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  return `{${quoted.join(",")}}`;
}

function chunks<T>(rows: T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) result.push(rows.slice(i, i + INSERT_CHUNK));
  return result;
}

async function insertRacket(sql: Sql, r: RacketRow, onConflict = sql``): Promise<void> {
  // El driver serializa los jsonb: se le pasa el valor, no un texto ya convertido a JSON.
  const json = (value: object) => sql.json(value as Parameters<Sql["json"]>[0]);

  await sql`
    insert into rackets (
      id, slug, brand_id, model, year, images, shape, balance, play_style, levels,
      weight_min, weight_max, description, editorial_summary, editorial_status,
      pros, cons, ideal_for, not_for, feel, feel_summary, editorial_updated_at,
      rating, review_count, review_aspects, review_highlights, technical_specs, faq,
      specs_source_url
    ) values (
      ${r.id}, ${r.slug}, ${r.brand_id}, ${r.model}, ${r.year}, ${pgArray(r.images)}::text[],
      ${r.shape}::pala_shape, ${r.balance}::pala_balance, ${r.play_style}::play_style,
      ${pgArray(r.levels)}::player_level[],
      ${r.weight_min}, ${r.weight_max}, ${r.description}, ${r.editorial_summary},
      ${r.editorial_status}::editorial_status,
      ${pgArray(r.pros)}::text[], ${pgArray(r.cons)}::text[],
      ${pgArray(r.ideal_for)}::text[], ${pgArray(r.not_for)}::text[],
      ${json(r.feel)}, ${r.feel_summary}, ${r.editorial_updated_at},
      ${r.rating}, ${r.review_count}, ${json(r.review_aspects)},
      ${pgArray(r.review_highlights)}::text[], ${json(r.technical_specs)},
      ${json(r.faq)}, ${r.specs_source_url}
    ) ${onConflict}`;
}

/**
 * Catálogo de la semilla (marcas, palas, alternativas e identificadores), SIN
 * borrar nada: crea lo que falta y actualiza lo que ya existe. No toca tiendas,
 * precios, histórico, productos de tienda, ejecuciones ni opiniones.
 *
 * De una pala existente se actualizan sus datos de catálogo; el texto editorial
 * solo mientras siga en borrador, y nunca la valoración ni las opiniones.
 */
export async function upsertCatalog(sql: Sql, seed: SeedTables): Promise<void> {
  await inTransaction(sql, async (tx) => {
    await tx`
      insert into brands ${tx(seed.brands)}
      on conflict (slug) do update set name = excluded.name, description = excluded.description`;

    for (const racket of seed.rackets) {
      await insertRacket(
        tx,
        racket,
        tx`
          on conflict (slug) do update set
            brand_id = excluded.brand_id,
            model = excluded.model,
            year = excluded.year,
            images = excluded.images,
            shape = excluded.shape,
            balance = excluded.balance,
            play_style = excluded.play_style,
            levels = excluded.levels,
            weight_min = excluded.weight_min,
            weight_max = excluded.weight_max,
            technical_specs = excluded.technical_specs,
            specs_source_url = excluded.specs_source_url,
            description = case when rackets.editorial_status = 'draft' then excluded.description else rackets.description end,
            editorial_summary = case when rackets.editorial_status = 'draft' then excluded.editorial_summary else rackets.editorial_summary end,
            ideal_for = case when rackets.editorial_status = 'draft' then excluded.ideal_for else rackets.ideal_for end`,
      );
    }

    // Las alternativas se derivan del catálogo: se recalculan para las palas de la semilla.
    const racketIds = seed.rackets.map((racket) => racket.id);
    if (racketIds.length > 0) {
      await tx`delete from racket_alternatives where racket_id in ${tx(racketIds)}`;
    }
    if (seed.racketAlternatives.length > 0) {
      await tx`insert into racket_alternatives ${tx(seed.racketAlternatives)}`;
    }
    // Un identificador ya guardado no se pisa: pudo verificarse a mano.
    if (seed.racketIdentifiers.length > 0) {
      await tx`insert into racket_identifiers ${tx(seed.racketIdentifiers)} on conflict do nothing`;
    }
  });
}

export interface DevSeedContext {
  nodeEnv: string | undefined;
  /** Tiendas reales (no demo) que hay en la base de datos */
  realStores: string[];
  /** true si se ha pedido expresamente borrar los datos reales */
  force: boolean;
}

/**
 * Motivo por el que NO se puede cargar el seed de desarrollo (que borra todas
 * las tablas), o null si se puede. En producción no se puede nunca; con datos
 * de tiendas reales, solo pidiéndolo expresamente.
 */
export function devSeedBlocker({ nodeEnv, realStores, force }: DevSeedContext): string | null {
  if (nodeEnv === "production") {
    return "El seed de desarrollo borra todos los datos y no se ejecuta con NODE_ENV=production.";
  }
  if (realStores.length > 0 && !force) {
    return (
      `La base de datos tiene datos de tiendas reales (${realStores.join(", ")}) que el seed de desarrollo borraría: ` +
      "precios, histórico y emparejamientos. Para el catálogo usa `npm run db:seed`, que no borra nada. " +
      `Si de verdad quieres borrarlos, repite con ${DEV_SEED_FORCE_FLAG}.`
    );
  }
  return null;
}

export const DEV_SEED_FORCE_FLAG = "--force-delete-real-data";

/** Tiendas reales de la base de datos: las que el seed de desarrollo destruiría. */
export async function listRealStores(sql: Sql): Promise<string[]> {
  const rows = await sql<{ slug: string }[]>`select slug from stores where not is_demo order by slug`;
  return rows.map((row) => row.slug);
}

/**
 * Seed de DESARROLLO: SUSTITUYE el contenido de todas las tablas de PalaRadar
 * por la semilla, con tiendas y precios de demostración. Comprueba antes
 * `devSeedBlocker`. Después hay que recalcular los agregados (refreshPriceStats).
 */
export async function loadDevSeed(
  sql: Sql,
  seed: SeedTables,
  options: { force?: boolean; nodeEnv?: string } = {},
): Promise<void> {
  await inTransaction(sql, async (tx) => {
    // Dentro de la transacción: nadie puede añadir datos reales entre la comprobación y el borrado.
    const blocker = devSeedBlocker({
      nodeEnv: options.nodeEnv ?? process.env.NODE_ENV,
      realStores: await listRealStores(tx),
      force: options.force ?? false,
    });
    if (blocker) throw new Error(blocker);

    await tx.unsafe(`truncate ${TABLES.join(", ")} cascade`);

    await tx`insert into brands ${tx(seed.brands)}`;
    await tx`insert into stores ${tx(seed.stores)}`;
    for (const racket of seed.rackets) await insertRacket(tx, racket);
    if (seed.racketAlternatives.length > 0) {
      await tx`insert into racket_alternatives ${tx(seed.racketAlternatives)}`;
    }
    if (seed.racketIdentifiers.length > 0) {
      await tx`insert into racket_identifiers ${tx(seed.racketIdentifiers)}`;
    }
    for (const rows of chunks(seed.storePrices)) await tx`insert into store_prices ${tx(rows)}`;
    for (const rows of chunks(seed.priceHistory)) await tx`insert into price_history ${tx(rows)}`;
    for (const rows of chunks(seed.reviews)) await tx`insert into reviews ${tx(rows)}`;
  });
}

/** Filas de cada tabla que pertenecen a un grupo de tiendas (demo o reales). */
export interface StoreDataCounts {
  stores: string[];
  storePrices: number;
  priceHistory: number;
  storeProducts: number;
  ingestionRuns: number;
  /** Agregados cuyo mejor precio es de una de esas tiendas */
  priceStats: number;
}

/** Cuenta, sin modificar nada, los datos de las tiendas demo (o de las reales). */
export async function countStoreData(sql: Sql, demo: boolean): Promise<StoreDataCounts> {
  const [stores, [counts]] = await Promise.all([
    sql<{ slug: string }[]>`select slug from stores where is_demo = ${demo} order by slug`,
    sql<Omit<StoreDataCounts, "stores">[]>`
      with s as (select id from stores where is_demo = ${demo})
      select
        (select count(*)::int from store_prices where store_id in (select id from s)) as "storePrices",
        (select count(*)::int from price_history where store_id in (select id from s)) as "priceHistory",
        (select count(*)::int from store_products where store_id in (select id from s)) as "storeProducts",
        (select count(*)::int from ingestion_runs where store_id in (select id from s)) as "ingestionRuns",
        (select count(*)::int from racket_price_stats where best_store_id in (select id from s)) as "priceStats"`,
  ]);
  return { stores: stores.map((row) => row.slug), ...counts };
}

/**
 * Nombre con el que hay que confirmar el borrado: identifica la base de datos
 * de la URL (la referencia del proyecto en Supabase; si no, servidor y base).
 * No incluye la contraseña.
 */
export function databaseLabel(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const project = /^postgres\.(.+)$/.exec(decodeURIComponent(url.username))?.[1];
  return project ?? `${url.hostname}${url.pathname}`;
}

export const PURGE_DEMO_CONFIRM_FLAG = "--confirm-database";

/**
 * Motivo por el que NO se borran los datos demo, o null si se puede. Borrar
 * exige escribir el nombre de la base de datos sobre la que se actúa: así no
 * se ejecuta por accidente ni contra la base equivocada.
 */
export function purgeDemoBlocker(confirmation: string | undefined, target: string): string | null {
  if (confirmation === undefined) {
    return `No se ha borrado nada. Para borrar, repite con ${PURGE_DEMO_CONFIRM_FLAG}=${target}`;
  }
  if (confirmation !== target) {
    return (
      `La confirmación «${confirmation}» no coincide con la base de datos conectada («${target}»). ` +
      "No se ha borrado nada."
    );
  }
  return null;
}

/**
 * Borra las tiendas de demostración y todo lo que cuelga de ellas: sus precios
 * publicados, su histórico, sus productos de tienda y sus ejecuciones. No toca
 * marcas, palas, EAN, opiniones ni nada de las tiendas reales, y lo comprueba
 * antes de confirmar la transacción. Devuelve lo borrado.
 */
export async function purgeDemoData(
  sql: Sql,
  options: { confirmation: string | undefined; target: string; now?: Date },
): Promise<StoreDataCounts> {
  const blocker = purgeDemoBlocker(options.confirmation, options.target);
  if (blocker) throw new Error(blocker);

  return inTransaction(sql, async (tx) => {
    if (!(await tryPriceWriteLock(tx))) {
      throw new Error("Hay una ingestión de precios en marcha. Repite cuando termine; no se ha borrado nada.");
    }

    const demo = await countStoreData(tx, true);
    const realBefore = await countStoreData(tx, false);

    // racket_price_stats apunta a la tienda del mejor precio sin borrado en cascada.
    await tx`delete from racket_price_stats where best_store_id in (select id from stores where is_demo)`;
    // El resto (store_prices, price_history, store_products, ingestion_runs) cae en cascada.
    await tx`delete from stores where is_demo`;
    await refreshPriceStats(tx, options.now ?? new Date(), false);

    const realAfter = await countStoreData(tx, false);
    const untouched = (["stores", "storePrices", "priceHistory", "storeProducts", "ingestionRuns"] as const).every(
      (key) => JSON.stringify(realAfter[key]) === JSON.stringify(realBefore[key]),
    );
    if (!untouched) {
      throw new Error("El borrado habría afectado a datos de tiendas reales: se ha deshecho por completo.");
    }
    return demo;
  });
}

interface StatsOfferRow extends StorePriceRow {
  store_slug: string;
  store_name: string;
  store_url: string;
}

/**
 * Recalcula `racket_price_stats` para todas las palas a partir de los precios
 * actuales y del histórico, con computePriceStats. Solo cuentan las tiendas
 * activas como fuente de precios (ver activeStores): una pala que solo tenga
 * precios de tiendas demo se queda sin agregados, es decir, sin precio.
 */
export async function refreshPriceStats(
  sql: Sql,
  now: Date,
  includeDemo: boolean = pricingConfig.includeDemoStores,
): Promise<number> {
  const active = activeStores(sql, "s", includeDemo);
  const [prices, history] = await Promise.all([
    sql<StatsOfferRow[]>`
      select p.*, s.slug as store_slug, s.name as store_name, s.url as store_url
      from store_prices p join stores s on s.id = p.store_id
      where ${active}`,
    // Mejor precio de cada día entre las tiendas activas.
    sql<{ racket_id: string; price_date: string; price: number }[]>`
      select h.racket_id, h.price_date, min(h.price) as price
      from price_history h join stores s on s.id = h.store_id
      where ${active}
      group by h.racket_id, h.price_date
      order by h.price_date`,
  ]);

  const offersByRacket = new Map<string, StoreOffer[]>();
  for (const row of prices) {
    const offers = offersByRacket.get(row.racket_id) ?? [];
    offers.push(
      toStoreOffer(row, {
        id: row.store_id,
        slug: row.store_slug,
        name: row.store_name,
        url: row.store_url,
      }),
    );
    offersByRacket.set(row.racket_id, offers);
  }

  const historyByRacket = new Map<string, PricePoint[]>();
  for (const row of history) {
    const points = historyByRacket.get(row.racket_id) ?? [];
    points.push({ date: row.price_date, price: Number(row.price) });
    historyByRacket.set(row.racket_id, points);
  }

  const rows: RacketPriceStatsRow[] = [...offersByRacket].flatMap(([racketId, offers]) => {
    const stats = computePriceStats(offers, historyByRacket.get(racketId) ?? [], now);
    return stats ? [toPriceStatsRow(racketId, stats)] : [];
  });

  await inTransaction(sql, async (tx) => {
    await tx`delete from racket_price_stats`;
    for (const batch of chunks(rows)) await tx`insert into racket_price_stats ${tx(batch)}`;
  });

  return rows.length;
}
