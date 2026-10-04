// Repositorio sobre PostgreSQL/Supabase. Cada método es una consulta: filtros,
// búsqueda, orden y paginación se resuelven en SQL sobre la vista
// `racket_catalog`, nunca trayendo el catálogo para filtrarlo en memoria.
import { pricingConfig } from "@/config/pricing";
import { CATALOG_PAGE_SIZE, DEFAULT_QUERY, type CatalogQuery, type SortId } from "@/lib/catalog/query";
import { buildPriceHistory } from "@/lib/pricing";
import type { BrandRow, RacketCatalogRow, RacketRow, ReviewRow, StorePriceRow } from "@/types/db";
import { getSql, type Sql } from "./db/client";
import { activeStores } from "./db/sources";
import { toBrand, toMonthlyDrop, toPala, toPalaSummary, toStoreOffer } from "./mappers";
import type { CatalogRepository } from "./repository";

const BIG_DISCOUNT_PERCENT = 20;
const PRICE_CEILING_STEP = 50;
const HOUR_MS = 3_600_000;
const MAX_REVIEWS = 50;

/** Reloj de la capa de datos: con datos reales, la fecha actual. */
function now(): Date {
  return new Date();
}

/** Momento a partir del cual una comprobación de precio sigue siendo válida. */
function staleBefore(): string {
  return new Date(now().getTime() - pricingConfig.staleAfterHours * HOUR_MS).toISOString();
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Escapa los comodines de LIKE para buscar el texto literal. */
function likePattern(token: string): string {
  return `%${token.replace(/[\\%_]/g, "\\$&")}%`;
}

type Fragment = ReturnType<Sql>;

/**
 * El precio de una pala solo cuenta para filtrar y ordenar mientras su
 * comprobación no esté desactualizada: un precio antiguo no es «el precio actual».
 */
function hasCurrentPrice(sql: Sql): Fragment {
  return sql`price_checked_at > ${staleBefore()}`;
}

/** WHERE del catálogo a partir de la consulta. */
function whereClause(sql: Sql, query: CatalogQuery): Fragment {
  const conditions: Fragment[] = [];
  const current = hasCurrentPrice(sql);

  for (const token of normalizeText(query.q).split(/\s+/).filter(Boolean)) {
    conditions.push(sql`search_text like ${likePattern(token)}`);
  }

  if (query.collection === "en-oferta") conditions.push(sql`drop_percent > 0 and ${current}`);
  if (query.collection === "grandes-descuentos") {
    conditions.push(sql`drop_percent >= ${BIG_DISCOUNT_PERCENT} and ${current}`);
  }
  if (query.collection === "mejor-precio") {
    conditions.push(sql`price_status = 'good' and ${current}`);
  }

  if (query.levels.length > 0) {
    conditions.push(sql`levels && string_to_array(${query.levels.join(",")}, ',')`);
  }
  if (query.styles.length > 0) conditions.push(sql`play_style::text in ${sql(query.styles)}`);
  if (query.brands.length > 0) conditions.push(sql`brand_slug in ${sql(query.brands)}`);
  if (query.shapes.length > 0) conditions.push(sql`shape::text in ${sql(query.shapes)}`);
  if (query.balances.length > 0) conditions.push(sql`balance::text in ${sql(query.balances)}`);
  if (query.years.length > 0) conditions.push(sql`year in ${sql(query.years)}`);
  if (query.maxPrice !== null) {
    conditions.push(sql`best_price <= ${query.maxPrice} and ${current}`);
  }

  return conditions.reduce((all, condition) => sql`${all} and ${condition}`, sql`true`);
}

/** ORDER BY de cada criterio; las palas sin precio actual van al final. */
function orderClause(sql: Sql, sort: SortId): Fragment {
  const current = hasCurrentPrice(sql);

  switch (sort) {
    case "precio":
      return sql`case when ${current} then best_price end asc nulls last, slug`;
    case "descuento":
      return sql`case when ${current} then drop_percent end desc nulls last, slug`;
    case "minimo":
      return sql`case when ${current} then best_price / nullif(min_price, 0) end asc nulls last, slug`;
    case "novedades":
      return sql`year desc, review_count desc, slug`;
    default:
      return sql`review_count desc, year desc, slug`;
  }
}

interface OfferRow extends StorePriceRow {
  store_slug: string;
  store_name: string;
  store_url: string;
}

interface HistoryRow {
  price_date: string;
  price: number;
  store_id: string;
  store_slug: string;
  store_name: string;
  store_url: string;
}

export function createPostgresRepository(sql: Sql = getSql()): CatalogRepository {
  async function getBrands() {
    const rows = await sql<BrandRow[]>`
      select b.* from brands b
      where exists (select 1 from rackets r where r.brand_id = b.id and r.is_available)
      order by b.name`;
    return rows.map(toBrand);
  }

  return {
    async searchCatalog(query, { pageSize = CATALOG_PAGE_SIZE } = {}) {
      const where = whereClause(sql, query);
      const [rows, [{ total }]] = await Promise.all([
        sql<RacketCatalogRow[]>`
          select * from racket_catalog
          where ${where}
          order by ${orderClause(sql, query.sort)}
          limit ${pageSize} offset ${(query.page - 1) * pageSize}`,
        sql<{ total: number }[]>`select count(*)::int as total from racket_catalog where ${where}`,
      ]);

      const at = now();
      return {
        items: rows.map((row) => toPalaSummary(row, at)),
        total,
        page: query.page,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      };
    },

    async countPalas(filters = {}) {
      const where = whereClause(sql, { ...DEFAULT_QUERY, ...filters });
      const [{ total }] = await sql<{ total: number }[]>`
        select count(*)::int as total from racket_catalog where ${where}`;
      return total;
    },

    async getCatalogFacets() {
      const [brands, years, [{ max }]] = await Promise.all([
        getBrands(),
        sql<{ year: number }[]>`
          select distinct year from rackets where is_available order by year desc`,
        sql<{ max: number }[]>`
          select coalesce(max(best_price), 0) as max from racket_catalog
          where ${hasCurrentPrice(sql)}`,
      ]);

      return {
        brands,
        years: years.map((row) => row.year),
        priceCeiling: Math.ceil(max / PRICE_CEILING_STEP) * PRICE_CEILING_STEP,
      };
    },

    getBrands,

    async getBrandBySlug(slug) {
      const [row] = await sql<BrandRow[]>`
        select b.* from brands b
        where b.slug = ${slug}
          and exists (select 1 from rackets r where r.brand_id = b.id and r.is_available)`;
      return row ? toBrand(row) : null;
    },

    async getPalaBySlug(slug) {
      const [racket] = await sql<RacketRow[]>`
        select r.*, r.levels::text[] as levels from rackets r
        where r.slug = ${slug} and r.is_available`;
      if (!racket) return null;

      // Ofertas e histórico salen solo de las tiendas activas como fuente de precios.
      const [[brand], offers, history, reviews, alternatives] = await Promise.all([
        sql<BrandRow[]>`select * from brands where id = ${racket.brand_id}`,
        sql<OfferRow[]>`
          select p.*, s.slug as store_slug, s.name as store_name, s.url as store_url
          from store_prices p join stores s on s.id = p.store_id
          where p.racket_id = ${racket.id} and ${activeStores(sql, "s")}`,
        sql<{ price_date: string; price: number }[]>`
          select h.price_date, min(h.price) as price
          from price_history h join stores s on s.id = h.store_id
          where h.racket_id = ${racket.id} and ${activeStores(sql, "s")}
          group by h.price_date order by h.price_date`,
        sql<ReviewRow[]>`
          select * from reviews where racket_id = ${racket.id}
          order by created_at desc limit ${MAX_REVIEWS}`,
        sql<(RacketCatalogRow & { reason: string })[]>`
          select c.*, a.reason
          from racket_alternatives a join racket_catalog c on c.id = a.alternative_id
          where a.racket_id = ${racket.id} order by a.position`,
      ]);
      if (!brand) return null;

      const at = now();
      return toPala(
        {
          racket,
          brand,
          offers: offers.map((row) =>
            toStoreOffer(row, {
              id: row.store_id,
              slug: row.store_slug,
              name: row.store_name,
              url: row.store_url,
            }),
          ),
          priceHistory: history.map((row) => ({ date: row.price_date, price: row.price })),
          reviews,
          alternatives: alternatives.map((row) => ({
            pala: toPalaSummary(row, at),
            reason: row.reason,
          })),
        },
        at,
      );
    },

    async getPriceHistory(slug) {
      const [racket] = await sql<{ id: string }[]>`select id from rackets where slug = ${slug}`;
      if (!racket) return null;

      // Una fila por tienda y día: de aquí salen el histórico global y el de cada tienda.
      const rows = await sql<HistoryRow[]>`
        select h.price_date, h.price, h.store_id,
               s.slug as store_slug, s.name as store_name, s.url as store_url
        from price_history h join stores s on s.id = h.store_id
        where h.racket_id = ${racket.id} and ${activeStores(sql, "s")}
        order by h.price_date`;

      return buildPriceHistory(
        rows.map((row) => ({
          store: { id: row.store_id, slug: row.store_slug, name: row.store_name, url: row.store_url },
          date: row.price_date,
          price: row.price,
        })),
      );
    },

    async getAllPalaSlugs() {
      const rows = await sql<{ slug: string }[]>`
        select slug from rackets where is_available order by slug`;
      return rows.map((row) => row.slug);
    },

    async getPricedPalaSlugs() {
      const rows = await sql<{ slug: string }[]>`
        select slug from racket_catalog where best_price is not null order by slug`;
      return rows.map((row) => row.slug);
    },

    async getBiggestMonthlyDrops(limit) {
      const rows = await sql<RacketCatalogRow[]>`
        select * from racket_catalog
        where price_30d_ago > best_price and ${hasCurrentPrice(sql)}
        order by 1 - best_price / price_30d_ago desc, slug
        limit ${limit}`;

      const at = now();
      return rows.flatMap((row) => toMonthlyDrop(row, at) ?? []);
    },
  };
}
