-- Qué significa `rights_status` en `racket_media`, y cómo se sustituye una imagen.
--
-- `rights_status` es NUESTRO estado interno de aprobación: si hemos decidido que
-- la imagen puede mostrarse en PalaRadar. NO acredita una licencia ni la
-- titularidad de la imagen. La base de esa decisión se anota en `rights_note`.
--
-- Las imágenes de PadelZoom son fotos de catálogo de los fabricantes obtenidas de
-- sus fichas: están aprobadas para mostrarse, sin que eso suponga afirmar derechos
-- legales sobre ellas. Están pensadas para sustituirse por imágenes de fabricantes,
-- tiendas u otras fuentes con derechos claros:
--   · una imagen nueva se añade como otra fila de la misma pala (otra `source`);
--   · a igual rol y posición se publica la importada más recientemente;
--   · retirar las de una fuente es un UPDATE: rights_status = 'rejected' (o
--     'pending') sobre las filas de esa `source`. La pala vuelve entonces a la
--     siguiente imagen publicable o a su ilustración.
-- No se borra ni se modifica ninguna imagen.

comment on column racket_media.rights_status is
  'Estado INTERNO de aprobación para mostrar la imagen en PalaRadar (approved | pending | rejected). No acredita licencia ni titularidad; la base de la decisión está en rights_note.';
comment on column racket_media.rights_note is
  'En qué se basa rights_status: autorización, licencia, acuerdo con la fuente… o su ausencia.';

update racket_media
set rights_note = 'Aprobación interna para mostrarla en PalaRadar (octubre de 2026). No acredita licencia ni titularidad: es una foto de catálogo obtenida de PadelZoom. Sustituible por una imagen de fabricante, tienda u otra fuente con derechos claros.'
where source = 'padelzoom';

-- La foto publicada: a igual rol y posición, la importada más recientemente.
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
    order by (m.role = 'primary') desc, m.position, m.fetched_at desc nulls last, m.source_url
    limit 1
  ) as photo_path
from rackets r
join brands b on b.id = r.brand_id
left join racket_price_stats s on s.racket_id = r.id
where r.is_available;
