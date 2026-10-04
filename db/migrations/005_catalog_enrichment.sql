-- Catálogo enriquecido: cada dato de una pala guarda su fuente, y lo que se
-- publica en `rackets` es el valor elegido entre esas observaciones. Ninguna
-- fuente es imprescindible: PadelZoom, las tiendas y los fabricantes son filas
-- de `data_sources`, y sus datos se pueden añadir o retirar sin tocar el modelo.

alter type pala_shape add value if not exists 'hibrida';
alter type identifier_type add value if not exists 'padelzoom_model_id';
alter type identifier_type add value if not exists 'padelzoom_slug';

-- Valores publicados nuevos. Los que ya existían (forma, balance, estilo,
-- niveles, peso, technical_specs) se siguen usando igual.
alter table rackets
  add column player             text,
  add column variants           text[] not null default '{}',
  add column gender             text,
  add column thickness_mm       numeric(4, 1),
  add column surface            text,
  add column finish             text,
  add column hardness           text,
  add column msrp               numeric(8, 2),
  -- false: la pala está en la base de datos pero no se ofrece en la web
  -- (por ejemplo, con un dato esencial sin resolver). No tiene que ver con SEO.
  add column is_available       boolean not null default true,
  add column unavailable_reason text,
  -- 1 identidad y básicos · 2 características con fuente · 3 editorial · 4 histórico y comparativa
  add column enrichment_level   smallint not null default 1;

create index rackets_available_idx on rackets (is_available);

-- De dónde sale la información. `kind` ordena la confianza por defecto.
create table data_sources (
  slug text primary key,
  name text not null,
  -- manufacturer: web oficial · store: tienda autorizada · catalog: catálogo de terceros · internal: PalaRadar
  kind text not null check (kind in ('manufacturer', 'store', 'catalog', 'internal')),
  url  text
);

-- Una observación: lo que UNA fuente dice de UN atributo de UNA pala. Nunca se
-- sobrescribe la de otra fuente; el valor publicado es la fila `selected`.
create table racket_facts (
  id          uuid primary key default gen_random_uuid(),
  racket_id   uuid not null references rackets (id) on delete cascade,
  attribute   text not null,
  -- Valor normalizado y comparable entre fuentes
  value       text not null,
  -- Valor tal como lo publica la fuente
  raw_value   text,
  unit        text,
  source      text not null references data_sources (slug),
  source_url  text,
  observed_at timestamptz not null,
  -- fact: dato técnico · declared: lo declara la fuente (nivel, tacto…) · rating: valoración de un tercero
  kind        text not null check (kind in ('fact', 'declared', 'rating')),
  confidence  text not null check (confidence in ('high', 'medium', 'review')),
  -- Es el valor publicado de ese atributo
  selected    boolean not null default false,
  -- Lo ha fijado una persona: las cargas automáticas no cambian su selección
  pinned      boolean not null default false,
  unique (racket_id, attribute, source)
);

create index racket_facts_racket_idx on racket_facts (racket_id);
create unique index racket_facts_selected_idx on racket_facts (racket_id, attribute) where selected;

-- Atributos en los que las fuentes no dicen lo mismo. Los conflictos no se
-- borran al elegir un valor: siguen aquí mientras las fuentes discrepen.
create view racket_fact_conflicts with (security_invoker = true) as
select
  f.racket_id,
  f.attribute,
  count(distinct f.value) as distinct_values,
  jsonb_agg(jsonb_build_object(
    'source', f.source, 'value', f.value, 'raw', f.raw_value,
    'confidence', f.confidence, 'selected', f.selected
  ) order by f.source) as observations
from racket_facts f
where f.kind <> 'rating'
group by f.racket_id, f.attribute
having count(distinct f.value) > 1;

-- Texto de una fuente guardado como materia prima (p. ej. un análisis). Es
-- privado: la web no lo muestra; sirve para redactar el editorial propio.
create table racket_source_content (
  racket_id  uuid not null references rackets (id) on delete cascade,
  source     text not null references data_sources (slug),
  kind       text not null,
  body       text not null,
  url        text,
  words      integer not null default 0,
  fetched_at timestamptz not null,
  primary key (racket_id, source, kind)
);

-- Imágenes de terceros, solo como referencia: no se muestran hasta revisar derechos.
create table racket_media (
  racket_id     uuid not null references rackets (id) on delete cascade,
  source        text not null references data_sources (slug),
  url           text not null,
  rights_status text not null default 'pending' check (rights_status in ('pending', 'cleared', 'rejected')),
  primary key (racket_id, url)
);

-- Direcciones de otra web que corresponden a una pala nuestra. Solo es el
-- mapa; las redirecciones se decidirán aparte.
create table legacy_urls (
  source    text not null references data_sources (slug),
  path      text not null,
  racket_id uuid not null references rackets (id) on delete cascade,
  primary key (source, path)
);

-- Confianza del emparejamiento de un producto de tienda con una pala.
alter table store_products
  add column matching_confidence text check (matching_confidence in ('high', 'medium', 'review'));

-- El catálogo solo ofrece las palas disponibles.
create or replace view racket_catalog with (security_invoker = true) as
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
left join racket_price_stats s on s.racket_id = r.id
where r.is_available;

alter table data_sources enable row level security;
alter table racket_facts enable row level security;
alter table racket_source_content enable row level security;
alter table racket_media enable row level security;
alter table legacy_urls enable row level security;
