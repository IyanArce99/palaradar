# PalaRadar

El lugar al que vas antes de comprar una pala de pádel: catálogo, opiniones de jugadores, para quién es cada pala, precios por tienda e histórico. Español de España, mobile-first.

**Objetivo:** convertir el diseño V3 en un producto real. La interfaz está implementada; la capa de datos está preparada para PostgreSQL/Supabase pero hoy funciona con una semilla de ejemplo. Precios, tiendas y opiniones son **ficticios**.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind CSS 4. Sin más dependencias de ejecución.

## Ejecutar

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de producción
npm run lint
npx tsc --noEmit # comprobación de tipos
```

Variables de entorno (opcionales):

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Dominio para canónicas y sitemap. Por defecto `https://palaradar.es` |
| `NEXT_PUBLIC_ALLOW_INDEXING` | `true` para permitir la indexación. Sin ella, todo el sitio va con `noindex` y `robots.txt` lo bloquea |

## Estructura

```
app/          Rutas, metadata, sitemap y robots
components/   layout/ · ui/ · pala/ · catalog/ · ficha/ · home/ · seo/
config/       Sitio y navegación
content/      Contenido editorial que no vive en base de datos (guías)
data/         Capa de acceso a datos (lo único que importan las páginas)
  repository.ts         Contrato CatalogRepository
  memory-repository.ts  Implementación en memoria sobre la semilla
  mappers.ts            Filas de BD → modelos de dominio
  seed/                 Semilla de ejemplo con la forma de las tablas
db/schema.sql PostgreSQL: tablas, índices y vistas
lib/          Lógica pura: precios, formato, consulta del catálogo, SEO
types/        catalog.ts y pricing.ts (dominio) · db.ts (filas de BD)
scripts/      generate-art.mjs
```

## Rutas

| Ruta | Render | Estado |
|---|---|---|
| `/` | Estática, se regenera cada hora | Completa |
| `/palas-padel/` | Servidor (filtros en la URL) | Completa |
| `/palas-padel/[marca]/` | Servidor (paginación) | Completa |
| `/pala/[slug]/` | Estática por pala, se regenera cada hora | Completa |
| `/ofertas/` | Estática, se regenera cada hora | Completa |
| `/comparar/`, `/guias/`, `/escanear/` | Estática | Preparadas, sin funcionalidad |

## Arquitectura de datos

```
páginas → @/data → CatalogRepository → memory-repository (hoy) | Supabase (siguiente fase)
```

- **Dos familias de tipos.** `types/db.ts` describe las filas tal y como están en PostgreSQL (snake_case). `types/catalog.ts` describe lo que consumen los componentes (`Pala`, `PalaSummary`). `data/mappers.ts` convierte de unas a otras y lo reutiliza cualquier repositorio.
- **Tablas** (`db/schema.sql`): `brands`, `rackets`, `stores`, `store_prices` (precio actual por pala y tienda), `price_history` (precio por pala, tienda y día), `reviews`, `racket_alternatives` y `racket_price_stats`.
- **`racket_price_stats`** guarda una fila por pala con sus agregados (mejor precio, descuento, media de 90 días, mínimo, precio de hace 30 días, estado). Existe para que el catálogo filtre y ordene por precio en SQL sin recorrer el histórico. La recalcula el proceso que actualice precios, con `computePriceStats` de `lib/pricing.ts`.
- **El catálogo consulta una vista**, `racket_catalog`. Filtros, búsqueda, orden y paginación se resuelven dentro de `searchCatalog`, que devuelve solo la página pedida y el total.
- **Pasar a Supabase:** implementar `CatalogRepository` contra las tablas y asignarlo en `data/index.ts`. Páginas y componentes no cambian.

### Datos de ejemplo

`data/seed/` contiene siete palas con la misma forma que las tablas. `data/seed/index.ts` genera a partir de ellas las filas de precios, histórico, opiniones y alternativas. `memory-repository.ts` construye al cargar los agregados y la vista, y responde a cada consulta como lo haría un `SELECT`.

Mientras se use la semilla, `isDemoData` es `true`: la interfaz avisa de que los datos son de ejemplo y el JSON-LD no publica valoraciones ni ofertas.

### Fechas y precios

La fecha actual es un dato de entrada, no "el último registro del histórico":

- **Reloj.** Cada repositorio define su `now()`. Con datos reales es la hora actual; con la semilla se fija en `SEED_SNAPSHOT_AT` para que los precios de ejemplo no caduquen.
- **Última actualización.** Cada precio lleva `last_updated`. Si pasan más de 48 horas (`PRICE_STALE_AFTER_HOURS`), el precio se considera desactualizado: no se emite veredicto, el gráfico termina en el último registro y no se publica como oferta.
- **Histórico.** Las ventanas (media de 90 días, bajada del mes) se cuentan desde hoy. Si el precio está al día y aún no hay registro de hoy, el gráfico añade el precio actual como último punto.

## SEO

- HTML completo en servidor; un `h1` por página; title, description y canónica propios.
- JSON-LD de migas de pan en todas las páginas con ruta y de producto en la ficha.
- `sitemap.xml` con portada, catálogo, ofertas, marcas y fichas.

**Paginación** (pensada para 1.000–2.000 palas, 24 por página):

| URL | Indexable | Canónica |
|---|---|---|
| `/palas-padel/` y `?pagina=N` | Sí | Ella misma |
| `/palas-padel/{marca}/` y `?pagina=N` | Sí | Ella misma |
| `?marca=x` como único filtro | Sí | `/palas-padel/x/` |
| Cualquier otro filtro, orden o búsqueda | No (`noindex, follow`) | Ninguna |
| Página fuera de rango | 404 | — |

Las páginas 2 en adelante no apuntan a la primera porque su contenido es distinto. Se usa `?pagina=N` y no `/pagina/N/` porque esa ruta chocaría con `/palas-padel/[marca]/`. La lógica está en `lib/catalog/seo.ts`.

## Ilustraciones

```bash
node scripts/generate-art.mjs
```

Genera en `public/img/` una ilustración por pala, la de portada y las de guías. Son arte propio sin logotipos, no fotos del producto. Para usar recortes reales, cambiar `images` en la semilla o en la base de datos.

## Implementado

- Layout, cabecera, pie y barra inferior móvil.
- Portada, catálogo con filtros y paginación, páginas de marca, ficha de pala y ofertas.
- Veredicto de precio en lenguaje natural e histórico de 3, 6 y 12 meses.
- Modelo de datos, esquema SQL, repositorio y semilla.

## Pendiente

- Repositorio sobre Supabase y carga de la semilla.
- Proceso de actualización de precios que rellene `price_history` y `racket_price_stats`.
- Comparador, guías individuales, escáner IA, alertas y cuentas de usuario.
- Subpáginas de opiniones e histórico; galería de fotos; filtros de potencia, control y peso.
- Fotos reales de producto e imagen Open Graph.
