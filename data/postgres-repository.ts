// Repositorio sobre PostgreSQL/Supabase. Cada método es una consulta: filtros,
// búsqueda, orden y paginación se resuelven en SQL sobre la vista
// `racket_catalog`, nunca trayendo el catálogo para filtrarlo en memoria.
import { pricingConfig } from "@/config/pricing";
import { CATALOG_PAGE_SIZE, DEFAULT_QUERY, type CatalogQuery, type SortId } from "@/lib/catalog/query";
import { assessIndexability } from "@/lib/indexability";
import { buildPriceHistory } from "@/lib/pricing";
import {
  affinity,
  matchCriteria,
  rankRecommendations,
  SIDE_BALANCES,
  TOUCH_MATCHES,
} from "@/lib/recommender";
import { sharedTraits } from "@/lib/similar";
import type {
  BrandRow,
  RacketCatalogRow,
  RacketMediaRow,
  RacketRow,
  ReviewRow,
  StorePriceRow,
} from "@/types/db";
import { getSql, type Sql } from "./db/client";
import { activeStores } from "./db/sources";
import {
  toBrand,
  toIndexabilitySource,
  toMonthlyDrop,
  toPala,
  toPalaSummary,
  toStoreOffer,
  type IndexabilityRow,
} from "./mappers";
import type { CatalogRepository } from "./repository";

const BIG_DISCOUNT_PERCENT = 20;
const PRICE_CEILING_STEP = 50;
const HOUR_MS = 3_600_000;
const MAX_REVIEWS = 50;
/** Candidatas del recomendador que se traen para ordenarlas por afinidad */
const RECOMMENDATION_POOL = 60;
/** Fuente cuyas valoraciones se enseñan en la ficha, siempre con su nombre */
const RATINGS_SOURCE = "padelzoom";

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
  // Solo entran palas con veredicto: sin 30 días de histórico no hay «buen precio».
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

/**
 * Orden por defecto, con datos que se pueden comprobar: primero las palas que
 * más tiendas tienen a la venta ahora mismo; a igualdad, las que tienen foto
 * real y, después, las más recientes. No es popularidad: no hay visitas, ventas
 * ni opiniones detrás. El desempate final es un orden fijo sin significado (el
 * hash del slug) para que las empatadas no salgan agrupadas por marca.
 */
function availabilityOrder(sql: Sql): Fragment {
  return sql`case when ${hasCurrentPrice(sql)} then store_count end desc nulls last,
    (photo_path is not null) desc, year desc, md5(slug) collate "C", slug`;
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
      return sql`year desc, case when ${current} then store_count end desc nulls last, slug`;
    default:
      return availabilityOrder(sql);
  }
}

/** Fila del catálogo con los datos de tacto que usa el recomendador */
type TraitsRow = RacketCatalogRow & { touch: string | null; hardness: string | null };

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
      const [[brand], offers, history, reviews, alternatives, photos, identifiers, ratings] = await Promise.all([
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
        // Solo las imágenes publicables: verificadas, con derechos y con copia propia.
        sql<Pick<RacketMediaRow, "storage_path" | "width" | "height">[]>`
          select storage_path, width, height from racket_media
          where racket_id = ${racket.id} and verification_status = 'verified'
            and rights_status = 'approved' and storage_path is not null
          order by (role = 'primary') desc, position, fetched_at desc nulls last, source_url`,
        sql<{ type: string; value: string }[]>`
          select type::text as type, value from racket_identifiers
          where racket_id = ${racket.id} and type::text in ('gtin', 'manufacturer_ref')
          order by type, value`,
        // Valoraciones de PadelZoom: se guardan como señal de esa fuente, no como datos de la pala.
        sql<{ attribute: string; value: string; source_name: string }[]>`
          select f.attribute, f.value, d.name as source_name
          from racket_facts f join data_sources d on d.slug = f.source
          where f.racket_id = ${racket.id} and f.kind = 'rating' and f.source = ${RATINGS_SOURCE}`,
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
          photos,
          identifiers,
          ratings,
        },
        at,
      );
    },

    async getPalaSummaries(slugs) {
      if (slugs.length === 0) return [];
      const rows = await sql<RacketCatalogRow[]>`
        select c.* from racket_catalog c join rackets r on r.id = c.id
        where r.is_available and c.slug in ${sql(slugs)}
        order by c.slug`;

      const at = now();
      return rows.map((row) => toPalaSummary(row, at));
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

    async getIndexablePalas() {
      // Una sola consulta con lo que mira el criterio; la decisión es la misma función que usa la ficha.
      const rows = await sql<IndexabilityRow[]>`
        select c.*, r.weight_min, r.technical_specs, r.hardness
        from racket_catalog c join rackets r on r.id = c.id
        where r.is_available
        order by c.slug`;

      const at = now();
      return rows
        .filter((row) => assessIndexability(toIndexabilitySource(row, at)).indexable)
        .map((row) => ({ slug: row.slug, brandSlug: row.brand_slug }));
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

    async getAlternativePairs() {
      const rows = await sql<{ a: string; b: string }[]>`
        select a.slug as a, b.slug as b
        from racket_alternatives x
        join rackets a on a.id = x.racket_id
        join rackets b on b.id = x.alternative_id
        where a.is_available and b.is_available`;
      return rows.map((row) => [row.a, row.b]);
    },

    async getTopRatedPalas(filters, limit) {
      const where = whereClause(sql, { ...DEFAULT_QUERY, ...filters });
      const rows = await sql<(RacketCatalogRow & { score: number })[]>`
        select c.*, f.score
        from (
          select * from racket_catalog
          where ${where} and best_price is not null and ${hasCurrentPrice(sql)} and photo_path is not null
        ) c
        join lateral (
          select max(value::numeric) as score from racket_facts
          where racket_id = c.id and kind = 'rating' and attribute = 'score_total'
            and source = ${RATINGS_SOURCE} and value ~ '^[0-9]+([.][0-9]+)?$'
        ) f on f.score is not null
        order by f.score desc, c.store_count desc nulls last, c.year desc, c.slug
        limit ${limit}`;

      const at = now();
      return rows.map((row) => ({ pala: toPalaSummary(row, at), score: Number(row.score) }));
    },

    async getSimilarPalas(target, limit) {
      const no = sql`false`;
      const sameBalance = target.balance ? sql`coalesce(c.balance::text = ${target.balance}, false)` : no;
      const sameStyle = target.playStyle ? sql`coalesce(c.play_style::text = ${target.playStyle}, false)` : no;
      const sameLevel =
        target.levels.length > 0 ? sql`(c.levels && string_to_array(${target.levels.join(",")}, ','))` : no;

      // Solo palas a la venta: una parecida sin precio no ayuda a decidir.
      const rows = await sql<RacketCatalogRow[]>`
        select c.* from racket_catalog c join rackets r on r.id = c.id
        where c.id <> ${target.id} and r.is_available and c.shape::text = ${target.shape}
          and c.best_price is not null and c.price_checked_at > ${staleBefore()}
        order by (${sameBalance})::int + (${sameStyle})::int + (${sameLevel})::int desc,
          (c.photo_path is not null) desc,
          ${target.price === null ? sql`0` : sql`abs(c.best_price - ${target.price})`} asc,
          c.store_count desc nulls last, c.year desc, c.slug
        limit ${limit}`;

      const at = now();
      return rows.map((row) => ({
        pala: toPalaSummary(row, at),
        shared: sharedTraits(target, { balance: row.balance, levels: row.levels, playStyle: row.play_style }),
      }));
    },

    async recommendPalas(prefs, limit) {
      const no = sql`false`;
      const yes = sql`true`;
      // Tacto pedido: el mismo criterio que `matchesTouch` (lib/recommender.ts). La
      // dureza solo cuenta si la pala no declara tacto.
      const wanted = prefs.touch ? TOUCH_MATCHES[prefs.touch] : null;
      const touchMatch = wanted
        ? sql`(lower(trim(coalesce(touch, ''))) in ${sql(wanted.touches)}
            or (trim(coalesce(touch, '')) = '' and lower(trim(coalesce(hardness, ''))) = ${wanted.hardness ?? ""}
                and ${wanted.hardness !== null}))`
        : no;

      // Forma y presupuesto son filtros; el resto puntúa.
      const rows = await sql<TraitsRow[]>`
        select * from (
          select c.*, r.hardness,
            (select s->>'value' from jsonb_array_elements(r.technical_specs) s
             where s->>'label' = 'Tacto' limit 1) as touch
          from racket_catalog c join rackets r on r.id = c.id
          where c.best_price is not null and c.price_checked_at > ${staleBefore()}
            and ${prefs.maxPrice === null ? yes : sql`c.best_price <= ${prefs.maxPrice}`}
            and ${prefs.shape === null ? yes : sql`c.shape::text = ${prefs.shape}`}
        ) candidates
        order by
          (${prefs.level ? sql`levels && array[${prefs.level}]::text[]` : no})::int
          + coalesce(${prefs.style ? sql`play_style::text = ${prefs.style}` : no}, false)::int
          + coalesce(${prefs.side ? sql`balance::text in ${sql(SIDE_BALANCES[prefs.side])}` : no}, false)::int
          + (${touchMatch})::int desc,
          ${availabilityOrder(sql)}
        limit ${Math.max(limit, RECOMMENDATION_POOL)}`;

      // La afinidad afina el orden entre las que más respuestas cumplen (lib/recommender.ts).
      const at = now();
      const candidates = rows.flatMap((row) => {
        const pala = toPalaSummary(row, at);
        const traits = {
          levels: row.levels,
          playStyle: row.play_style,
          shape: row.shape,
          balance: row.balance,
          touch: row.touch,
          hardness: row.hardness,
          price: pala.price,
        };
        const matched = matchCriteria(prefs, traits);
        return matched ? [{ pala, matched, affinity: affinity(prefs, traits), price: pala.price }] : [];
      });
      return rankRecommendations(candidates)
        .slice(0, limit)
        .map(({ pala, matched, affinity: score }) => ({ pala, matched, affinity: score }));
    },
  };
}
