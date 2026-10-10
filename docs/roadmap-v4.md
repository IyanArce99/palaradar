# PalaRadar V4: hallazgos, lo implementado y lo que queda

Fecha: 9 de octubre de 2026. Punto de partida: commit `9d5d3ed`, que es lo que sirve producción. Todo lo descrito aquí está en la carpeta de trabajo, **sin confirmar ni publicar**.

La auditoría previa al trabajo está en [auditoria-completa-palaradar.md](auditoria-completa-palaradar.md); este documento no la repite. Recoge qué se ha decidido hacer en V4, qué se ha hecho, cómo funciona lo nuevo y qué depende de terceros.

## Índice

1. [Estado inicial](#1-estado-inicial)
2. [Inventario funcional tras V4](#2-inventario-funcional-tras-v4)
3. [Lo implementado, por fase](#3-lo-implementado-por-fase)
4. [Fórmulas](#4-fórmulas)
5. [Alertas: cómo probar el ciclo completo](#5-alertas-cómo-probar-el-ciclo-completo)
6. [Analítica](#6-analítica)
7. [Monetización](#7-monetización)
8. [Escáner](#8-escáner)
9. [SEO y plan de redirecciones](#9-seo-y-plan-de-redirecciones)
10. [Pendiente](#10-pendiente)

## 1. Estado inicial

| Comprobación | Resultado antes de empezar |
|---|---|
| Rama y commit | `main`, `9d5d3ed` |
| Cambios sin confirmar | Solo los documentos de la auditoría, en `docs/` |
| `npm run typecheck` | 0 errores |
| `npm run lint` | 0 errores |
| `npm test` | 374 correctos, 0 fallidos |
| `npm run build` | Correcto, 283 páginas |
| Producción | Sirve `9d5d3ed`; indexación bloqueada |

**Entornos.** Local, GitHub Actions y producción comparten la misma base de datos. Por eso en V4:

- no se ha creado ninguna migración ni se ha cambiado el esquema, los permisos ni las políticas;
- no se ha ejecutado ningún comando que escriba en la base de datos;
- no se ha ejecutado `npm run test:db`, que escribe datos de prueba en la base real;
- las únicas consultas hechas son de lectura.

## 2. Inventario funcional tras V4

| Funcionalidad | Antes | Después de V4 |
|---|---|---|
| Catálogo y filtros | Funciona | Funciona; favoritas y comparar también en ofertas |
| Ficha | Funciona | Mejorada: alternativas por objetivo, temporadas comparadas, estadísticas de precio, datos no disponibles |
| Precios y tiendas | Funciona | Aviso de envío sin verificar; enlaces de salida medibles |
| Histórico | Parcial (7 días de datos) | Igual de datos; ahora dice cuánto histórico hay y cuánto falta |
| Índice de oportunidad | No existía | Implementado; aparecerá con 30 días de histórico |
| Comparador | Funciona | Botón de compartir; selección de hasta 3 palas desde los listados |
| Alternativas | Solo «parecidas» | 10 modos con motivos |
| Comparación de temporadas | Solo enlaces | Diferencias, coincidencias y precio |
| Quiz | Funciona | Añade pegas de la recomendación, enlace al catálogo y perfil recordado |
| Favoritos | No existía | Implementado en el navegador |
| Comparaciones compartibles | La URL ya lo era | Botón de compartir y copiar |
| Guías | 6 | 11 |
| Colecciones | 12 | 15 |
| Páginas de marca | Funciona | Sin cambios |
| SEO | Bloqueado a propósito | Sigue bloqueado; más contenido preparado |
| Analítica | No existía | Capa de eventos, desactivada |
| Monetización | Solo `rel="sponsored"` | Enlaces preparados para afiliación, sin ningún programa |
| Alertas | Bloqueadas por configuración | Igual; documentado cómo probarlas |
| Escáner | Solo una pantalla de espera | Contrato y reglas; sin proveedor ni interfaz |
| Opiniones | Solo interfaz | Sin cambios |
| Cuentas de usuario | No existen | Sin cambios; nada de V4 las necesita |

## 3. Lo implementado, por fase

### Fase 1. Núcleo del producto

| Qué | Dónde | Notas |
|---|---|---|
| Alternativas por objetivo | `lib/alternatives.ts`, `components/ficha/Alternatives.tsx`, `AlternativeTabs.tsx`, `getAlternativeCandidates` en `data/` | Una consulta de lectura por ficha con las palas a la venta; la puntuación es una función pura |
| Comparación de temporadas | `lib/seasons.ts`, `components/ficha/ModelSeasons.tsx` | Reutiliza `buildSpecRows` del comparador. En el catálogo hay 79 modelos con más de una temporada |
| Estadísticas e índice de oportunidad | `lib/price-stats.ts`, `components/ficha/PriceStatsPanel.tsx` | Sobre el histórico que ya existía; no se crea otro |
| Envío sin verificar | `components/ficha/StoreList.tsx` | No se afirma el total más bajo si falta un envío |
| Datos no disponibles y puntos fuertes | `missingData` y `scoreHighlights` en `lib/pala-content.ts` | `pickHighlights` de las guías usa ahora la misma función |

### Fase 2. Experiencia personalizada

| Qué | Dónde | Notas |
|---|---|---|
| Favoritas | `lib/favorites.ts`, `components/favorites/`, `app/favoritos/page.tsx` | `localStorage`; tope de 30; guarda slug, nombre, precio y día |
| Precio de hoy de las favoritas | `app/api/palas/route.ts` (`?slugs=`) | Solo lectura; slugs validados |
| Compartir comparación | `components/ui/CopyLinkButton.tsx` | Menú del sistema en móvil; copiar en escritorio |
| Selección de 3 palas | `lib/compare-selection.ts`, `CompareSelection.tsx` | Antes eran 2 |
| Perfil de jugador | `buildTradeoffs`, `profileCatalogQuery`, `parseSavedProfile` en `lib/recommender.ts`; `components/finder/ProfileMemory.tsx` | No se han añadido preguntas al quiz: las seis del diseño cubren lo que los datos permiten comparar |

### Fase 3. Contenido y SEO

| Qué | Dónde |
|---|---|
| Colecciones nuevas: menos de 200 €, manejables, híbridas | `content/collections.ts` |
| Guías nuevas: balance, dureza, temporada anterior, valorar una oferta, cuánto gastar | `content/guides.ts` |
| Colecciones con dos filtros | `collectionsForPala` en `lib/catalog/collections.ts` |
| «Cómo obtenemos los precios» en la portada | `PriceSourcesSection` en `components/home/HomeSections.tsx` |

Tamaño real de las colecciones nuevas: menos de 200 €, 219 palas; manejables, 36 (26 con precio); híbridas, 54 (43 con precio).

### Fase 4. Retención y monetización

| Qué | Dónde | Estado |
|---|---|---|
| Capa de eventos | `lib/analytics.ts`, `components/analytics/` | Desactivada por defecto |
| Clics de salida | `components/analytics/OutboundLink.tsx` | Enlace directo al producto; el registro depende de la analítica |
| Afiliación | `config/affiliates.ts`, `lib/outbound.ts` | Lista vacía |

### Fase 5. Escáner

`lib/scanner.ts`: contrato del proveedor, validación de la imagen, filtrado de candidatos y los cuatro finales posibles. Sin proveedor.

### Fase 6. Calidad

100 tests nuevos (de 374 a 474), todos de lógica pura. Tras la implementación se hizo una revisión adversarial que corrigió una veintena de defectos, ninguno grave; los de lógica tienen su test de regresión.

## 4. Fórmulas

### Parecido entre palas (alternativas)

| Atributo | Si coincide | Si la candidata no lo declara |
|---|---|---|
| Forma | +3 | — (siempre se conoce) |
| Balance | +2 | −0,5 |
| Estilo de juego | +2 | −0,5 |
| Nivel (alguno en común) | +2 | −0,5 |
| Tacto o dureza | +1 | −0,5 |
| Peso (puntos medios a 7 g o menos) | +1 | −0,5 |

- Un atributo que la pala de la ficha no declara no se compara.
- Un atributo que el modo ya exige (el estilo en «Más control») no puntúa.
- Con puntuación 0 o negativa, la pala no se propone.
- A igualdad: primero las que tienen foto, después el precio más cercano (o el más bajo en «Más barata») y, por último, el slug.

| Modo | Requisito obligatorio |
|---|---|
| Más barata | Al menos un 5 % menos, y misma forma o mismo estilo |
| Priorizar control, priorizar potencia, polivalente | Ese estilo de juego declarado |
| Priorizar manejabilidad | Balance bajo declarado |
| Otra marca | Otra marca y misma forma |
| De temporadas anteriores | Año anterior y misma forma, de cualquier marca |

Los rótulos dicen «priorizar» y no «más»: el modo exige un estilo o un balance declarado, pero no mide si la candidata tiene más control o más potencia que la pala de la ficha.

El tacto y la dureza se comparan como un mismo dato («medio» y «media» coinciden; «Dura, Media» y «Media, Dura» también).
| Hasta 100, 150 o 200 € | Precio de hoy dentro del tope, misma forma o estilo, y que el tope esté por debajo del precio de la pala |

### Índice de oportunidad

Escala de 0 a 100. Solo se calcula con 30 días de seguimiento, precio en al menos la mitad de esos días y un precio comprobado.

| Componente | Puntos |
|---|---|
| Punto de partida | 50 |
| Frente a la media de 30 días | 2,5 por cada 1 % por debajo (o por encima), hasta ±30 |
| Posición entre el mínimo y el máximo | +15 en el mínimo, −15 en el máximo |
| Tendencia de 7 días | +5 si ha bajado un 1 % o más; −5 si ha subido. Solo si hay un registro de entre 7 y 10 días atrás con el que comparar |

- La media es la misma con la que la ficha da su veredicto, para que las dos frases digan el mismo porcentaje.
- El mínimo y el máximo incluyen el precio de hoy, aunque todavía no tenga registro en el histórico.
- El índice no lleva rótulo propio («oportunidad», «precio habitual»): el titular sigue siendo el veredicto, que se calcula con otra regla, y dos etiquetas podrían contradecirse.

| Confianza | Condición |
|---|---|
| Alta | Precio comprobado hoy y registro en el 85 % de los días o más |
| Media | Registro en el 65 % de los días o más |
| Baja | El resto |

El veredicto que ya existía («buen momento para comprar», «precio normal», «puedes esperar») no cambia; el índice lo acompaña.

### Estadísticas por periodo

Media, mínimo, máximo, variación y días con precio de los últimos 30 y 90 días naturales, hoy incluido. Un periodo solo se enseña si el seguimiento empezó antes de su inicio y hay precio en al menos la mitad de sus días. La variación compara el precio de hoy con el que estaba vigente al empezar el periodo.

## 5. Alertas: cómo probar el ciclo completo

El código de las alertas no ha cambiado en V4. Siguen ocultas en producción porque faltan `RESEND_API_KEY`, `ALERTS_FROM_EMAIL` y `ALERTS_SECRET`.

**En local, sin enviar correos reales.** Las alertas que se creen se guardan en la base de datos configurada, que es la de producción: usa un correo tuyo y bórralas al terminar desde «Mis alertas».

1. Arranca `npm run dev`. Sin Resend, los correos se escriben en la terminal.
2. Abre una ficha con precio, pulsa «Crear alerta de precio» y pon un correo y un precio objetivo. El objetivo tiene que estar por debajo del precio actual: el formulario no admite otro.
3. Copia de la terminal el enlace de confirmación y ábrelo: la alerta pasa a activa.
4. Ejecuta `npm run alerts:send`. Mientras el precio no baje hasta el objetivo dirá que no hay nada que avisar, que es lo correcto. El aviso solo se puede ver cuando una tienda baje de verdad ese precio; **no cambies precios en la base de datos para forzarlo**. El envío del aviso, que se hace una sola vez, está cubierto por `tests/alerts/alerts.test.ts`.
5. Pide el enlace de «Mis alertas» con el mismo correo (necesita `ALERTS_SECRET` en `.env.local`) y quita la alerta, o usa el enlace de baja del correo.

**En producción, cuando haya credenciales.**

1. Define las tres variables en Vercel y vuelve a desplegar. El formulario aparece solo.
2. Define `RESEND_API_KEY` y `ALERTS_FROM_EMAIL` también como secretos del workflow de ingestión, que es quien envía los avisos.
3. Comprueba con qué rol se conecta ese workflow. El rol `palaradar_ingest` no tiene permisos sobre `price_alerts`: si es el que usa, el paso de alertas fallará (sin detener la ingestión). La corrección es conceder a ese rol `select`, `update` y `delete` sobre `price_alerts`; **no se ha aplicado**, porque es un cambio de permisos que debe autorizar el propietario.
4. Repite los pasos 2 a 5 de la prueba local con un correo real. Para ver el aviso, crea la alerta en una pala que esté en oferta con un objetivo solo un poco por debajo de su precio y espera a la siguiente bajada.

## 6. Analítica

No había ninguna. Se ha añadido una capa de eventos que no envía nada hasta configurarla.

| Variable | Valor | Efecto |
|---|---|---|
| `NEXT_PUBLIC_ANALYTICS_PROVIDER` | sin definir | No se mide nada ni se carga ningún script |
| | `console` | Los eventos se escriben en la consola del navegador |
| | `plausible` | Se entregan a Plausible, si además está el dominio |
| `NEXT_PUBLIC_ANALYTICS_DOMAIN` | dominio dado de alta en Plausible | Carga su script |

Se propone Plausible porque no usa cookies ni identifica a personas, así que no obliga a un aviso de consentimiento. Es de pago. Cualquier otro proveedor se conecta en `components/analytics/track.ts`.

| Evento | Cuándo | Datos |
|---|---|---|
| `busqueda` | Búsqueda en el catálogo | Término y número de resultados |
| `ficha_vista` | Se abre una ficha | Pala, marca, si tiene precio |
| `comparador_pala_anadida` | Se añade una pala desde un listado | Pala |
| `comparacion_iniciada` | Se pulsa «Comparar» en la barra | Origen |
| `comparacion_vista` | Se abre una comparación | Palas y cuántas |
| `comparacion_compartida` | Se comparte o se copia el enlace | Palas y método |
| `alternativa_consultada` | Se cambia de pestaña de alternativas | Pala y modo |
| `favorito_anadido` | Se guarda una pala | Pala y origen |
| `clic_tienda` | Clic en «Ir a la tienda» | Pala, tienda, precio, puesto |
| `guia_vista` | Se abre una guía | Guía |
| `quiz_completado` | Se ve un resultado del quiz | Nivel, estilo, presupuesto, resultados |
| `alerta_creada` | Se envía el formulario de alerta con éxito | Pala y origen; nunca el correo |

Definidos y todavía sin emitir: `filtro` y `precio_tienda_consultado`.

**Protecciones.** Cada evento tiene una lista cerrada de propiedades; lo demás se descarta. Cualquier texto con una arroba o con una cadena larga sin espacios se descarta. Los fallos de la analítica no afectan a la página.

**Direcciones con token.** Las páginas de alertas (`/alertas/…`, `/mis-alertas/`) llevan un token en la dirección. Por eso el script de Plausible se carga en su variante manual (no envía la página vista por su cuenta), la página vista se envía desde `components/analytics/Pageviews.tsx` solo con la ruta, sin parámetros, y desde esas páginas no se envía nada. **Antes de activarlo hay que comprobar en el panel de Plausible que las direcciones llegan sin parámetros**: no se ha podido probar contra el servicio real.

**Métricas que permitirá calcular:** búsquedas sin resultados, fichas más vistas, comparaciones iniciadas frente a vistas, clics de salida por tienda y por pala, uso de cada modo de alternativas y quizzes completados. **No permite** saber si un clic acabó en compra: eso solo lo dará un programa de afiliación.

## 7. Monetización

### Clics de salida y afiliación

Los enlaces a tienda siguen yendo directamente a la página del producto. `lib/outbound.ts` es el único punto que construye ese enlace. Para activar un programa de afiliación se añade la tienda a `config/affiliates.ts` con los parámetros que facilite; hoy la lista está vacía y un test lo comprueba.

Si un programa exige pasar por un enlace de redirección propio en lugar de añadir parámetros, habrá que ampliar `outboundLink`. Conviene esperar a conocer las condiciones reales.

### Patrocinios (sin implementar)

Reglas para cuando existan:

- Tres etiquetas distintas y visibles: recomendación basada en datos, mejor precio encontrado y contenido patrocinado.
- Un patrocinio ocupa un espacio propio y marcado; no cambia el orden por precio de las tiendas ni el orden de los listados.
- La guía «Cómo saber si una oferta es buena» ya lo afirma en público, así que cualquier cambio obligaría a cambiar ese texto.

### Accesorios (sin implementar)

El modelo actual es específico de palas (`rackets`, forma, balance). Para otras categorías, lo razonable es una tabla de productos por categoría con sus atributos propios, reutilizando sin cambios `stores`, `store_products`, `store_prices`, `price_history` y toda la ingestión, que ya trabaja con «producto de tienda emparejado con un producto nuestro». No se ha creado nada: requiere una decisión de producto y una migración.

## 8. Escáner

No hay ningún servicio de visión conectado y la web no ofrece la función. `/escanear/` sigue sin enlazarse.

| Pieza | Estado |
|---|---|
| Contrato del proveedor (`ScanProvider`) | Hecho |
| Validación de la imagen (JPEG, PNG o WebP; 8 MB) | Hecho |
| Filtrado: solo palas del catálogo, confianza mínima de 0,35, hasta 5 candidatos | Hecho |
| Finales: no disponible, error, sin coincidencias, candidatos | Hecho |
| Proveedor de visión | No existe |
| Interfaz de subida y de candidatos | No existe |
| Ruta de servidor que reciba la foto | No existe |

**Para activarlo:** elegir un servicio de visión (de pago por imagen), implementar `ScanProvider`, devolverlo en `getScanProvider`, crear la ruta de servidor con límite de peticiones y construir la interfaz. El coste por consulta y un tope de gasto deben decidirse antes.

## 9. SEO y plan de redirecciones

**La indexación sigue bloqueada.** No se ha tocado `NEXT_PUBLIC_ALLOW_INDEXING`, `robots`, el sitemap ni las canónicas. Las páginas nuevas heredan el bloqueo.

| Página nueva | Al activar la indexación |
|---|---|
| 3 colecciones y 5 guías | Indexables; entran solas en el sitemap |
| `/favoritos/` | `noindex`: es personal |

La regla de indexación de fichas (`lib/indexability.ts`) no ha cambiado.

### `legacy_urls`

La tabla tiene 788 filas: la ruta de cada pala en la web de la que se importó el catálogo (PadelZoom). No son direcciones antiguas de PalaRadar, que nunca ha tenido otras. Hoy solo la lee el script de revisión de fotos.

Solo serviría para redirecciones si PalaRadar pasara a ocupar un dominio que antes sirviera esas rutas. En ese caso:

1. Confirmar que el dominio es el mismo y que las rutas guardadas coinciden con las que recibían tráfico.
2. Resolver cada ruta contra `legacy_urls` y responder con una redirección permanente a `/pala/{slug}/`, y con 404 lo que no esté.
3. Probarlo en un despliegue de vista previa con una muestra antes de activarlo.

No se ha implementado ni activado nada de esto.

### Dominio

`NEXT_PUBLIC_SITE_URL` sigue sin definir. No se ha dado por bueno ningún dominio.

## 10. Pendiente

| Tarea | De qué depende |
|---|---|
| Publicar V4 | Revisión y autorización del propietario |
| Activar las alertas | Cuenta de Resend, tres variables y el permiso del rol de ingestión |
| Veredictos, estadísticas e índice de oportunidad visibles | Tiempo: 30 días de histórico (hacia el 2–4 de noviembre de 2026) |
| Activar la analítica | Elegir y contratar proveedor |
| Emitir los eventos `filtro` y `precio_tienda_consultado` | Trabajo pendiente, pequeño |
| Afiliación | Acuerdos con las tiendas |
| Escáner | Servicio de visión de pago y decisión de coste |
| Opiniones y comparaciones recientes | Decisión de producto |
| Tests de componentes y de extremo a extremo | No hay herramienta instalada; decidir si compensa |
| Revisión manual de accesibilidad | Teclado, lector de pantalla y contraste |
| Lanzamiento SEO | Dominio definitivo y autorización |
| Purga de tiendas de demostración, cola de emparejamientos, envío de Padel Nuestro | Ver [roadmap-pendiente.md](roadmap-pendiente.md) |
