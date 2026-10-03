-- Ingestión de precios: identificadores de pala, productos de tienda y registro
-- de ejecuciones. Ver docs/price-ingestion.md. Interfaces en types/db.ts.

create type identifier_type as enum ('gtin', 'manufacturer_ref');
create type matching_status as enum ('matched', 'pending_review', 'rejected');
create type matching_method as enum ('gtin', 'attributes', 'manual');
create type listing_status as enum ('active', 'out_of_stock', 'missing');
create type ingestion_status as enum ('running', 'success', 'failed');

-- Identificadores externos de nuestras palas. Una pala puede tener varios
-- (p. ej. un GTIN por color), pero cada identificador pertenece a una sola pala.
create table racket_identifiers (
  racket_id   uuid not null references rackets (id) on delete cascade,
  type        identifier_type not null,
  -- Los GTIN se guardan normalizados a 14 dígitos (EAN-13 y UPC-12 con ceros a la izquierda)
  value       text not null,
  -- De dónde sale el identificador (URL o nombre de la fuente)
  source      text not null,
  -- null mientras no se haya contrastado con una segunda fuente
  verified_at timestamptz,
  primary key (type, value)
);

create index racket_identifiers_racket_idx on racket_identifiers (racket_id);

-- Un producto concreto del catálogo de una tienda, esté o no emparejado con una
-- de nuestras palas. Guarda su último precio observado; lo que se publica en la
-- web sigue siendo store_prices.
create table store_products (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores (id) on delete cascade,
  -- Identificador estable del producto en la tienda (su SKU o id): la URL puede cambiar
  external_id     text not null,
  racket_id       uuid references rackets (id) on delete set null,
  title           text not null,
  brand           text,
  gtin            text,
  url             text not null,
  matching_status matching_status not null,
  -- Cómo se produjo el emparejamiento; null si no está emparejado
  matching_method matching_method,
  -- Motivo cuando queda en revisión o rechazado
  matching_note   text,
  listing_status  listing_status not null default 'active',
  -- Último precio aceptado, sin envío
  price           numeric(8, 2),
  -- Precio de lista que declara la tienda. Informativo: NO se usa como precio anterior
  list_price      numeric(8, 2),
  -- Bajada anómala pendiente de confirmar en la siguiente ejecución
  pending_price   numeric(8, 2),
  checked_at      timestamptz,
  first_seen_at   timestamptz not null,
  last_seen_at    timestamptz not null,
  -- Ejecuciones seguidas en las que no ha aparecido
  missed_runs     smallint not null default 0,
  unique (store_id, external_id)
);

create index store_products_racket_idx on store_products (racket_id);
create index store_products_review_idx on store_products (store_id)
  where matching_status = 'pending_review';

create table ingestion_runs (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references stores (id) on delete cascade,
  started_at       timestamptz not null,
  finished_at      timestamptz,
  status           ingestion_status not null default 'running',
  products_seen    integer not null default 0,
  products_matched integer not null default 0,
  products_pending integer not null default 0,
  prices_updated   integer not null default 0,
  error_message    text
);

create index ingestion_runs_store_idx on ingestion_runs (store_id, started_at desc);

alter table racket_identifiers enable row level security;
alter table store_products enable row level security;
alter table ingestion_runs enable row level security;
