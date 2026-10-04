-- Alertas de precio por correo, sin cuentas de usuario.
--
-- Recorrido de una alerta: pending (creada, a falta de confirmar el correo) →
-- active (confirmada: se vigila el precio) → notified (se alcanzó el precio y se
-- envió el aviso; no se vuelve a avisar) o cancelled (baja desde el enlace).
--
-- Datos personales: solo el correo y la fecha del consentimiento. La IP no se
-- guarda; `ip_hash` es una huella con clave, usada solo para limitar abusos.

create table price_alerts (
  id                   uuid primary key default gen_random_uuid(),
  racket_id            uuid not null references rackets (id) on delete cascade,
  -- En minúsculas
  email                text not null,
  -- Precio objetivo. Nulo: alerta de disponibilidad (la pala no tenía precio)
  target_price         numeric(8, 2) check (target_price > 0),
  status               text not null default 'pending'
    check (status in ('pending', 'active', 'notified', 'cancelled')),
  -- Secreto del enlace de confirmación y de baja
  token                text not null unique,
  consent_at           timestamptz not null,
  ip_hash              text,
  created_at           timestamptz not null default now(),
  confirmation_sent_at timestamptz,
  confirmed_at         timestamptz,
  notified_at          timestamptz,
  notified_price       numeric(8, 2),
  cancelled_at         timestamptz
);

-- Una sola alerta abierta por pala y correo.
create unique index price_alerts_open_idx on price_alerts (racket_id, email)
  where status in ('pending', 'active');
create index price_alerts_active_idx on price_alerts (racket_id) where status = 'active';
create index price_alerts_created_idx on price_alerts (created_at);

alter table price_alerts enable row level security;
