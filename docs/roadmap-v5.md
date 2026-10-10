# PalaRadar V5: calidad de datos, buscador y comparación entre tiendas

Fecha: 9 de octubre de 2026. Punto de partida: commit `9d5d3ed` (lo que sirve producción) más la V4, que sigue sin confirmar en la carpeta de trabajo. La V5 se ha hecho encima, **también sin confirmar ni publicar**.

La idea de la V5 es que la ventaja de PalaRadar sea poder fiarse de lo que dice: saber qué se sabe, con qué seguridad, y decirlo. Documentos anteriores: [auditoría](auditoria-completa-palaradar.md) y [V4](roadmap-v4.md).

## Índice

1. [Estado al empezar](#1-estado-al-empezar)
2. [Qué se ha hecho](#2-qué-se-ha-hecho)
3. [Panel interno de calidad](#3-panel-interno-de-calidad)
4. [Buscador](#4-buscador)
5. [Diferencia de precio entre tiendas](#5-diferencia-de-precio-entre-tiendas)
6. [Confianza y normalización](#6-confianza-y-normalización)
7. [Informes](#7-informes)
8. [Cambiar de pala](#8-cambiar-de-pala)
9. [Seguridad](#9-seguridad)
10. [Pendiente](#10-pendiente)

## 1. Estado al empezar

| Comprobación | Resultado |
|---|---|
| Rama y commit | `main`, `9d5d3ed` |
| Cambios sin confirmar | 72 entradas en `git status`: la V4 y los documentos de auditoría. Nada preparado para commit |
| `npm run typecheck` | 0 errores |
| `npm run lint` | 0 errores |
| `npm test` | 474 correctos |
| `npm run build` | Correcto, 289 páginas |

Clasificación de lo que había, antes de tocar nada:

| Función | Estado al empezar |
|---|---|
| Catálogo, fichas, comparador, quiz, guías, colecciones | Correctas |
| Alternativas, temporadas, estadísticas de precio, favoritas (V4) | Correctas, sin publicar |
| Búsqueda | Correcta, pero solo por texto: «pala redonda por menos de 120 €» no daba nada |
| Comparación de precios entre tiendas | Parcial: se veía la lista de tiendas, no cuánto cambia el precio |
| Estado de los datos (precio, atributos) | Parcial y repartido: cada pantalla lo decía a su manera |
| Normalización de atributos | Parcial: solo el tacto y la dureza (V4) |
| Panel de calidad de datos | Inexistente: había un listado de pendientes por consola |
| Informes basados en datos | Inexistentes |
| Recomendador a partir de la pala actual | Inexistente |
| Alertas, analítica, afiliación, escáner | Bloqueadas por configuración o desactivadas; no se han tocado |

## 2. Qué se ha hecho

| Proyecto | Estado | Dónde |
|---|---|---|
| A. Panel interno de calidad | Hecho, como informe local de solo lectura | `quality/`, `scripts/quality/report.ts`, `npm run quality:report` |
| B. Buscador inteligente | Hecho | `lib/catalog/search-intent.ts`, `components/catalog/SearchInterpretation.tsx`, `/palas-padel/` |
| C. Diferencia entre tiendas | Hecho | `lib/store-spread.ts`, `components/pala/StoreSpreadNote.tsx`; ficha, comparador e informe |
| D. Cobertura y confianza | Hecho | `lib/data-confidence.ts`, `components/ficha/DataReliability.tsx`, filtro «Precio disponible» |
| E. Normalización | Hecho para forma, estilo, balance, nivel, tacto y peso | `lib/vocabulary.ts` |
| F. Radar de temporadas | Hecho, como informe | `/informes/ediciones-anteriores/` |
| G. Informes | Hecho, 4 informes | `lib/reports.ts`, `data/reports.ts`, `/informes/` |
| H. Recomendador desde la pala actual | Hecho | `findUpgrades` en `lib/alternatives.ts`, `/pala-ideal/mi-pala/` |

No se ha creado ninguna tabla, migración ni índice. Todo lo nuevo lee datos que ya existían.

## 3. Panel interno de calidad

**Por qué es un comando y no una página.** La web no tiene autenticación de administración. Una página con la cola de revisión, las direcciones de las tiendas y los fallos de ingestión no puede quedar protegida solo por «no enlazarla». Por eso el panel es un informe local: `npm run quality:report` hace tres consultas de lectura y escribe `var/quality-report.html`, que está fuera del repositorio.

### Qué calcula

| Métrica | De dónde sale |
|---|---|
| Palas disponibles | `rackets` |
| Con foto real | `racket_catalog.photo_path` |
| Con precio reciente, antiguo, sin confirmar o sin precio | La misma regla de vigencia que la web (`priceFreshness`) |
| Con precio en 2 tiendas o más | `store_count` |
| Con datos técnicos incompletos | Peso, balance, nivel, estilo, tacto o dureza, núcleo y caras |
| Con EAN; sin EAN ni referencia | `racket_identifiers` |
| Con fuentes que no coinciden | Vista `racket_fact_conflicts` |
| Con posible duplicado | Misma marca, mismo nombre normalizado y mismo año |
| Antigüedad de los precios vigentes | Más reciente, mediana y más antiguo, en horas |
| Información suficiente para cada función | `readiness` de `lib/data-confidence.ts` |
| Por tienda | Última ingestión correcta, fallos en 7 días, productos enlazados y en revisión |

Ninguna cifra está escrita en el código. La primera ejecución, el 9 de octubre de 2026, dio:

| Indicador | Palas | % |
|---|---|---|
| Disponibles | 785 | 100 |
| Con foto real | 745 | 94,9 |
| Con precio reciente | 259 | 33 |
| Sin precio | 526 | 67 |
| Con precio en 2 tiendas o más | 83 | 10,6 |
| Con datos técnicos incompletos | 543 | 69,2 |
| Con EAN | 264 | 33,6 |
| Con fuentes que no coinciden | 254 | 32,4 |
| Se pueden proponer como alternativa | 217 | 27,6 |
| Se pueden recomendar en el test | 218 | 27,8 |
| Tienen puntuaciones técnicas | 777 | 99 |

Productos de tienda en revisión: 87. Incidencias: 1.963 (9 altas, 346 medias y 1.608 bajas).

- Las 9 de gravedad alta son palas que tienen precio hoy y se muestran sin foto real (Babolat 2, Head 1, Nox 3, StarVie 3).
- El único error confirmado es una ingestión fallida de una tienda en los últimos 7 días, ya recuperada.
- Hay 4 posibles duplicados (mismo nombre y año) que conviene mirar.
- De los 87 productos pendientes, ninguna sugerencia llega a confianza alta: son casos dudosos de verdad, y por eso están en la cola.

### Incidencias

Cada incidencia lleva su naturaleza, porque no todas son errores:

| Naturaleza | Qué significa | Ejemplos |
|---|---|---|
| Error confirmado | Los datos se contradicen | El mismo EAN en dos palas; una ingestión fallida |
| Posible error | No cuadra, pero puede ser correcto | Peso fuera de 250–450 g; precio un 25 % por encima del PVPR; mismo nombre y año |
| Dato ausente | Falta un dato; no se da por incorrecto el resto | Sin foto, sin precio, sin EAN, datos técnicos incompletos |
| Dato antiguo | El dato existe, pero lleva tiempo sin comprobarse | Precio antiguo; tienda sin actualizar en más de 13 horas |
| Necesita revisión | Tiene que decidir una persona | Producto de tienda sin emparejar; fuentes que no coinciden |

El informe se filtra por gravedad, naturaleza, tipo, marca, tienda, fuente de datos, estado de revisión, antigüedad y texto.

### Sugerencias de emparejamiento

Para cada producto de tienda pendiente, `quality/matching.ts` propone hasta tres palas con una puntuación de 0 a 100:

| Señal | Puntos |
|---|---|
| Nombre: palabras en común sobre palabras totales | hasta 55 |
| Mismo año | +20 |
| Misma variante (comfort, hybrid, woman…) | +15 |
| El EAN coincide | +100 |
| Año distinto | −35 |
| Variante distinta | −35 |
| EAN distinto al de la pala | −50 |
| El título habla de otra forma | −15 |

- Confianza **alta**: el EAN coincide, o nombre, año y variante son iguales.
- Confianza **media**: 60 puntos o más con la misma variante.
- Confianza **baja**: el resto, y siempre que el EAN contradiga.
- Si las dos primeras quedan a menos de 10 puntos, se marca como ambiguo.

Es una ayuda para quien revisa. **No confirma nada ni escribe nada**: las reglas que sí emparejan solas siguen en `ingestion/matcher.ts`, sin cambios.

### Cómo se aplicarían correcciones (no se ha hecho)

El procedimiento ya existe para los emparejamientos y es el que hay que seguir:

1. Escribir las decisiones en un fichero versionado en `ingestion/decisions/`, cada una con su motivo.
2. `npm run prices:decisions -- --file=…`: ensayo, no guarda nada y lista los cambios.
3. Revisar el ensayo. Se detiene solo si un producto ya no está como cuando se revisó.
4. `--apply`, únicamente con autorización del propietario.

Para corregir datos del catálogo (un peso, un duplicado) no hay todavía un procedimiento equivalente. Haría falta uno con las mismas garantías: lista explícita, ensayo, registro de quién y cuándo, y la posibilidad de deshacerlo. Una futura interfaz web de corrección necesitaría antes autenticación de administración (por ejemplo, Supabase Auth con una lista cerrada de correos) y un rol de base de datos con permisos solo sobre lo que corrige.

## 4. Buscador

Lo escrito en el buscador se interpreta con diccionarios y reglas, sin IA. Los criterios reconocidos se convierten en los filtros que ya tenía el catálogo.

| Se escribe | Se interpreta como |
|---|---|
| «menos de 120», «hasta 150 euros», «máximo 100», «150 €» | Presupuesto máximo |
| «redonda», «lágrima», «diamante», «híbrida» | Forma |
| «de control», «potencia», «polivalente», «versátil» | Estilo de juego |
| «manejable» | Forma redonda y balance bajo (lo que define la colección) |
| «balance alto» | Balance |
| «principiantes», «intermedio», «avanzado», «competición» | Nivel |
| El nombre de una marca del catálogo | Marca |
| «2025» | Temporada, si existe en el catálogo |
| «temporadas anteriores», «del año pasado» | Temporadas anteriores al año en curso |
| «con precio confirmado», «a la venta», «disponibles» | Con precio hoy |
| «en dos tiendas», «comparables entre tiendas» | En 2 tiendas o más |
| «en oferta», «rebajadas» | Palas en oferta |
| «baratas», «económicas» | Orden por precio |
| «alternativa más barata a la vertex 04», «parecida a…» | Modelo de referencia: enlace a sus alternativas |

**Reglas de prudencia**

- Un número solo es un presupuesto si lo dice el contexto: «vertex 04» y «pala 150» no lo son; «pala 150 €», sí.
- «Control» y «potencia» también están en nombres de modelo. Solo son un criterio si la frase lo pide («de control») o si no queda nada más que buscar. En «hack control 2026» se busca como texto, y se avisa.
- «Otra marca» no se convierte en filtro: solo tiene sentido respecto a una pala concreta, y se dice.
- Sin ningún criterio reconocido, la búsqueda es la de siempre.
- Lo elegido a mano manda sobre lo deducido.

**Transparencia.** Sobre los resultados aparece «He interpretado «…» como: …», y cada criterio es un filtro normal que se puede quitar.

**Orden.** No hay una puntuación nueva. Los resultados se filtran por los criterios y se ordenan como el catálogo: más tiendas con precio vigente, foto real, **datos de perfil declarados** (nuevo: balance, estilo y nivel) y año. Así, entre dos palas igual de disponibles, la mejor documentada va antes. El desempate final sigue siendo un orden fijo sin significado, para no favorecer a ninguna marca.

**Sin resultados.** Se cuenta cuántas palas habría quitando un solo criterio cada vez y se ofrecen como enlaces. Ningún criterio se quita sin avisar.

## 5. Diferencia de precio entre tiendas

No es el índice de oportunidad de la V4. Aquel compara el precio con su propio histórico; esto compara lo que piden hoy dos tiendas por la misma pala.

| Dato | Cálculo |
|---|---|
| Diferencia | Precio más alto − precio más bajo |
| Porcentaje | (precio más alto − precio más bajo) ÷ precio más alto × 100, con un decimal |
| Tiendas | Las que tienen precio vigente de esa pala |

- **Comparabilidad.** Solo se comparan ofertas de una misma pala del catálogo (cada producto de tienda está emparejado con una pala exacta), con precio vigente y en euros. Hacen falta dos.
- **Precisión.** Los importes se calculan en céntimos enteros.
- **Envío.** Si todas las tiendas tienen el envío verificado se compara el total con envío. Si falta alguno, se compara el precio de la pala y se dice: «No incluye el envío de …, que no hemos verificado: el coste final puede ser otro». Hoy es el caso de todas las comparaciones, porque el envío de Padel Nuestro no está verificado.
- **Con menos de 1 € de diferencia** se dice que piden prácticamente lo mismo.

Se muestra en la ficha (bajo la lista de tiendas), en el comparador (una línea por pala) y en el informe de diferencias.

## 6. Confianza y normalización

`lib/data-confidence.ts` es la única definición de qué se sabe y para qué alcanza.

| Qué | Estados |
|---|---|
| Precio | Reciente · conocido pero antiguo · sin confirmar · sin precio |
| Atributo | Verificado · declarado · deducido · desconocido |
| Relación entre palas | Verificada (la fijó una persona) · provisional (la calcula una regla) |

- El estado del precio sale de la regla de vigencia que ya existía; no hay una segunda.
- Hoy solo el EAN puede estar verificado. El resto de características son declaradas por la fuente.
- La relación entre temporadas es **provisional**: misma marca y mismo nombre de modelo. Se dice en la ficha y en el informe.
- La ficha tiene un bloque «Fiabilidad de los datos» con cada limitación explicada.
- El catálogo tiene un filtro nuevo, «Precio disponible»: con precio hoy y en 2 tiendas o más.

`lib/vocabulary.ts` lleva a un vocabulario común la forma, el estilo, el balance, el nivel, el tacto o dureza y el peso. Lo usan el buscador, las alternativas y las sugerencias de emparejamiento. Un texto que no se reconoce queda como desconocido, y un peso con una unidad imposible se descarta en lugar de corregirse. **No se ha modificado ningún dato guardado**: la normalización ocurre al leer.

## 7. Informes

Cuatro páginas en `/informes/`, calculadas con los datos del día:

| Informe | Qué responde |
|---|---|
| Diferencias de precio entre tiendas | Cuánto cambia hoy el precio de una misma pala según la tienda |
| Ediciones anteriores más baratas | De qué modelos hay varias temporadas a la venta y cuánto cuesta cada una |
| Cobertura de precios por marca | De cuántas palas de cada marca hay precio, y en cuántas tiendas |
| Palas con precio confirmado por presupuesto | Cuántas palas hay por debajo de cada tope, por forma |

Cada informe lleva un bloque «Cómo se ha calculado»: tiendas y número de precios, periodo, qué significa cada cifra, cuándo se calculó y una lista «Qué no dice este informe». Todos avisan de que describen las tiendas que se siguen, no el mercado.

- Los textos salen de cifras; no hay opiniones ni se usa «mejor» o «ganadora».
- No entran en el sitemap y van en `noindex`. Si se indexan o no es una decisión para el lanzamiento.
- El informe de evolución de precios no se ha hecho: con 7 días de histórico no habría nada que decir.

## 8. Cambiar de pala

`/pala-ideal/mi-pala/` es la otra entrada del recomendador: se elige la pala que se usa, qué se quiere conservar (forma, balance, tacto, peso), qué se quiere cambiar (más barata, priorizar control o potencia, polivalente, manejabilidad, otra marca) y un presupuesto.

- Usa el mismo motor que las alternativas de la ficha; no es un segundo recomendador.
- Lo que se conserva y el presupuesto son requisitos. De los cambios basta con cumplir alguno, y cada resultado dice cuáles cumple y cuáles no.
- Lo que la pala actual no declara no se puede exigir a otra, y se avisa.
- Todo el estado va en la URL: funciona sin JavaScript y se puede compartir.
- No promete que una pala vaya a jugar mejor.

## 9. Seguridad

| Regla | Cumplimiento |
|---|---|
| Sin escrituras en la base de datos | Todas las consultas nuevas son `SELECT`. No se ha ejecutado `test:db`, `db:purge-demo`, seeds ni migraciones |
| Sin cambios de esquema, permisos o políticas | Ninguno |
| Sin commit, push ni despliegue | Ninguno |
| Indexación bloqueada | Sin cambios; las páginas nuevas van en `noindex` |
| Sin servicios externos ni costes | Ninguno; alertas, analítica, afiliación y escáner siguen como estaban |
| Sin secretos en el código | Ninguno; `.env.local` no se ha leído |
| Sin datos inventados | Los textos se generan con cifras leídas; lo desconocido se dice |

El informe de calidad se escribe en `var/`, que está fuera del repositorio. No debe publicarse.

## 10. Pendiente

| Tarea | De qué depende |
|---|---|
| Revisar y publicar V4 y V5 | Autorización del propietario |
| Resolver los 87 emparejamientos, con las sugerencias del panel | Trabajo manual y autorización para aplicar las decisiones |
| Conseguir foto para las 9 palas con precio que no la tienen | Trabajo manual (`npm run media:review`) |
| Revisar los 4 posibles duplicados | Trabajo manual |
| Verificar el envío de Padel Nuestro, para comparar totales | Confirmarlo con la tienda |
| Revisar a mano las mayores diferencias entre tiendas | El informe muestra diferencias de más del 30 % (por ejemplo, 87 € en una misma pala). Pueden ser reales o un emparejamiento con otra edición: hay que mirarlas antes de publicar el informe. Añadir al panel de calidad una incidencia «diferencia sospechosa» sería el paso siguiente |
| Procedimiento seguro para corregir datos del catálogo | Diseño y autorización |
| Panel de calidad como página web | Autenticación de administración |
| Informe de evolución de precios | 30 días de histórico |
| Decidir si los informes se indexan | Lanzamiento SEO |
| Tests de componentes y de extremo a extremo | No hay herramienta instalada |
| Pruebas de integración contra una base de datos | No existe un entorno aislado |
