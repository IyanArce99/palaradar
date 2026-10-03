-- PalaRadar · esquema PostgreSQL / Supabase
-- Cada tabla y vista tiene su interfaz en types/db.ts con las mismas columnas.

create extension if not exists unaccent;
create extension if not exists pg_trgm;

create type pala_shape as enum ('redonda', 'lagrima', 'diamante');
create type pala_balance as enum ('bajo', 'medio', 'alto');
create type player_level as enum ('iniciacion', 'intermedio', 'avanzado', 'competicion');
create type play_style as enum ('control', 'polivalente', 'potencia');
create type price_status as enum ('good', 'fair', 'wait');

create table brands (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text not null default '',
  logo_url    text
);

create table rackets (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  brand_id             uuid not null references brands (id),
  model                text not null,
  year                 smallint not null,
  images               text[] not null default '{}',
  shape                pala_shape not null,
  balance              pala_balance not null,
  play_style           play_style not null,
  levels               player_level[] not null default '{}',
  weight_min           smallint not null,
  weight_max           smallint not null,
  description          text not null,
  editorial_summary    text not null,
  pros                 text[] not null default '{}',
  cons                 text[] not null default '{}',
  ideal_for            text[] not null default '{}',
  not_for              text[] not null default '{}',
  feel                 jsonb not null default '[]',   -- [{label, score 1-5}]
  feel_summary         text not null default '',
  editorial_updated_at date not null,
  -- Agregados de reviews, mantenidos al insertar o moderar opiniones
  rating               numeric(2, 1) not null default 0,
  review_count         integer not null default 0,
  review_aspects       jsonb not null default '[]',   -- [{label, score 0-10}]
  review_highlights    text[] not null default '{}',
  technical_specs      jsonb not null default '[]',   -- [{label, value}]
  faq                  jsonb not null default '[]'    -- [{question, answer}]
);

create index rackets_brand_idx on rackets (brand_id);
create index rackets_levels_idx on rackets using gin (levels);

create table racket_alternatives (
  racket_id      uuid not null references rackets (id) on delete cascade,
  alternative_id uuid not null references rackets (id) on delete cascade,
  reason         text not null,
  position       smallint not null default 0,
  primary key (racket_id, alternative_id)
);

create table stores (
  id   uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  url  text not null
);

-- Precio actual de cada pala en cada tienda
create table store_prices (
  racket_id      uuid not null references rackets (id) on delete cascade,
  store_id       uuid not null references stores (id) on delete cascade,
  current_price  numeric(8, 2) not null,
  previous_price numeric(8, 2),
  shipping_cost  numeric(6, 2) not null default 0,
  availability   text not null default '',
  product_url    text,
  last_updated   timestamptz not null,
  primary key (racket_id, store_id)
);

-- Precio final (con envío) por pala, tienda y día
create table price_history (
  racket_id uuid not null references rackets (id) on delete cascade,
  store_id  uuid not null references stores (id) on delete cascade,
  price     numeric(8, 2) not null,
  date      date not null,
  primary key (racket_id, store_id, date)
);

create index price_history_racket_date_idx on price_history (racket_id, date);

create table reviews (
  id             uuid primary key default gen_random_uuid(),
  racket_id      uuid not null references rackets (id) on delete cascade,
  rating         smallint not null check (rating between 1 and 5),
  title          text,
  text           text not null,
  author         text not null,
  level          player_level not null,
  author_context text,
  created_at     timestamptz not null default now()
);

create index reviews_racket_idx on reviews (racket_id, created_at desc);

-- Agregados de precio por pala. Los recalcula el proceso que actualiza precios
-- con la misma lógica que lib/pricing.ts (computePriceStats), para que el
-- catálogo filtre y ordene por precio sin recorrer price_history.
create table racket_price_stats (
  racket_id        uuid primary key references rackets (id) on delete cascade,
  best_price       numeric(8, 2) not null,
  best_store_id    uuid not null references stores (id),
  store_count      smallint not null,
  previous_price   numeric(8, 2),
  drop_percent     smallint,
  avg_90d          numeric(8, 2),
  min_price        numeric(8, 2),
  min_price_date   date,
  price_30d_ago    numeric(8, 2),
  price_status     price_status not null,
  price_updated_at timestamptz not null,
  computed_at      timestamptz not null default now()
);

create index racket_price_stats_price_idx on racket_price_stats (best_price);
create index racket_price_stats_drop_idx on racket_price_stats (drop_percent desc nulls last);

-- Mejor precio de cada día entre todas las tiendas: la serie del gráfico
create view racket_price_daily as
select racket_id, date, min(price) as price
from price_history
group by racket_id, date;

-- Lo que consulta el catálogo: filtros, orden y paginación se aplican aquí
create view racket_catalog as
select
  r.id,
  r.slug,
  r.model,
  r.year,
  r.images,
  r.shape,
  r.balance,
  r.play_style,
  r.levels,
  r.description,
  r.rating,
  r.review_count,
  b.slug as brand_slug,
  b.name as brand_name,
  lower(unaccent(b.name || ' ' || r.model || ' ' || r.year)) as search_text,
  s.best_price,
  s.store_count,
  s.previous_price,
  s.drop_percent,
  s.min_price,
  s.price_30d_ago,
  s.price_status,
  s.price_updated_at
from rackets r
join brands b on b.id = r.brand_id
left join racket_price_stats s on s.racket_id = r.id;

-- Con 1.000–2.000 palas la vista basta. Si la búsqueda por texto se queda
-- corta, materializar search_text en rackets e indexarlo con gin_trgm_ops.
