# Ingestión de precios

Investigación y diseño del sistema que sustituirá los precios de prueba por precios reales. Comprobaciones hechas el 3 de octubre de 2026 con unas pocas peticiones por tienda; lo que no se pudo comprobar está marcado como tal.

## Estado de la implementación

La ingestión está construida en `ingestion/`. **Hay una tienda real conectada: PadelProShop**, con autorización expresa de la tienda, a través del JSON de su colección de palas. Se ejecuta a mano; todavía no hay tarea programada.

```bash
npm run prices:dry-run                        # descarga, empareja y muestra el resultado; no escribe nada
npm run prices:ingest -- --store=padelproshop # ingestión real, en una única transacción
```

24 de las 28 palas del catálogo tienen EAN verificado en `racket_identifiers`, tomado de la web del fabricante o contrastado en dos fuentes. Las cuatro restantes (Bullpadel Neuron 2025, Head Extreme Pro 2026, Head Evo Extreme 2025 y Wilson Defy LS V1 SE 2026) no tienen un EAN que se haya podido verificar sin ambigüedad.

| Pieza | Archivo |
|---|---|
| Contrato del adaptador y tipos | `ingestion/types.ts` |
| Validación de EAN/GTIN | `ingestion/gtin.ts` |
| Emparejamiento con el catálogo | `ingestion/matcher.ts`, `ingestion/title.ts` |
| Normalización de precios | `ingestion/normalizer.ts` |
| Flujo de una ejecución | `ingestion/run.ts` |
| Persistencia (memoria y PostgreSQL) | `ingestion/memory-repository.ts`, `ingestion/postgres-repository.ts` |
| Adaptador de prueba | `ingestion/adapters/mock.ts` |
| Adaptador de PadelProShop | `ingestion/adapters/padelproshop.ts` |
| Comandos | `scripts/prices/dry-run.ts`, `scripts/prices/ingest.ts` |
| Tablas nuevas | `db/migrations/002_price_ingestion.sql` |

Diferencias con el diseño de más abajo, decididas al implementar:

- La disponibilidad no es un estado del emparejamiento. `store_products` lleva `matching_status` (emparejado, en revisión, rechazado) y, aparte, `listing_status` (activo, agotado, desaparecido): una pala agotada sigue emparejada.
- `store_prices` no ha cambiado. Un producto agotado o desaparecido deja de publicarse ahí; su estado, su precio de lista y su último precio viven en `store_products`.
- Un producto sin equivalente en el catálogo queda como rechazado con su motivo, no en revisión, para que la cola de revisión solo contenga dudas reales. Se reevalúa en cada ejecución, así que se empareja solo cuando la pala se añade al catálogo.

- Una pala con el mismo nombre pero otro EAN (otro color, por ejemplo) no se empareja. Para aceptarla hay que añadir ese segundo EAN a `racket_identifiers`.
- `npm run db:seed` vacía las tablas, incluidos los productos y precios reales de las tiendas. Después hay que volver a ejecutar la ingestión.

Para probarlo: `npm test` (reglas de negocio, sin base de datos), `npm run test:db` (repositorio PostgreSQL, en una transacción que se deshace) y `npm run ingest:demo` (flujo completo con datos ficticios).

## Resumen

- **No hace falta empezar por el scraping.** De las cinco tiendas, dos tienen feed por red de afiliación (CJ), una expone su catálogo en JSON con EAN, y dos son WooCommerce sin vía oficial localizada, a las que hay que pedir permiso.
- **El EAN es la clave para casar productos entre tiendas.** Cuatro de las cinco lo publican. Padel Nuestro, la mayor, no lo publica en su web.
- **El calendario lo marcan los trámites, no el código:** las redes de afiliación exigen una web pública con contenido real y aprobación manual de cada tienda.
- **Amazon no sirve para un histórico:** sus condiciones de afiliación prohíben el seguimiento y las alertas de precio.

## Fuentes por tienda

| Tienda | Plataforma | Vía oficial | EAN | Palas | Método recomendado |
|---|---|---|---|---|---|
| Padel Nuestro | Magento 2 | Feed de producto en **CJ Affiliate** | No en la web; en el feed, sin verificar | ~450 | Feed de CJ |
| Ofertas de Padel | PrestaShop | **CJ Affiliate** (etiqueta de CJ en su código) | Sí, en JSON-LD y en la URL | 445 | Feed de CJ |
| PadelProShop | Shopify | Ninguna con feed; programa propio de creadores | Sí: el SKU es el EAN | 579 | JSON de colección, con permiso |
| Tienda Padel 5 | WooCommerce | No encontrada | Sí, en JSON-LD | 362 | Pedir feed o permiso |
| Padel.tienda | WooCommerce | No encontrada | Sí, en JSON-LD | 253 | Pedir feed o permiso |

### Padel Nuestro

- Sin API utilizable: la REST de Magento responde 401 y GraphQL 403.
- Programa en CJ Affiliate, que según los directorios incluye feed de todo el catálogo. **Sin verificar** qué campos trae el feed y cuál de sus programas (ES, EU, UK) cubre España.
- Respaldo: `sitemap_product.xml` (8.428 URL con `lastmod`) y el JSON-LD de cada ficha, que da precio y disponibilidad sin JavaScript. El precio anterior solo está en el HTML.
- La ficha solo publica un SKU interno (`113757-P`). Si el feed tampoco trae EAN, esta tienda habrá que casarla por marca, modelo y año.
- `robots.txt` permite las fichas y excluye paginación, filtros y búsqueda: el catálogo se descubre por sitemap, no por listados.

### Ofertas de Padel

- Anunciante de CJ (identificador 1598839 en su código). **Sin verificar** que el programa esté activo y tenga catálogo cargado.
- Respaldo: el sitemap lleva `lastmod` y el EAN dentro de cada URL de pala, así que basta para descubrir y casar productos; el precio sale del JSON-LD.
- Detrás de Cloudflare, que bloqueó una de las lecturas de prueba. Otro motivo para ir por CJ.

Padel Nuestro y Ofertas de Padel comparten localidad, red de afiliación y formato de SKU, lo que sugiere un mismo grupo. Es una deducción, pero si se confirma, una sola gestión cubriría las dos.

### PadelProShop

- `GET /collections/palas-padel/products.json?limit=250&page=N` devuelve el catálogo de palas en tres peticiones: precio, precio anterior, disponibilidad, marca, URL y EAN. Comprobado de primera mano.
- Su `robots.txt` no excluye esos endpoints, pero la tienda no los ofrece como feed para terceros y su aviso legal prohíbe reproducir contenidos con fines comerciales sin autorización.
- No se encontró en ninguna red con feed. Su programa de afiliación es de creadores (enlaces y códigos), sin catálogo.
- Muchas palas son exclusivas de la tienda: no tienen equivalente en otras.

### Tienda Padel 5 y Padel.tienda

- Ambas WooCommerce. La API oficial exige claves (401). La interfaz que usa su propia web (`/wp-json/wc/store/v1/products`) responde sin autenticación con precio, precio anterior, stock, SKU y URL; no incluye EAN, que hay que leer una vez del JSON-LD de cada ficha.
- No es una API ofrecida a terceros y pueden cerrarla. Sus avisos legales prohíben reproducir contenidos con fines comerciales.
- Padel.tienda tiene un `robots.txt` restrictivo (`*s=`, `*filter`, `*orderby`, `*feed`, páginas legales): solo son válidas las llamadas con `category`, `per_page` y `page`. Durante la investigación se hicieron dos lecturas puntuales fuera de esas reglas; la ingestión no debe repetirlas.

### Otras tiendas con vía oficial

No estaban en la lista, pero tienen programa con feed y merece la pena añadirlas pronto:

| Tienda | Red | Nota |
|---|---|---|
| StreetPadel | CJ | Misma alta que Padel Nuestro |
| Padel Market | Awin | Feed de más de 12.500 productos |
| Padel-Point | Awin | Tarifa específica para comparadores |
| Zona de Padel | TradeTracker | Feed sin verificar; publica EAN en la ficha |

Los feeds de Awin incluyen EAN, precio, precio anterior, envío, stock y enlace de afiliado. El EAN es opcional: su cobertura depende de cada tienda.

### Descartadas por ahora

- **Amazon.** Sus condiciones prohíben el seguimiento y las alertas de precio y obligan a refrescar los datos cada 24 horas. La API exige unas diez ventas al mes. Como mucho, un enlace sin precio.
- **Decathlon y El Corte Inglés.** Programas sin verificar; las palas de Decathlon suelen ser de su marketplace, que probablemente no comisiona.
- **Google Merchant.** Su API solo lee los productos de la cuenta propia.

## Identificación de productos

### Qué identificadores existen

| Identificador | Fiabilidad | Observaciones |
|---|---|---|
| EAN / GTIN | Alta | El mismo EAN de la Metalbone 3.4 aparece en el fabricante y en dos tiendas |
| Referencia del fabricante | Baja | Para ese mismo EAN, dos tiendas publican referencias distintas |
| SKU de la tienda | Solo dentro de esa tienda | Sirve para seguir un producto en su tienda, no para casarlo con otras |
| Marca + modelo + año | Media | Imprescindible para Padel Nuestro; propenso a errores |

El EAN distingue justo lo que necesitamos: cambia con cada colección (Vertex 04 2025 y Vertex 05 2026 tienen EAN distintos) y con cada variante (la versión Woman tiene el suyo).

Dos precauciones al leerlo:

- **Detectarlo por formato, no por nombre de campo.** Según la tienda está en `gtin`, `gtin13`, `mpn`, `sku`, `barcode` o al final de la URL. Se acepta solo si tiene de 12 a 14 dígitos y dígito de control válido.
- **Normalizar a 14 dígitos.** Head usa códigos de 12 (UPC).

### Estrategia de matching

Se aplica por niveles, del más fiable al menos:

| Nivel | Regla | Resultado |
|---|---|---|
| 1 | Mismo EAN y misma marca | Automático |
| 2 | Marca, modelo, variante y año iguales tras normalizar | Automático solo si hay un único candidato y el precio es coherente |
| 3 | Parecido de título sin igualdad de atributos | Siempre revisión manual |

**Vetos**, que prevalecen sobre cualquier nivel: EAN válidos distintos, año distinto o variante distinta (Woman, Hybrid, Comfort, Junior, CTRL, Light…) significan que no es el mismo producto.

**Nunca se casa automáticamente:** packs con paletero, palas de test o segunda mano, títulos sin año, y un EAN que aparezca con dos marcas.

Un producto de tienda sin casar no se publica. Queda en una cola de revisión, y la decisión manual se guarda para no repetirla.

Trampas conocidas del nombre: el número de versión no es el año (Metalbone «3.4» es 2025), el año se escribe «25», «2025» o no se escribe, y el nombre del jugador aparece o no según la tienda.

### Requisito previo

Las 28 palas del catálogo no tienen EAN guardado. Antes de casar nada hay que añadirlo, a partir de la fuente más fiable de cada marca.

## Arquitectura

```
tarea programada
   └─ por cada tienda activa:
        StoreAdapter.fetch()      → productos de la tienda, ya normalizados
        ProductMatcher            → asigna pala del catálogo o manda a revisión
        PriceNormalizer           → precio final, envío, precio anterior
        PriceRepository           → store_prices + price_history
   └─ al terminar: refreshPriceStats()   (ya existe)
```

- **`StoreAdapter`** es lo único específico de cada tienda. Devuelve una lista con la misma forma para todas: identificador en la tienda, título, marca, EAN si lo hay, URL, precio, precio de lista, disponibilidad.
- **Tres adaptadores cubren las cinco tiendas:** feed de CJ (Padel Nuestro y Ofertas de Padel), Shopify (PadelProShop) y WooCommerce (Tienda Padel 5 y Padel.tienda). Awin y TradeTracker serían un cuarto y un quinto.
- **El envío es una regla de cada tienda** (umbral de envío gratis y coste por debajo), no un dato del producto. Vive en la configuración del adaptador.
- **Se ejecuta fuera de la web**, como un script más de `scripts/`, lanzado por una tarea programada. La web solo lee.
- Encaja con lo que hay: escribe en `store_prices` y `price_history`, y llama a `refreshPriceStats`, que ya calcula los agregados.

### Cambios necesarios en el modelo de datos

No se ha tocado nada. La investigación muestra que faltan tres piezas para poder ingerir:

| Pieza | Para qué |
|---|---|
| Identificadores de pala (EAN, uno o varios por pala) | Casar por EAN |
| Producto de tienda (tienda, identificador propio, URL, título, EAN, pala asignada, estado del emparejamiento, última vez visto) | Seguir un producto aunque cambie su URL, y guardar las decisiones de matching |
| Registro de ejecuciones (tienda, inicio, fin, resultado, recuentos, error) | Distinguir «el precio no ha cambiado» de «no hemos podido comprobarlo» |

Y dos campos en `store_prices`: si hay stock (hoy solo hay un texto de disponibilidad) y el precio de lista que declara la tienda.

## Frecuencia y comportamiento

**Frecuencia recomendada:** una pasada diaria de madrugada para los feeds de afiliación, que se regeneran una vez al día, y dos o tres al día para las fuentes JSON, que cuestan tres o cuatro peticiones. Con esa cadencia ningún precio pasa de las 24 horas y todos se muestran como «de hoy».

| Situación | Qué se hace |
|---|---|
| Una tienda falla | Sus precios se conservan y `checked_at` no avanza. A las 24 h pasan a «último precio conocido» y a las 48 h a «sin confirmar». Las demás tiendas no se ven afectadas. Aviso tras tres fallos seguidos |
| El producto se agota | Se mantiene, marcado sin stock, y deja de contar para el mejor precio |
| El producto desaparece | Se marca como no visto. Tras dos pasadas seguidas se retira de `store_prices`; su histórico se conserva |
| Cambia la URL | El producto se identifica por su identificador en la tienda, no por la URL: se actualiza el enlace |
| Cambia el identificador | Se vuelve a casar por EAN; sin EAN, va a revisión |
| El precio baja | Se actualiza, se guarda el anterior, se registra en el histórico del día y se recalculan los agregados |
| Bajada de más del 40 % | No se publica hasta confirmarla en la pasada siguiente: suele ser un error del feed |
| El precio vuelve a subir | Igual que una bajada. No se muestra como descuento |
| El precio no cambia | Se actualiza solo `checked_at`. Es lo que mantiene el precio como comprobado |

**Histórico:** una fila por pala, tienda y día, con el último precio observado ese día.

**Precio anterior:** el que mostramos tachado debe salir de nuestro propio histórico, no del precio de lista que declara la tienda. En la muestra de PadelProShop los precios de lista duplicaban el de venta; presentarlos como «antes» inflaría los descuentos.

**Datos obsoletos:** ya está resuelto. Cada precio lleva `checked_at` y la interfaz distingue precio de hoy, último conocido y sin confirmar. El registro de ejecuciones añade la causa.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Las redes de afiliación rechazan la solicitud por web sin terminar | Publicar antes una versión con catálogo real, aviso de afiliación y página de metodología |
| El feed de CJ no trae EAN | Casar Padel Nuestro por marca, modelo y año con revisión manual |
| Uso de datos sin autorización | Los avisos legales de las cinco tiendas prohíben reproducir contenidos con fines comerciales. Pedir permiso por escrito donde no haya relación de afiliado. Copiar solo hechos (precio, stock, URL), nunca descripciones ni fotos |
| Una tienda cierra su interfaz JSON o bloquea el acceso | Un adaptador por tienda aísla el fallo; los precios caducan solos |
| Emparejamiento erróneo | Vetos por año y variante, cola de revisión y muestreo manual en la primera carga de cada tienda |
| Precios de lista inflados | Usar nuestro histórico como referencia |
| Transparencia legal del comparador | Explicar cómo se ordenan los resultados y avisar de los enlaces de afiliado. El orden no debe depender de la comisión |

Los puntos legales resumen fuentes públicas y no son asesoramiento jurídico. Conviene revisarlos con un abogado antes de lanzar.

## Orden de implementación

1. **Trámites, ya.** Solicitar alta como comparador en CJ, Awin y TradeTracker. Escribir a PadelProShop, Tienda Padel 5 y Padel.tienda pidiendo feed o permiso.
2. **Modelo de datos.** Las tres piezas nuevas y los dos campos.
3. **EAN del catálogo.** Añadir el EAN a las 28 palas.
4. **Esqueleto de la ingestión** con el matcher, el normalizador y el registro de ejecuciones, probado con datos de ejemplo.
5. **Primer adaptador: PadelProShop.** Es el más sencillo (tres peticiones, EAN en todos los productos) y valida el flujo completo. Requiere su permiso.
6. **Adaptador de CJ**, en cuanto aprueben la cuenta. Cubre Padel Nuestro y Ofertas de Padel.
7. **Adaptador de WooCommerce**, con permiso. Cubre Tienda Padel 5 y Padel.tienda.
8. **Tarea programada** y avisos de fallo.
9. **Awin y TradeTracker.**

## Pendiente de verificar

- Campos y frecuencia de los feeds de CJ y TradeTracker; si el de Padel Nuestro incluye EAN.
- Qué programa de CJ cubre el mercado español.
- Que Ofertas de Padel tenga catálogo cargado en CJ.
- Coste de envío de Padel Nuestro por debajo del umbral.
- Si PadelProShop cambia de mercado o moneda desde un servidor fuera de España.
- Límites de peticiones reales de cada tienda.
- EAN de packs y de ediciones exclusivas.
