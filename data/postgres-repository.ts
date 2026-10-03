// Repositorio sobre PostgreSQL/Supabase. Cada método es una consulta: filtros,
// búsqueda, orden y paginación se resuelven en SQL sobre la vista
// `racket_catalog`, nunca trayendo el catálogo para filtrarlo en memoria.
import { pricingConfig } from "@/config/pricing";
import { CATALOG_PAGE_SIZE, DEFAULT_QUERY, type CatalogQuery, type SortId } from "@/lib/catalog/query";
import type { BrandRow, RacketCatalogRow, RacketRow, ReviewRow, StorePriceRow } from "@/types/db";
import { getSql, type Sql } from "./db/client";
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

/** WHERE del catálogo a partir de la consulta. */
function whereClause(sql: Sql, query: CatalogQuery): Fragment {
  const conditions: Fragment[] = [];

  for (const token of normalizeText(query.q).split(/\s+/).filter(Boolean)) {
    conditions.push(sql`search_text like ${likePattern(token)}`);
  }

  if (query.collection === "en-oferta") conditions.push(sql`drop_percent > 0`);
  if (query.collection === "grandes-descuentos") {
    conditions.push(sql`drop_percent >= ${BIG_DISCOUNT_PERCENT}`);
  }
  if (query.collection === "mejor-precio") {
    const staleBefore = new Date(now().getTime() - pricingConfig.staleAfterHours * HOUR_MS);
    conditions.push(
      sql`price_status = 'good' and price_checked_at > ${staleBefore.toISOString()}`,
    );
  }

  if (query.levels.length > 0) {
    conditions.push(sql`levels && string_to_array(${query.levels.join(",")}, ',')`);
  }
  if (query.styles.length > 0) conditions.push(sql`play_style::text in ${sql(query.styles)}`);
  if (query.brands.length > 0) conditions.push(sql`brand_slug in ${sql(query.brands)}`);
  if (query.shapes.length > 0) conditions.push(sql`shape::text in ${sql(query.shapes)}`);
  if (query.balances.length > 0) conditions.push(sql`balance::text in ${sql(query.balances)}`);
  if (query.years.length > 0) conditions.push(sql`year in ${sql(query.years)}`);
  if (query.maxPrice !== null) conditions.push(sql`best_price <= ${query.maxPrice}`);

  return conditions.reduce((all, condition) => sql`${all} and ${condition}`, sql`true`);
}

/** ORDER BY de cada criterio; las palas sin precio van al final. */
function orderClause(sql: Sql, sort: SortId): Fragment {
  switch (sort) {
    case "precio":
      return sql`best_price asc nulls last, slug`;
    case "descuento":
      return sql`drop_percent desc nulls last, slug`;
    case "minimo":
      return sql`best_price / nullif(min_price, 0) asc nulls last, slug`;
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

export function createPostgresRepository(sql: Sql = getSql()): CatalogRepository {
  async function getBrands() {
    const rows = await sql<BrandRow[]>`
      select b.* from brands b
      where exists (select 1 from rackets r where r.brand_id = b.id)
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
        sql<{ year: number }[]>`select distinct year from rackets order by year desc`,
        sql<{ max: number }[]>`select coalesce(max(best_price), 0) as max from racket_price_stats`,
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
        where b.slug = ${slug} and exists (select 1 from rackets r where r.brand_id = b.id)`;
      return row ? toBrand(row) : null;
    },

    async getPalaBySlug(slug) {
      const [racket] = await sql<RacketRow[]>`
        select r.*, r.levels::text[] as levels from rackets r where r.slug = ${slug}`;
      if (!racket) return null;

      const [[brand], offers, history, reviews, alternatives] = await Promise.all([
        sql<BrandRow[]>`select * from brands where id = ${racket.brand_id}`,
        sql<OfferRow[]>`
          select p.*, s.slug as store_slug, s.name as store_name, s.url as store_url
          from store_prices p join stores s on s.id = p.store_id
          where p.racket_id = ${racket.id}`,
        sql<{ price_date: string; price: number }[]>`
          select price_date, price from racket_price_daily
          where racket_id = ${racket.id} order by price_date`,
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

    async getAllPalaSlugs() {
      const rows = await sql<{ slug: string }[]>`select slug from rackets order by slug`;
      return rows.map((row) => row.slug);
    },

    async getBiggestMonthlyDrops(limit) {
      const staleBefore = new Date(now().getTime() - pricingConfig.staleAfterHours * HOUR_MS);
      const rows = await sql<RacketCatalogRow[]>`
        select * from racket_catalog
        where price_30d_ago > best_price and price_checked_at > ${staleBefore.toISOString()}
        order by 1 - best_price / price_30d_ago desc, slug
        limit ${limit}`;

      const at = now();
      return rows.flatMap((row) => toMonthlyDrop(row, at) ?? []);
    },
  };
}
