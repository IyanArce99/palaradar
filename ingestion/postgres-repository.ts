import { refreshPriceStats } from "@/data/db/admin";
import { inTransaction, type Sql } from "@/data/db/client";
import type { StoreProductRow, StorePriceRow } from "@/types/db";
import type { IngestionRepository, IngestionStore } from "./repository";
import type { CatalogRacket, PublishedPrice, StoreProduct } from "./types";

function toStoreProduct(row: StoreProductRow): StoreProduct {
  return {
    storeId: row.store_id,
    externalId: row.external_id,
    racketId: row.racket_id,
    title: row.title,
    brand: row.brand,
    gtin: row.gtin,
    url: row.url,
    matchingStatus: row.matching_status,
    matchingMethod: row.matching_method,
    matchingNote: row.matching_note,
    listingStatus: row.listing_status,
    price: row.price,
    listPrice: row.list_price,
    pendingPrice: row.pending_price,
    checkedAt: row.checked_at,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    missedRuns: row.missed_runs,
  };
}

/** Repositorio de ingestión sobre PostgreSQL/Supabase. */
export function createPostgresIngestionRepository(sql: Sql): IngestionRepository {
  return {
    async getStore(slug) {
      const [store] = await sql<IngestionStore[]>`
        select id, slug, name from stores where slug = ${slug}`;
      return store ?? null;
    },

    async ensureStore({ slug, name, url, isDemo }) {
      // Real o demo lo declara el adaptador; es lo que separa sus precios de los reales.
      const [store] = await sql<IngestionStore[]>`
        insert into stores (slug, name, url, is_demo) values (${slug}, ${name}, ${url}, ${isDemo})
        on conflict (slug) do update set
          name = excluded.name, url = excluded.url, is_demo = excluded.is_demo
        returning id, slug, name`;
      return store;
    },

    transaction(work) {
      return inTransaction(sql, (tx) => work(createPostgresIngestionRepository(tx)));
    },

    async loadCatalog() {
      return sql<CatalogRacket[]>`
        select r.id, b.name as brand, r.model, r.year,
               array(
                 select i.value from racket_identifiers i
                 where i.racket_id = r.id and i.type = 'gtin'
               ) as gtins
        from rackets r join brands b on b.id = r.brand_id`;
    },

    async startRun(storeId, startedAt) {
      const [run] = await sql<{ id: string }[]>`
        insert into ingestion_runs (store_id, started_at)
        values (${storeId}, ${startedAt}) returning id`;
      return run.id;
    },

    async finishRun(runId, result) {
      await sql`
        update ingestion_runs set
          finished_at = ${result.finishedAt},
          status = ${result.status}::ingestion_status,
          products_seen = ${result.productsSeen},
          products_matched = ${result.productsMatched},
          products_pending = ${result.productsPending},
          prices_updated = ${result.pricesUpdated},
          error_message = ${result.errorMessage}
        where id = ${runId}`;
    },

    async listStoreProducts(storeId) {
      const rows = await sql<StoreProductRow[]>`
        select * from store_products where store_id = ${storeId}`;
      return rows.map(toStoreProduct);
    },

    async saveStoreProduct(p) {
      await sql`
        insert into store_products (
          store_id, external_id, racket_id, title, brand, gtin, url,
          matching_status, matching_method, matching_note, listing_status,
          price, list_price, pending_price, checked_at, first_seen_at, last_seen_at, missed_runs
        ) values (
          ${p.storeId}, ${p.externalId}, ${p.racketId}, ${p.title}, ${p.brand}, ${p.gtin}, ${p.url},
          ${p.matchingStatus}::matching_status, ${p.matchingMethod}::matching_method,
          ${p.matchingNote}, ${p.listingStatus}::listing_status,
          ${p.price}, ${p.listPrice}, ${p.pendingPrice}, ${p.checkedAt},
          ${p.firstSeenAt}, ${p.lastSeenAt}, ${p.missedRuns}
        )
        on conflict (store_id, external_id) do update set
          racket_id = excluded.racket_id,
          title = excluded.title,
          brand = excluded.brand,
          gtin = excluded.gtin,
          url = excluded.url,
          matching_status = excluded.matching_status,
          matching_method = excluded.matching_method,
          matching_note = excluded.matching_note,
          listing_status = excluded.listing_status,
          price = excluded.price,
          list_price = excluded.list_price,
          pending_price = excluded.pending_price,
          checked_at = excluded.checked_at,
          last_seen_at = excluded.last_seen_at,
          missed_runs = excluded.missed_runs`;
    },

    async getPublishedPrice(racketId, storeId) {
      const [row] = await sql<StorePriceRow[]>`
        select * from store_prices where racket_id = ${racketId} and store_id = ${storeId}`;
      if (!row) return null;

      return {
        racketId: row.racket_id,
        storeId: row.store_id,
        price: row.current_price,
        previousPrice: row.previous_price,
        shipping: row.shipping_cost,
        availability: row.availability,
        url: row.product_url ?? "",
        checkedAt: row.checked_at,
      } satisfies PublishedPrice;
    },

    async publishPrice(price) {
      await sql`
        insert into store_prices (
          racket_id, store_id, current_price, previous_price, shipping_cost,
          availability, product_url, checked_at
        ) values (
          ${price.racketId}, ${price.storeId}, ${price.price}, ${price.previousPrice},
          ${price.shipping}, ${price.availability}, ${price.url}, ${price.checkedAt}
        )
        on conflict (racket_id, store_id) do update set
          current_price = excluded.current_price,
          previous_price = excluded.previous_price,
          shipping_cost = excluded.shipping_cost,
          availability = excluded.availability,
          product_url = excluded.product_url,
          checked_at = excluded.checked_at`;
    },

    async unpublishPrice(racketId, storeId) {
      await sql`delete from store_prices where racket_id = ${racketId} and store_id = ${storeId}`;
    },

    async recordHistory(racketId, storeId, priceDate, total) {
      await sql`
        insert into price_history (racket_id, store_id, price, price_date)
        values (${racketId}, ${storeId}, ${total}, ${priceDate})
        on conflict (racket_id, store_id, price_date) do update set price = excluded.price`;
    },

    async refreshStats(now) {
      await refreshPriceStats(sql, now);
    },
  };
}
