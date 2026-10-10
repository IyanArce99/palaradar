# PalaRadar

El lugar al que vas antes de comprar una pala de pádel: catálogo, para quién es cada pala, precios por tienda e histórico. Español de España, mobile-first.

**Estado:** interfaz V3 implementada sobre PostgreSQL/Supabase, con un catálogo pequeño de palas reales. Las especificaciones son reales y trazables a su fuente; **los precios y las tiendas son de prueba** y todavía no hay opiniones.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind CSS 4 · PostgreSQL (driver `postgres`).

## Ejecutar

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run lint
npm run typecheck
npm test           # reglas de negocio de la ingestión, sin base de datos
npm run test:db    # repositorio de ingestión contra PostgreSQL (no deja datos)
```

Sin configurar nada, el proyecto arranca con los datos seed en memoria.

### Con base de datos

1. Copia `.env.example` como `.env.local` y pon tu `DATABASE_URL` (en Supabase: Project Settings → Database → Connection string).
2. `npm run db:migrate` — aplica las migraciones pendientes (`db/schema.sql` y `db/migrations/`). No borra nada; `-- --reset` elimina las tablas de PalaRadar y las recrea.
3. `npm run db:seed` — crea o actualiza el catálogo (marcas, palas, EAN). No borra nada ni toca tiendas, precios o histórico: se puede ejecutar sobre datos reales.
4. `npm run prices:ingest -- --store=padelproshop` — precios reales de la tienda.
5. `npm run db:stats` — recalcula los agregados después de cambiar precios a mano.

Para una base de datos **de desarrollo** sin precios reales, `npm run db:seed:dev` sustituye el contenido de todas las tablas por la semilla con tiendas y precios de demostración. Es destructivo: no se ejecuta con `NODE_ENV=production` y se niega si la base tiene datos de tiendas reales (salvo `-- --force-delete-real-data`). Esos precios demo solo se muestran con `INCLUDE_DEMO_PRICES=true`.

### Cambiar entre mock y base de datos

| `DATA_SOURCE` | Resultado |
|---|---|
| sin definir | Base de datos si `DATABASE_URL` está configurada; si no, seed en memoria en desarrollo y error en producción |
| `mock` | Seed en memoria, aunque haya base de datos |
| `database` | Base de datos; falla al arrancar si no está configurada |

Las demás variables (umbrales de antigüedad del precio, `INCLUDE_DEMO_PRICES`, dominio, indexación) están documentadas en `.env.example`.

## Estructura

```
app/          Rutas, metadata, sitemap y robots
components/   layout/ · ui/ · pala/ · catalog/ · ficha/ · home/ · seo/
config/       Sitio, navegación y umbrales de precio
content/      Contenido editorial que no vive en base de datos (guías)
data/         Capa de acceso a datos (lo único que importan las páginas)
  index.ts                Elige el origen de datos
  repository.ts           Contrato CatalogRepository
  postgres-repository.ts  Implementación sobre PostgreSQL/Supabase
  memory-repository.ts    Implementación en memoria sobre el seed
  mappers.ts              Filas de BD → modelos de dominio
  db/                     Conexión y operaciones de administración
  seed/                   Palas reales, marcas, tiendas de prueba y generador de filas
db/           schema.sql (esquema base) · migrations/ (cambios posteriores)
docs/         price-ingestion.md: fuentes de precios y diseño de la ingestión
ingestion/    Ingestión de precios: adaptadores, matcher, normalizador y flujo
lib/          Lógica pura: precios, formato, consulta del catálogo, SEO
tests/        ingestion/ y pricing/ (sin base de datos) · db/ (contra PostgreSQL)
types/        catalog.ts y pricing.ts (dominio) · db.ts (filas de BD)
scripts/      db/ (migrate, seed, seed-dev, stats) · prices/ · generate-art.ts · ingest-demo.ts
```

## Ingestión de precios

El sistema que sustituye los precios de prueba está en `ingestion/`. Cada tienda tiene un adaptador que devuelve sus productos en un formato común; el resto (emparejar con el catálogo, normalizar, guardar, histórico y agregados) es compartido. Hay dos tiendas reales conectadas, PadelProShop y Padel Nuestro, las dos con su autorización. De Padel Nuestro todavía no se incluye el envío en el precio, y la ficha lo indica. Detalle, fuentes por tienda y reglas en [docs/price-ingestion.md](docs/price-ingestion.md).

```bash
npm run prices:dry-run                        # simula la ingestión y muestra el emparejamiento; no escribe nada
npm run prices:ingest                         # ingestión real de todas las tiendas (o -- --store=padelproshop)
npm run prices:pending                        # productos pendientes de revisión manual; solo lectura
npm run prices:decisions -- --file=<fichero>  # ensaya un fichero de decisiones manuales; con --apply lo aplica
npm run ingest:demo                           # flujo completo con datos ficticios, sin base de datos
npm run db:purge-demo                         # qué datos demo hay en la base; solo borra con confirmación
```

`prices:ingest` se puede programar con cualquier cron externo: escribe cada tienda en una transacción, nunca se solapa con otra ingestión (bloqueo en PostgreSQL) y devuelve un código de salida distinto de 0 si algo falla. Ver «Ejecución programada» en [docs/price-ingestion.md](docs/price-ingestion.md).

### Datos reales y de demostración

Cada tienda es real o de demostración (`stores.is_demo`), y lo declara su adaptador (`isDemo`). Las que crea la ingestión desde `ingestion/adapters/index.ts` son reales; las del seed de desarrollo y el adaptador de prueba son demo.

- Las tiendas demo **no participan** en nada que vea el usuario: ofertas, mejor precio, precio anterior, histórico, gráfico ni agregados. El filtro está en un solo sitio, `data/db/sources.ts` (`activeStores`), que usan la ficha y el cálculo de `racket_price_stats`.
- Solo cuentan con `INCLUDE_DEMO_PRICES=true` y fuera de producción; con `NODE_ENV=production` la variable se ignora.
- Una pala sin precio de ninguna tienda real se muestra sin precio.
- En producción, si falta `DATABASE_URL` la web falla al arrancar en lugar de servir el seed en memoria (salvo `DATA_SOURCE=mock`).
- El aviso de «precios de prueba» solo aparece con el seed en memoria o con las tiendas demo incluidas.

Para conectar otra tienda: un adaptador nuevo con `isDemo: false`, registrado en `ingestion/adapters/index.ts`. No hay que tocar consultas ni componentes.

## Catálogo enriquecido

Cada dato de una pala guarda de dónde sale. `racket_facts` tiene una fila por pala, atributo y fuente (valor normalizado, valor original, URL, fecha, tipo y confianza); lo que se publica en `rackets` es la observación marcada como elegida. Los conflictos entre fuentes no se pierden: la vista `racket_fact_conflicts` lista los atributos en los que no coinciden.

- **Fuentes** (`data_sources`): fabricantes, tiendas autorizadas y catálogos de terceros. Ninguna es imprescindible; sus datos se pueden añadir o retirar por fuente sin cambiar el modelo.
- **Identidad:** `racket_identifiers` relaciona cada pala con su EAN, la referencia del fabricante y los identificadores de otros catálogos. El SKU o id de cada tienda vive en `store_products`, con la confianza del emparejamiento (`matching_confidence`: high, medium, review).
- **Tipos de dato:** `fact` (técnico), `declared` (lo declara la fuente: nivel, tacto…) y `rating` (valoración de un tercero). Las valoraciones se guardan como señal y nunca se publican como valoración propia.
- **Disponibilidad:** una pala con `is_available = false` está en la base de datos pero no se ofrece en la web (por ejemplo, si las fuentes no coinciden en la forma). No tiene que ver con la indexación.
- **Material de terceros:** los textos de otras fuentes (`racket_source_content`) y sus imágenes (`racket_media`, con derechos pendientes) son privados: la web no los muestra. Las palas sin ilustración propia usan una genérica de su forma.
- **Forma:** cuatro valores; «híbrida» es una forma propia.

```bash
npm run catalog:import   # carga var/catalog/dataset.json (formato en catalog/types.ts); repetible, no borra nada
npm run prices:ingest    # después, para publicar los precios de las palas nuevas
```

El fichero se genera fuera del repositorio y no se versiona (`/var/` está ignorado). La carga respeta lo que una persona haya fijado a mano (`racket_facts.pinned`) y los datos verificados de las palas que ya existían. Solo se generan por adelantado las fichas de las palas con precio; el resto se generan al pedirlas.

## Arquitectura de datos

```
UI → data/index.ts → CatalogRepository → postgres-repository → PostgreSQL/Supabase
                                       ↘ memory-repository  → seed en memoria
```

Ningún componente importa la base de datos: solo `data/`.

- **Dos familias de tipos.** `types/db.ts` describe las filas (snake_case); `types/catalog.ts`, lo que consumen los componentes. `data/mappers.ts` convierte de unas a otras para ambos repositorios.
- **El catálogo consulta la vista `racket_catalog`.** Búsqueda, filtros, orden y paginación se resuelven en SQL; se devuelve solo la página pedida y el total.
- **`racket_price_stats`** guarda los agregados de precio de cada pala para que esa consulta pueda filtrar y ordenar por precio sin recorrer el histórico. Se recalcula con `npm run db:stats`.
- **La ficha no depende de esa tabla:** calcula el resumen de precio sobre `store_prices` y `price_history` en cada render.

### Qué tablas usa cada pantalla

| Pantalla | Tablas y vistas |
|---|---|
| Catálogo, marca, ofertas, portada (listados) | `racket_catalog` (= `rackets` + `brands` + `racket_price_stats`) |
| Filtros del catálogo | `brands`, `rackets`, `racket_price_stats` |
| Ficha | `rackets`, `brands`, `store_prices`, `stores`, `price_history` (mejor precio diario de las tiendas activas), `reviews`, `racket_alternatives` + `racket_catalog` |
| Sitemap | `rackets`, `brands` |

### Fechas y precios

Tres fechas distintas que no se mezclan:

- **Fecha actual:** la del servidor; toda la lógica de `lib/pricing.ts` la recibe como parámetro.
- **`checked_at`:** cuándo se comprobó un precio en la tienda.
- **`price_date`:** el día al que corresponde un registro del histórico.

Según la antigüedad de `checked_at`, el precio se presenta como:

| Antigüedad | Estado | En pantalla |
|---|---|---|
| hasta 24 h (`PRICE_CURRENT_HOURS`) | actual | «Mejor precio hoy», el gráfico llega a hoy |
| hasta 48 h (`PRICE_STALE_AFTER_HOURS`) | reciente | «Último precio conocido · comprobado hace N horas» |
| más de 48 h | desactualizado | «Precio sin confirmar», sin veredicto |

Un precio desactualizado nunca se presenta como precio actual: en la ficha no compite con las ofertas comprobadas de otras tiendas, y en los listados la pala aparece sin precio y queda fuera de ofertas, del filtro de precio máximo y del orden por precio.

### Veredicto de precio: ventana de 30 días

Todo lo que se dice de un precio frente a su histórico (`lib/pricing.ts`, `HISTORY_WINDOW_DAYS`) sale de los últimos 30 días, y solo cuando el seguimiento de la pala cubre esa ventana: su primer registro en `price_history` tiene 30 días o más.

| Histórico de la pala | En pantalla | En el catálogo |
|---|---|---|
| menos de 30 días | «Precio reciente · Seguimos este precio desde el…». Sin media, sin mínimo y sin veredicto | `price_status = 'recent'`, sin nota en la tarjeta y fuera de «Mejor precio hoy» |
| 30 días o más | «Buen momento para comprar», «Precio normal» o «Puedes esperar», con «Media últimos 30 días» y «Mínimo últimos 30 días» | `good`, `fair` o `wait`; solo `good` entra en «Mejor precio hoy» |

- **Buen momento:** un 8 % o más por debajo de la media de 30 días, o en el mínimo de esos 30 días y al menos un 3 % por debajo de la media. Estar en el mínimo no basta: un precio que no se ha movido también lo está.
- **Puedes esperar:** más de un 10 % por encima del mínimo de 30 días y sin estar por debajo de la media.
- **Precio normal:** el resto, incluido un precio que no ha cambiado.

Con pocos días de histórico cualquier precio es «el más bajo que hemos visto»; por eso antes de los 30 días no se afirma nada. La migración `009_price_window.sql` añade el estado `recent`, renombra `avg_90d` a `avg_30d` y guarda `tracked_since`.

### Orden por defecto del catálogo

No hay datos de popularidad (visitas, ventas ni opiniones). El orden por defecto es «En más tiendas»: primero las palas que más tiendas tienen a la venta con precio vigente y, a igualdad, las que tienen foto real y, después, las más recientes. Es también el criterio del bloque de portada y del desempate del recomendador. Con dos tiendas casi todas las palas a la venta empatan, así que el último desempate es un orden fijo sin significado (`md5(slug)`): evita que la primera página sea una sola marca por orden alfabético y no cambia entre páginas.

### Seed

`data/seed/rackets.ts` contiene 28 palas reales de 8 marcas. Cada una indica la página de la que salen sus datos; lo que la fuente no declara, o declara de forma ambigua, va en nulo. El campo `pending` recoge las dudas por revisar a mano. Varias marcas bloquean el acceso automático a su web, así que sus palas proceden de la ficha de una tienda (`source: "tienda"`) y conviene revisarlas.

- **Editorial:** borrador que resume lo que declara la fuente (`editorial_status = 'draft'`). Sin pros y contras ni puntuaciones de sensaciones.
- **Opiniones:** ninguna. Valoración y número de opiniones a cero.
- **Precios de demostración:** solo en el seed en memoria y en `npm run db:seed:dev`. Generados de forma determinista a partir del precio de referencia y repartidos en tiendas demo. Se comprueban «ahora» al cargarlos, salvo unas pocas palas que quedan a 30 horas y a 6 días para ver los tres estados.

Mientras se muestren precios de demostración, la web lo avisa y el JSON-LD no los publica como ofertas.

## SEO

- HTML completo en servidor; un `h1` por página; title, description y canónica propios.
- JSON-LD de migas de pan y de producto. Las ilustraciones no se publican como imagen de producto.
- `sitemap.xml` con portada, catálogo, ofertas, guías, colecciones, marcas y las fichas aptas para indexarse (ver más abajo).
- **Contenido propio:** guías (`/guias/`) y colecciones del catálogo (`/palas-padel/{coleccion}/`); ver «Guías y colecciones».

**Paginación** (24 palas por página; lógica en `lib/catalog/seo.ts`):

| URL | Indexable | Canónica |
|---|---|---|
| `/palas-padel/` y `?pagina=N` | Sí | Ella misma |
| `/palas-padel/{marca}/` y `?pagina=N` | Sí | Ella misma |
| `?marca=x` como único filtro | Sí | `/palas-padel/x/` |
| Cualquier otro filtro, orden o búsqueda | No (`noindex, follow`) | Ninguna |
| Página fuera de rango | 404 | — |

Todo el sitio va con `noindex` hasta definir `NEXT_PUBLIC_ALLOW_INDEXING=true`.

### Indexación selectiva de fichas

Cuando se active la indexación no se indexará todo el catálogo. Cada ficha pasa por `assessIndexability` (`lib/indexability.ts`), que decide y explica la decisión en una frase:

1. **Requisitos, todos:** marca, modelo y año, y la base técnica de la pala: peso, núcleo, caras y tacto (o dureza). Sin ellos la página no puede describir la pala.
2. **Dos de estos tres pilares:**
   - **precio:** precio vigente en alguna tienda (uno caducado no cuenta);
   - **foto:** foto real del producto, no una ilustración;
   - **perfil:** para quién es, con al menos dos de balance, nivel y estilo de juego.

Tener precio no basta (precio sin foto ni perfil no entra), y una pala sin precio pero con foto y perfil sí entra, como ficha de consulta. La descripción, «De un vistazo» y las preguntas frecuentes se generan con esos mismos datos, así que no se miden aparte.

| Ficha | Con la indexación activada | Sitemap |
|---|---|---|
| Apta | `index, follow` | Sí |
| No apta | `noindex, follow`; sigue publicada y enlazada | No |

La misma función decide en los dos sitios: los metadatos de la ficha (`app/pala/[slug]/page.tsx`) y la lista del sitemap (`getIndexablePalas`). Con los datos de octubre de 2026 son aptas 316 de las 785 fichas: 245 con precio y 71 sin él. La cifra cambia sola según entren precios, fotos o datos.

Lo que cuelga de las fichas sigue la misma regla (`selectForSitemap`, `isIndexableComparison`):

| Página | Entra en el sitemap si… | Hoy |
|---|---|---|
| Ficha | es apta | 316 de 785 |
| Marca | tiene al menos una ficha apta | 17 de 22 |
| Comparación | es curada (palas «parecidas») y sus dos fichas son aptas; solo entonces es además `index` | 6 |

Con las cuatro páginas generales (portada, catálogo, ofertas y comparador), el sitemap tendría hoy 343 direcciones. Una marca sin fichas aptas sale del sitemap, pero su página no pasa a `noindex`.

Una ficha sin precio vigente tampoco lo promete: su título es «…: características y ficha técnica» en lugar de «…: características, precio y tiendas», y su descripción no menciona el precio por tienda (`palaTitle`, `metaDescription`).

Mientras `NEXT_PUBLIC_ALLOW_INDEXING` no valga `true`, nada de esto tiene efecto: todas las páginas siguen en `noindex` y el sitemap sale vacío.

## Funciones que todavía no existen

La web solo presenta lo que funciona. Lo demás conserva su código y su ruta, pero no se enlaza desde ningún sitio:

- **Escáner** (`/escanear/`, `components/pala/ScannerBanner.tsx`): la página dice «en preparación». Sin botón en la cabecera, en la portada ni flotante en móvil.
- **Opiniones de jugadores:** el diseño las enseña en la ficha, las tarjetas y la portada, pero no hay ninguna real y no se inventan. Los bloques existen y aparecerán cuando haya opiniones.
- **Cuentas de usuario** («Guardar», «Mi cuenta»): no existen. «Mis alertas» funciona sin cuenta, con un enlace enviado al correo.
- **Alertas de precio:** solo se ofrecen si pueden enviarse (ver «Alertas de precio»).

Un test (`tests/ui/available-features.test.ts`) impide que una página en uso vuelva a enlazar al escáner.

## Guías y colecciones

El contenido que no sale de la base de datos vive en `content/` y tiene dos piezas, pensadas para las búsquedas que no son de una pala concreta.

**Colecciones** (`content/collections.ts`, `/palas-padel/{coleccion}/`): quince páginas por forma (redondas, lágrima, diamante, híbridas), juego (control, potencia, polivalentes, manejables), nivel (principiantes, intermedio, avanzado), precio (menos de 100, 150 y 200 €) y temporada (2026). Una colección puede combinar filtros («manejables» es forma redonda y balance bajo declarados): una pala solo entra si cumple todos. Cada una es un filtro del catálogo con titular, texto que explica el criterio, las palas que lo cumplen (con cuántas tienen precio hoy y desde cuánto), preguntas frecuentes con JSON-LD y enlaces a colecciones afines, a su guía y a las marcas.

- Comparten nivel de URL con las marcas: `app/palas-padel/[marca]/page.tsx` atiende las dos (un test impide que un slug coincida).
- Son indexables y canónicas de sí mismas. El catálogo con esos mismos filtros (`?forma=redonda`) las declara como canónica (`collectionForQuery`, `catalogSeo`); cualquier otra combinación sigue en `noindex`.
- Se enlazan desde la portada, el catálogo, el pie, las guías, las páginas de marca y cada ficha («Más palas como esta», `collectionsForPala`).

**Guías** (`content/guides.ts`, `/guias/` y `/guias/{slug}/`): once guías (elegir pala, formas, balance, dureza, cuánto gastar, valorar una oferta, temporada anterior y cuatro selecciones) según el diseño (índice lateral, firma y fecha, apartados numerados con tarjeta de pala, «¿Aún con dudas?», preguntas frecuentes) con JSON-LD de artículo.

- **El texto** es conocimiento general de pádel escrito para PalaRadar: qué significa cada característica y a quién le conviene. No nombra palas concretas ni cita pruebas u opiniones propias (hay un test que lo comprueba).
- **Las palas no están escritas en la guía.** Cada apartado es un filtro del catálogo, y la página enseña la pala a la venta con mejor puntuación técnica total de PadelZoom que lo cumple (`getTopRatedPalas`, `resolveGuidePicks`), sin repetir pala entre apartados. Lo que se dice de ella sale de sus datos (`lib/guides.ts`): el criterio con su cifra, sus notas más alta y más baja y sus características declaradas. Así una guía no recomienda una pala agotada ni cita un precio viejo, y «las mejores» significa siempre «las mejor puntuadas por PadelZoom entre las que tienen precio hoy», dicho en la propia página.
- Las fotos de las guías son las fotos reales de las palas que seleccionan.
- Para añadir una guía o una colección basta con añadirla a su archivo: las rutas, el sitemap y los enlaces salen de ahí.

## Imágenes de producto

Cada pala enseña, por este orden: su foto real publicada, su ilustración propia o la ilustración genérica de su forma. La elección se hace en la capa de datos (`lib/media.ts`) y `PalaPhoto` la pinta en todas las pantallas.

- **Dónde están:** las fotos se describen en `racket_media` (origen, copia propia, dimensiones, huella, estado) y los archivos viven en el bucket público `media` de Supabase Storage (`rackets/{id}/primary.jpg`). La web no enlaza imágenes de otras webs.
- **Qué se publica:** solo las imágenes `verified` (controles técnicos de `media/inspect.ts`), aprobadas (`rights_status = approved`) y con copia guardada. Las demás quedan `pending` (revisión manual) o `rejected`, y la pala sigue con su ilustración. La misma imagen se usa en listados y en la ficha.
- **Controles:** JPG, PNG, WebP o AVIF válido; lado corto de 375 px o más (`MIN_SHORT_SIDE`; basta para la tarjeta y para la ficha en móvil, y era de 500 hasta octubre de 2026); fondo blanco, gris claro o transparente; una sola pala en vertical y sin cortar. Quedan pendientes las duplicadas entre palas y las de asociación dudosa. Un precio, texto o marca de agua sobre fondo blanco no se detecta automáticamente.
- **Derechos:** `rights_status` es nuestro estado interno de aprobación para mostrar la imagen, **no** una licencia ni una afirmación de titularidad; la base de la decisión va en `rights_note`. Las imágenes de PadelZoom son fotos de catálogo de los fabricantes y están pensadas para sustituirse por otras de fuentes con derechos claros.
- **Sustituir imágenes:** una imagen de otra fuente se añade como otra fila de la misma pala; a igual rol y posición se publica la importada más recientemente, y su archivo no pisa el anterior. Para retirar todas las de una fuente basta pasar su `rights_status` a `rejected`.
- **Importar:** `npm run media:import` descarga lo pendiente de una fuente, lo valida, lo guarda y lo clasifica; se puede repetir sin riesgo. `-- --dry-run` analiza sin guardar y `-- --recheck` vuelve a pasar los controles a todas (tras cambiar criterios). `npm run media:report` resume estados, cobertura y espacio; `npm run media:review` genera `var/media-review.html` con las pendientes que hay que mirar a mano.
- **Variables:** `SUPABASE_URL` (la web la usa para servir las fotos) y `SUPABASE_SERVICE_ROLE_KEY` (secreta: solo la leen los scripts de importación; no se configura en el hosting de la web ni lleva prefijo `NEXT_PUBLIC_`). Ver `.env.example`.
- **Rendimiento:** se guarda el original; `next/image` sirve cada tamaño optimizado y el marco fija el tamaño, sin saltos de maquetación.
- **Mejora pendiente:** las fotos con fondo gris claro (unas 50, sobre todo Drop Shot, Kombat, Varlion y Wilson) se publican, pero su recuadro se nota sobre el marco de la web. Integrarlo exigiría recortar el fondo de esas imágenes o conseguir versiones con fondo blanco.

## Ficha de pala

La ficha solo enseña bloques con datos reales detrás; un bloque sin datos no aparece (no hay avisos de «todavía no…»). Orden en móvil: cabecera (foto, nombre, precio de partida, ver precios y crear alerta) → descripción → mejor precio → precios por tienda → «De un vistazo» → ¿Cómo se siente jugando? → ¿está barata? (histórico) → alerta → otras temporadas y palas parecidas → especificaciones completas → preguntas frecuentes. En escritorio el precio va en una columna fija a la derecha.

- **Precio frente al PVPR** (`msrpSaving` en `lib/pricing.ts`): si la pala declara precio recomendado y el mejor precio vigente está por debajo, la tarjeta de precio lo dice («X % por debajo de su PVPR») y enseña los dos importes. Es una comparación con un dato declarado, no un veredicto sobre el histórico.
- **Histórico de precios** (`PriceHistory`, `PriceChart`): periodos de 1, 3 y 6 meses, con 1 mes por defecto. El eje es proporcional al tiempo y, con 45 puntos o menos, cada día registrado lleva su marca.
- **Palas parecidas** (`lib/similar.ts`): primero las alternativas curadas; si no hay, palas con precio vigente que comparten forma y, donde se declara, balance, estilo o nivel, con la coincidencia escrita en cada tarjeta; como último recurso, otras de la marca. No hay puntuación de parecido.
- **Otras temporadas** (`ModelSeasons`, `lib/seasons.ts`): las ediciones de otros años del mismo modelo (misma marca y mismo nombre de modelo), enfrentadas con la de la ficha: qué cambia en lo que las dos declaran, qué se mantiene, qué no se puede comparar y la diferencia de precio de hoy en euros y en tanto por ciento. La frase de cierre solo aparece con precio vigente en las dos y nunca dice que una edición sea mejor.
- **Alternativas por objetivo** (`lib/alternatives.ts`, `Alternatives`): bajo las parecidas, pestañas «Más barata», «Priorizar control», «Priorizar potencia», «Polivalente», «Priorizar manejabilidad», «Otra marca», «De temporadas anteriores» y «Hasta 100/150/200 €». Cada modo descarta primero lo que no cumple su requisito y ordena por una puntuación fija de parecido (forma 3, balance 2, estilo 2, nivel 2, tacto 1, peso 1; un dato que la candidata no declara resta 0,5 y nunca se da por igual). Cada alternativa lleva sus motivos: diferencia de precio, qué comparte, qué cambia y qué no se ha podido verificar. Solo aparecen los modos con resultados.
- **Estadísticas de precio e índice de oportunidad** (`lib/price-stats.ts`, `PriceStatsPanel`): media, mínimo, máximo, variación y días con precio registrado de los últimos 30 y 90 días, solo cuando el seguimiento cubre el periodo. El índice (0–100) parte de 50 y suma hasta ±30 por la distancia a la media de 30 días, ±15 por la posición entre el mínimo y el máximo y ±5 por la tendencia de la última semana; va con su nivel de confianza y sus motivos. Con menos de 30 días se dice cuánto histórico hay y cuánto falta.
- **Datos no disponibles y puntos fuertes** (`missingData`, `scoreHighlights`): la tabla de especificaciones nombra lo que la pala no declara, y «¿Cómo se siente jugando?» dice dónde puntúa más alto y más bajo en PadelZoom, solo si las notas se diferencian.
- **Tiendas** (`StoreList`, `lib/outbound.ts`): cada enlace a tienda es el producto real, sin redirección intermedia, con `rel="noopener nofollow sponsored"`. Donde el envío no está verificado se indica, el importe es solo el de la pala y ninguna tienda se señala como «la más barata» (`totalsComparable`).
- **¿Para quién es?** («Ideal para» / «Puede no ser para ti si»): se muestra siempre que la pala tenga esos datos, como en el diseño.

- **Texto con los datos de cada pala** (`lib/pala-content.ts`): la descripción, «De un vistazo», las especificaciones y las preguntas frecuentes se construyen con lo que la pala declara. Las explicaciones dicen qué significa un atributo en general; no valoran la pala.
- **Puntuaciones técnicas de PadelZoom:** sus puntuaciones (potencia, control, salida de bola, manejabilidad, punto dulce y total) se enseñan en «¿Cómo se siente jugando?» con ese título y el aviso «Datos heredados de PadelZoom. No son valoraciones propias de PalaRadar». No son opiniones de usuarios ni notas de PalaRadar. Los análisis escritos de PadelZoom no se usan.
- **Opiniones:** el bloque no se muestra mientras no haya opiniones reales.
- **SEO:** título y descripción con los datos de la pala, JSON-LD de producto con EAN, referencia y características, JSON-LD de preguntas frecuentes, y enlaces a la marca, a palas relacionadas y al comparador.

## Catálogo y portada

- **Comparar desde los listados** (`components/compare/CompareSelection.tsx`, `lib/compare-selection.ts`): cada tarjeta del catálogo y de las ofertas lleva un botón «Comparar». Con dos palas elegidas (`MIN_SELECTED`) una barra fija enlaza a su comparación, y se puede añadir una tercera (`MAX_SELECTED`). La selección vive en `sessionStorage`: no hay cuentas ni se guarda nada en el servidor.
- **Favoritas** (`lib/favorites.ts`, `components/favorites/`, `/favoritos/`): el corazón de cada tarjeta y de la ficha guarda la pala en este navegador (`localStorage`, hasta 30), con el precio de ese día. `/favoritos/` las lista con su precio de hoy (`/api/palas/?slugs=`) y dice cuánto ha bajado o subido cada una desde que se guardó. Sin cuenta ni correo; si el navegador no deja guardar, se avisa.
- **Compartir una comparación** (`components/ui/CopyLinkButton.tsx`): la dirección de la comparación ya es estable y solo lleva los slugs; el botón abre el menú de compartir del sistema o copia el enlace.
- **Cuadrícula:** cuatro tarjetas por fila en escritorio (`PalaGrid` con `dense` junto a los filtros) y dos en móvil.
- **Portada:** «Ofertas de hoy» ocupa la fila entera a partir de tres ofertas (`FULL_ROW_DEALS`); con menos, comparte fila con «Mayores bajadas del mes» para no dejar huecos. «En más tiendas» enseña cuatro palas: en fila en móvil y en tarjetas con foto en escritorio. La pala de la cabecera usa su foto real si la tiene.

## Comparador

`/comparar/` es la herramienta y `/comparar/{a}-vs-{b}/` (o `{a}-vs-{b}-vs-{c}/`) el resultado, según el diseño de `design_handoff_comparar`. Compara dos o tres palas (`MAX_COMPARED`); cada una lleva siempre su letra (A, B, C) además del color, también en las barras.

- **Selector** (`components/compare/CompareSelector.tsx`, `PalaPicker`, `CompareSlot`): huecos con buscador de marca o modelo, «+ Añadir otra pala» y «Comparar palas». La selección viaja en la URL (`?a=…&b=…&c=…`, y `palas=3` para abrir el tercer hueco vacío), así que funciona sin JavaScript; con él, el buscador sugiere palas mientras se escribe (`/api/palas/`).
- **URLs** (`lib/compare.ts`): las palas van en orden alfabético de slug (`compareSetPath`); cualquier otro orden, o una pala repetida, redirige a la canónica (`resolveComparison`). Solo son indexables las comparaciones curadas de dos palas entre fichas aptas; las de tres van siempre en `noindex`.
- **Resultado** (`lib/compare-insights.ts`): «¿Cuál elegir?», «Rendimiento», «¿Cuál sale mejor de precio?», ficha técnica, comparaciones relacionadas y preguntas frecuentes. Todo se genera con datos: puntuaciones técnicas de PadelZoom (siempre con su nombre; PalaRadar no puntúa), atributos declarados, precios vigentes y PVPR. Sin el dato, la frase o el bloque no aparece. Una ventaja entra como «Más…» con un punto o más de diferencia (`NOTABLE_SCORE_GAP`) y como «Algo más de…» por debajo; con menos de 0,3 puntos son «muy parecidas» (`SIMILAR_SCORE_GAP`).
- **Comparaciones destacadas** (`pickFeaturedPairs`): pares curados (palas «parecidas») en los que las dos tienen precio vigente y foto real. No hay datos de visitas, así que no se llaman «populares» ni son un ranking.
- **Comparaciones recientes** (`RecentComparisons`, `getRecentComparisons` en `data/`): el componente está hecho, pero hoy no se registra qué comparaciones se abren; la actividad va vacía y el bloque no aparece. Se enseñará a partir de 20 comparaciones en siete días (`RECENT_MIN_WEEKLY`). Nunca se rellena con ejemplos.
- **Fotos:** las mismas de toda la web (`PalaPhoto` y `lib/media.ts`): la foto real publicada en Supabase Storage o, si la pala no tiene, su ilustración.

## Alertas de precio

Sin cuentas de usuario. Desde la ficha se elige un precio objetivo y se deja un correo; la alerta no se activa hasta confirmar el enlace que llega por correo (doble confirmación). Después de cada ingestión de precios (`npm run prices:ingest`) se comprueban las alertas activas y se avisa, una sola vez, a las que se cumplen con un precio vigente; `npm run alerts:send` lo hace a mano. Todos los correos llevan enlace de baja.

- **Código:** `alerts/` (servicio, repositorio y correos), `app/alertas/` (acciones y páginas de confirmación y baja) y la tabla `price_alerts`.
- **Protecciones:** validación del correo, consentimiento obligatorio, campo trampa, límite de alertas por correo y por conexión (se guarda una huella de la IP, no la IP) y una sola alerta abierta por pala y correo.
- **Variables:** `RESEND_API_KEY` y `ALERTS_FROM_EMAIL` (remitente de un dominio verificado en Resend), y `ALERTS_SECRET` (una cadena larga y aleatoria: firma los enlaces de «Mis alertas»; sin ella esa página no ofrece el acceso). Los enlaces usan `NEXT_PUBLIC_SITE_URL`.
- **Mis alertas** (`/mis-alertas/`, `alerts/access.ts`): sin cuentas. Se pide con el correo un enlace firmado, válido 7 días, que lista sus alertas (avisadas, activas y pendientes) y permite quitarlas. La respuesta es la misma tenga o no alertas ese correo, y solo se envía a quien las tiene. Sin enlace, la página enseña el estado vacío del diseño.
- **En local:** sin Resend, `next dev` usa un buzón de desarrollo: los correos se escriben en la terminal en vez de enviarse (`usesConsoleMailer` en `alerts/email.ts`), con los enlaces apuntando a `http://localhost:3000`. Así las alertas y «Guarda tus resultados» se ven y se prueban de principio a fin. Las alertas que se creen se guardan en la base de datos configurada. Nunca se usa en Vercel.
- **«Guarda tus resultados»** (quiz): un solo correo con las palas recomendadas y un aviso de bajada sin confirmar por cada una (`saveResults`); un único enlace los confirma todos.
- **Disponibilidad:** en el despliegue, sin las dos primeras variables las alertas no se ofrecen: la ficha no enseña ni el botón ni el formulario, y el recomendador no enlaza a ellas (`alerts/availability.ts`, `alertsAvailable()` en `data/`). No se crea ninguna alerta. Para activarlas basta con configurar las variables y volver a desplegar; no hay que tocar código. Una pala sin precio enseña entonces, en lugar de la alerta, un enlace a palas de su misma forma que sí están a la venta.
- **Conservación:** las alertas sin confirmar se borran a los 7 días y las cerradas (avisadas o dadas de baja) a los 30; las activas se conservan hasta que se cumplen o se dan de baja. El borrado va con la comprobación de alertas (tras la ingestión o con `npm run alerts:send`). Los plazos están en `alerts/service.ts`.
- **Privacidad:** `/privacidad/` cuenta qué se guarda, para qué, cuánto tiempo, cómo darse de baja y qué proveedores intervienen (Resend y Supabase). Describe lo que hace el código: si cambia, hay que cambiar la página. El correo de contacto sale de `NEXT_PUBLIC_CONTACT_EMAIL`.
- **Pendiente antes de publicar:** configurar Resend y probar un envío real (todavía no se ha enviado ningún correo de verdad), definir `ALERTS_SECRET`, publicar un correo de contacto y la identidad del responsable en la política de privacidad, y programar la ingestión.

## Pala ideal

`/pala-ideal/` es un quiz de seis preguntas (nivel, juego, lado, forma, tacto y presupuesto) según el diseño del handoff. Las respuestas viajan en la URL y el resultado se calcula y se renderiza en servidor (`lib/recommender.ts`). Presupuesto y forma elegida son filtros; el resto ordena por afinidad. El tacto (blando, medio-blando, medio, duro o «me da igual») se compara con el tacto que declara la pala y, si no lo declara, con su dureza. Cada pala lleva su **porcentaje de afinidad** (`affinity`): la fórmula del diseño, con base 62 y puntos por nivel (+12, o −8 si la pala declara niveles y el tuyo no está), estilo (+12; contiguo, +4), forma (+6; sin forma elegida, +4 si es la habitual de tu estilo), tacto (+4) y lado (+3), con tope en 97. Es determinista y sale solo de datos declarados; debajo se indica cuántas preferencias cumple. A igual afinidad va primero la más barata hoy (`rankRecommendations`); el precio solo desempata, no cambia el porcentaje. El lado de la pista se traduce a una preferencia de balance, como orientación.

El resultado dice también lo que la mejor opción **no** cumple o no se ha podido comprobar (`buildTradeoffs`), enlaza al catálogo filtrado con el mismo perfil (`profileCatalogQuery`: nivel, estilo, forma y presupuesto) y recuerda el perfil en el navegador (`parseSavedProfile`, solo la dirección del resultado) para ofrecerlo de nuevo en el catálogo.

## Calidad de datos, buscador y comparación entre tiendas (V5)

El detalle, las fórmulas y lo pendiente están en `docs/roadmap-v5.md`.

- **Panel interno de calidad** (`quality/`, `npm run quality:report`): solo lectura. Genera `var/quality-report.html` con las métricas de cobertura del catálogo, las incidencias clasificadas por naturaleza (error confirmado, posible error, dato ausente, dato antiguo, necesita revisión) y, para cada producto de tienda pendiente, hasta tres palas candidatas con su puntuación y sus motivos. No confirma ni corrige nada. Es un comando y no una página porque la web no tiene autenticación de administración.
- **Buscador en lenguaje natural** (`lib/catalog/search-intent.ts`): «pala redonda por menos de 120 euros» se convierte en los filtros del catálogo, con diccionarios y reglas (sin IA). Sobre los resultados se dice qué se ha interpretado y cada criterio se puede quitar. Lo ambiguo se busca como texto; sin resultados, se dice qué criterio limita.
- **Cobertura de precio** (`CatalogQuery.coverage`): filtro «Precio disponible» con «Con precio hoy» y «En 2 tiendas o más», con la misma regla de vigencia que el resto.
- **Diferencia entre tiendas** (`lib/store-spread.ts`, `StoreSpreadNote`): con dos precios vigentes de la misma pala, la diferencia en euros y en tanto por ciento sobre el precio más alto, calculada en céntimos. Si falta algún envío por verificar se compara el precio de la pala y se dice. Está en la ficha, en el comparador y en un informe.
- **Confianza de los datos** (`lib/data-confidence.ts`, `DataReliability`): una sola definición del estado del precio (reciente, antiguo, sin confirmar, sin precio), del estado de un atributo (verificado, declarado, deducido, desconocido) y de para qué funciones alcanza lo que se sabe de una pala. La relación entre temporadas es provisional y así se indica.
- **Vocabulario común** (`lib/vocabulary.ts`): forma, estilo, balance, nivel, tacto o dureza y peso llevados a los valores del catálogo. Lo que no se reconoce queda como desconocido.
- **Informes** (`lib/reports.ts`, `/informes/`): diferencias entre tiendas, ediciones anteriores, cobertura por marca y palas por presupuesto, cada uno con su método y sus límites a la vista. En `noindex` y fuera del sitemap.
- **Cambiar de pala** (`/pala-ideal/mi-pala/`, `findUpgrades`): a partir de la pala que se usa, qué conservar, qué cambiar y un presupuesto. Usa el motor de las alternativas.

## Analítica, afiliación y escáner (desactivados)

Tres piezas preparadas que no hacen nada hasta que se configuren; el detalle está en `docs/roadmap-v4.md`.

- **Analítica** (`lib/analytics.ts`, `components/analytics/`): una capa de eventos de producto (búsqueda, ficha vista, comparación, alternativa consultada, favorita, clic de salida a tienda, guía, quiz…) con una lista cerrada de propiedades por evento; cualquier valor con pinta de correo o de token se descarta. Sin `NEXT_PUBLIC_ANALYTICS_PROVIDER` no se mide nada ni se carga ningún script de terceros. Un clic de salida no es una compra y no se presenta como tal.
- **Afiliación** (`config/affiliates.ts`, `lib/outbound.ts`): la lista de programas está vacía. Dar de alta una tienda con los parámetros de su programa hace que sus enlaces los lleven; el destino sigue siendo la página del producto.
- **Escáner** (`lib/scanner.ts`): el contrato de un proveedor de visión y las reglas de lo que se podría enseñar (candidatos del catálogo con confianza suficiente, nunca una certeza). No hay proveedor: `scannerAvailable()` es `false` y la web no ofrece la función.

## Ilustraciones

`npm run art` genera en `public/img/` una ilustración por pala del seed, la de portada y las de guías. Son arte propio sin logotipos, no fotos del producto: son el respaldo de las palas que todavía no tienen foto publicada.

## Pendiente

- Precios reales: adaptadores de tiendas reales (pendientes de autorización o feed) y la tarea programada que los ejecute.
- Revisar a mano las palas de `source: "tienda"` y los campos `pending`.
- Texto editorial revisado y opiniones reales.
- Escáner IA, opiniones reales, registro de comparaciones recientes y cuentas de usuario.
- Fotos reales de las palas que siguen con ilustración (imágenes pendientes de revisión u otras fuentes).
