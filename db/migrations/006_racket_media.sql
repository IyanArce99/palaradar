-- Imágenes reales de producto. `racket_media` pasa de ser una lista de URLs de
-- referencia a describir cada imagen: de dónde viene, dónde está nuestra copia
-- (Supabase Storage), qué mide, y si puede publicarse.
--
-- Una imagen se publica solo si está verificada (controles técnicos de calidad),
-- tiene los derechos aprobados y hay copia propia guardada. Mientras no haya una
-- así, la pala sigue mostrando su ilustración (`rackets.images`).
-- No se borra ninguna fila existente.

alter table racket_media rename column url to source_url;

-- Derechos: «cleared» pasa a llamarse «approved».
alter table racket_media drop constraint racket_media_rights_status_check;
update racket_media set rights_status = 'approved' where rights_status = 'cleared';
alter table racket_media
  add constraint racket_media_rights_status_check
  check (rights_status in ('approved', 'pending', 'rejected'));

alter table racket_media
  add column role text not null default 'primary' check (role in ('primary', 'gallery')),
  add column position integer not null default 0,
  -- Ruta de nuestra copia dentro del bucket: rackets/{racket_id}/primary.jpg
  add column storage_path text,
  add column width integer,
  add column height integer,
  -- SHA-256 del archivo: detecta la misma imagen en dos palas y evita subirla dos veces
  add column file_hash text,
  add column file_size integer,
  add column fetched_at timestamptz,
  -- Cómo se asoció la imagen a la pala y con qué confianza
  add column matching_method text,
  add column matching_confidence text check (matching_confidence in ('high', 'medium', 'review')),
  add column verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  -- Motivo del estado: qué control no pasa, o el error de la última descarga
  add column verification_note text,
  add column rights_note text;

-- PadelZoom: uso autorizado en PalaRadar. La imagen viene de la misma ficha de la
-- que salió la pala, así que la asociación es directa.
update racket_media
set rights_status = 'approved',
    rights_note = 'Uso de las imágenes de PadelZoom autorizado en PalaRadar (octubre de 2026)',
    matching_method = 'source_page',
    matching_confidence = 'high'
where source = 'padelzoom';

-- Excepción: las palas a las que apunta además una URL antigua de PadelZoom que
-- servía el contenido de otra pala. Su imagen queda fuera de publicación hasta
-- revisarla a mano.
update racket_media m
set matching_confidence = 'review',
    verification_note = 'Pala con una URL antigua de PadelZoom que mostraba otra pala: revisar la imagen a mano'
where m.source = 'padelzoom'
  and (select count(*) from legacy_urls l where l.racket_id = m.racket_id and l.source = 'padelzoom') > 1;

create index racket_media_hash_idx on racket_media (file_hash) where file_hash is not null;
create index racket_media_published_idx on racket_media (racket_id)
  where verification_status = 'verified' and rights_status = 'approved' and storage_path is not null;

-- El catálogo ofrece, junto a la ilustración, la foto publicada de cada pala.
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
  s.price_checked_at,
  (
    select m.storage_path
    from racket_media m
    where m.racket_id = r.id
      and m.verification_status = 'verified'
      and m.rights_status = 'approved'
      and m.storage_path is not null
    order by (m.role = 'primary') desc, m.position, m.source_url
    limit 1
  ) as photo_path
from rackets r
join brands b on b.id = r.brand_id
left join racket_price_stats s on s.racket_id = r.id
where r.is_available;
