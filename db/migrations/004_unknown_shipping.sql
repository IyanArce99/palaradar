-- El coste de envío pasa a ser opcional: null significa que todavía no tenemos
-- verificada la regla de envío de la tienda, y entonces el precio publicado es
-- el del producto, sin envío. Antes solo se podía guardar un número, y un 0 se
-- mostraba como «envío gratis». No cambia ninguna fila existente.

alter table store_prices alter column shipping_cost drop not null;
