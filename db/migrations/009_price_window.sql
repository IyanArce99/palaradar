-- PalaRadar · el veredicto de precio se calcula sobre una ventana de 30 días
--
-- Con pocos días de histórico, cualquier precio es «el más bajo que hemos visto».
-- Desde ahora la media, el mínimo y el veredicto salen de los últimos 30 días, y
-- una pala no tiene veredicto hasta que su seguimiento cubre esa ventana.

-- `recent`: la pala lleva menos de 30 días en seguimiento y aún no se valora.
alter type price_status add value if not exists 'recent';

-- La media pasa de 90 a 30 días. `min_price` y `min_price_date` pasan a ser el
-- mínimo de esos mismos 30 días. Los tres quedan nulos sin histórico suficiente.
alter table racket_price_stats rename column avg_90d to avg_30d;

-- Primer día con precio registrado: desde cuándo se sigue el precio de la pala.
alter table racket_price_stats add column tracked_since date;
