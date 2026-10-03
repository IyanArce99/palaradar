// Operaciones de administración de la base de datos: aplicar el esquema, cargar
// la semilla y recalcular los agregados de precio. Las usan los scripts de
// scripts/db/; la web no las llama.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { computePriceStats } from "@/lib/pricing";
import type { PricePoint, StoreOffer } from "@/types/catalog";
import type { RacketPriceStatsRow, RacketRow, StorePriceRow, StoreRow } from "@/types/db";
import { toPriceStatsRow, toStoreOffer } from "../mappers";
import type { SeedTables } from "../seed/build";
import { inTransaction, type Sql } from "./client";

const DB_DIR = join(process.cwd(), "db");
const MIGRATIONS_DIR = join(DB_DIR, "migrations");
const BASE_MIGRATION = "001_schema";
const INSERT_CHUNK = 1000;

// En orden de borrado seguro (primero las que dependen de otras).
const TABLES = [
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
const VIEWS = ["racket_catalog", "racket_price_daily"];
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

async function insertRacket(sql: Sql, r: RacketRow): Promise<void> {
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
    )`;
}

/**
 * Sustituye el contenido de las tablas de PalaRadar por la semilla, en una
 * transacción. Después hay que recalcular los agregados (refreshPriceStats).
 */
export async function loadSeed(sql: Sql, seed: SeedTables): Promise<void> {
  await sql.begin(async (tx) => {
    await tx.unsafe(`truncate ${TABLES.join(", ")} cascade`);

    await tx`insert into brands ${tx(seed.brands)}`;
    await tx`insert into stores ${tx(seed.stores)}`;
    for (const racket of seed.rackets) await insertRacket(tx as unknown as Sql, racket);
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

/**
 * Recalcula `racket_price_stats` para todas las palas a partir de los precios
 * actuales y del histórico, con computePriceStats. Es lo que deberá ejecutar el
 * proceso de actualización de precios después de cada pasada.
 */
export async function refreshPriceStats(sql: Sql, now: Date): Promise<number> {
  const [prices, history] = await Promise.all([
    sql<(StorePriceRow & { store: StoreRow })[]>`
      select p.*, to_jsonb(s) as store from store_prices p join stores s on s.id = p.store_id`,
    sql<{ racket_id: string; price_date: string; price: number }[]>`
      select racket_id, price_date, price from racket_price_daily order by price_date`,
  ]);

  const offersByRacket = new Map<string, StoreOffer[]>();
  for (const row of prices) {
    const offers = offersByRacket.get(row.racket_id) ?? [];
    offers.push(toStoreOffer(row, row.store));
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
