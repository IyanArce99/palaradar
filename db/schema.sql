-- PalaRadar · esquema PostgreSQL / Supabase
-- Cada tabla y vista tiene su interfaz en types/db.ts con las mismas columnas.
-- Se aplica con `npm run db:migrate`.

-- En Supabase las extensiones viven en el esquema `extensions`.
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

create type pala_shape as enum ('redonda', 'lagrima', 'diamante');
create type pala_balance as enum ('bajo', 'medio', 'alto');
create type player_level as enum ('iniciacion', 'intermedio', 'avanzado', 'competicion');
create type play_style as enum ('control', 'polivalente', 'potencia');
create type price_status as enum ('good', 'fair', 'wait');
create type editorial_status as enum ('draft', 'reviewed');

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
  -- Rutas o URL de imagen. Hoy son ilustraciones propias (/img/palas/…);
  -- se sustituyen por fotos de producto cambiando estos valores.
  images               text[] not null default '{}',
  shape                pala_shape not null,
  -- Nulos cuando el fabricante no lo declara: no se inventan.
  balance              pala_balance,
  play_style           play_style,
  levels               player_level[] not null default '{}',
  weight_min           smallint,
  weight_max           smallint,
  description          text not null,
  editorial_summary    text not null,
  editorial_status     editorial_status not null default 'draft',
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
  faq                  jsonb not null default '[]',   -- [{question, answer}]
  -- Página (normalmente del fabricante) de la que se verificaron las especificaciones
  specs_source_url     text
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
  -- Momento en que se comprobó el precio en la tienda (no la fecha del precio)
  checked_at     timestamptz not null,
  primary key (racket_id, store_id)
);

-- Precio final (con envío) por pala, tienda y día
create table price_history (
  racket_id  uuid not null references rackets (id) on delete cascade,
  store_id   uuid not null references stores (id) on delete cascade,
  price      numeric(8, 2) not null,
  -- Día al que corresponde el precio
  price_date date not null,
  primary key (racket_id, store_id, price_date)
);

create index price_history_racket_date_idx on price_history (racket_id, price_date);

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

-- Agregados de precio por pala, para que el catálogo filtre y ordene por
-- precio sin recorrer price_history. Los recalcula `npm run db:stats` (y, más
-- adelante, el proceso que actualice precios) con computePriceStats de
-- lib/pricing.ts. La ficha no depende de esta tabla: calcula sobre los precios vivos.
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
  price_checked_at timestamptz not null,
  computed_at      timestamptz not null default now()
);

create index racket_price_stats_price_idx on racket_price_stats (best_price);
create index racket_price_stats_drop_idx on racket_price_stats (drop_percent desc nulls last);

-- Mejor precio de cada día entre todas las tiendas: la serie del gráfico
create view racket_price_daily with (security_invoker = true) as
select racket_id, price_date, min(price) as price
from price_history
group by racket_id, price_date;

-- Lo que consulta el catálogo: filtros, orden y paginación se aplican aquí
create view racket_catalog with (security_invoker = true) as
select
  r.id,
  r.slug,
  r.model,
  r.year,
  r.images,
  r.shape,
  r.balance,
  r.play_style,
  r.levels::text[] as levels,
  r.description,
  r.rating,
  r.review_count,
  b.slug as brand_slug,
  b.name as brand_name,
  lower(extensions.unaccent(b.name || ' ' || r.model || ' ' || r.year)) as search_text,
  s.best_price,
  s.store_count,
  s.previous_price,
  s.drop_percent,
  s.min_price,
  s.price_30d_ago,
  s.price_status,
  s.price_checked_at
from rackets r
join brands b on b.id = r.brand_id
left join racket_price_stats s on s.racket_id = r.id;

-- Supabase expone las tablas de `public` por su API pública. Con RLS activado y
-- sin políticas, esa API no devuelve nada; la web se conecta como servidor
-- (rol propietario) y no se ve afectada.
alter table brands enable row level security;
alter table rackets enable row level security;
alter table racket_alternatives enable row level security;
alter table stores enable row level security;
alter table store_prices enable row level security;
alter table price_history enable row level security;
alter table reviews enable row level security;
alter table racket_price_stats enable row level security;
