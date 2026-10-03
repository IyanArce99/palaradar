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
```

Sin configurar nada, el proyecto arranca con los datos seed en memoria.

### Con base de datos

1. Copia `.env.example` como `.env.local` y pon tu `DATABASE_URL` (en Supabase: Project Settings → Database → Connection string).
2. `npm run db:migrate` — crea tablas, índices y vistas (`db/schema.sql`). No hace nada si ya existen; `-- --reset` las borra y recrea.
3. `npm run db:seed` — carga las palas y los precios de prueba, y calcula los agregados de precio. Sustituye el contenido de las tablas de PalaRadar.
4. `npm run db:stats` — recalcula los agregados después de cambiar precios a mano.

### Cambiar entre mock y base de datos

| `DATA_SOURCE` | Resultado |
|---|---|
| sin definir | Base de datos si `DATABASE_URL` está configurada; si no, seed en memoria |
| `mock` | Seed en memoria, aunque haya base de datos |
| `database` | Base de datos; falla al arrancar si no está configurada |

Las demás variables (umbrales de antigüedad del precio, `PRICES_ARE_REAL`, dominio, indexación) están documentadas en `.env.example`.

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
db/schema.sql PostgreSQL: tablas, índices y vistas
lib/          Lógica pura: precios, formato, consulta del catálogo, SEO
types/        catalog.ts y pricing.ts (dominio) · db.ts (filas de BD)
scripts/      db/ (migrate, seed, stats) · generate-art.ts
```

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
| Ficha | `rackets`, `brands`, `store_prices`, `stores`, `racket_price_daily` (sobre `price_history`), `reviews`, `racket_alternatives` + `racket_catalog` |
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

### Seed

`data/seed/rackets.ts` contiene 28 palas reales de 8 marcas. Cada una indica la página de la que salen sus datos; lo que la fuente no declara, o declara de forma ambigua, va en nulo. El campo `pending` recoge las dudas por revisar a mano. Varias marcas bloquean el acceso automático a su web, así que sus palas proceden de la ficha de una tienda (`source: "tienda"`) y conviene revisarlas.

- **Editorial:** borrador que resume lo que declara la fuente (`editorial_status = 'draft'`). Sin pros y contras ni puntuaciones de sensaciones.
- **Opiniones:** ninguna. Valoración y número de opiniones a cero.
- **Precios:** de prueba, generados de forma determinista a partir del precio de referencia y repartidos en tiendas ficticias. Se comprueban «ahora» al ejecutar el seed, salvo unas pocas palas que quedan a 30 horas y a 6 días para ver los tres estados. Caducan a las 48 horas: `npm run db:seed` los renueva.

Mientras los precios sean de prueba (`PRICES_ARE_REAL` distinto de `true`), la web lo avisa y el JSON-LD no los publica como ofertas.

## SEO

- HTML completo en servidor; un `h1` por página; title, description y canónica propios.
- JSON-LD de migas de pan y de producto. Las ilustraciones no se publican como imagen de producto.
- `sitemap.xml` con portada, catálogo, ofertas, marcas y fichas.

**Paginación** (24 palas por página; lógica en `lib/catalog/seo.ts`):

| URL | Indexable | Canónica |
|---|---|---|
| `/palas-padel/` y `?pagina=N` | Sí | Ella misma |
| `/palas-padel/{marca}/` y `?pagina=N` | Sí | Ella misma |
| `?marca=x` como único filtro | Sí | `/palas-padel/x/` |
| Cualquier otro filtro, orden o búsqueda | No (`noindex, follow`) | Ninguna |
| Página fuera de rango | 404 | — |

Todo el sitio va con `noindex` hasta definir `NEXT_PUBLIC_ALLOW_INDEXING=true`.

## Ilustraciones

`npm run art` genera en `public/img/` una ilustración por pala del seed, la de portada y las de guías. Son arte propio sin logotipos, no fotos del producto. Para usar fotos reales, cambiar `images` en la tabla `rackets`.

## Pendiente

- Precios reales: proceso que actualice `store_prices`, escriba `price_history` y ejecute el recálculo de agregados.
- Revisar a mano las palas de `source: "tienda"` y los campos `pending`.
- Texto editorial revisado y opiniones reales.
- Comparador, guías individuales, escáner IA, alertas y cuentas de usuario.
- Fotos reales de producto e imagen Open Graph.
