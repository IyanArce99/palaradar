-- Separa las tiendas de demostración de las reales. Las demo solo las crea el
-- seed de desarrollo; las que crea la ingestión son siempre reales. Todas las
-- consultas de precios, histórico y agregados excluyen las demo salvo que se
-- pida expresamente en desarrollo (INCLUDE_DEMO_PRICES=true).

alter table stores add column is_demo boolean not null default false;

-- Las tiendas del seed anterior a esta migración eran todas de demostración.
update stores set is_demo = true where slug like 'tienda-demo-%';

-- La vista mezclaba el histórico de todas las tiendas, demo incluidas. El
-- mejor precio diario se calcula ahora en la propia consulta, filtrando tiendas.
drop view if exists racket_price_daily;
