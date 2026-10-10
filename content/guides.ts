// Guías: contenido editorial propio, que no vive en la base de datos.
//
// Dos tipos de contenido conviven en cada guía:
//  · El texto (introducción, explicaciones, preguntas) es conocimiento general
//    de pádel escrito para PalaRadar. No valora palas concretas ni cita pruebas
//    que no hemos hecho.
//  · Las palas seleccionadas NO están escritas aquí: cada selección es un filtro
//    del catálogo y la página elige, con los datos del día, la pala a la venta
//    mejor puntuada por la fuente externa (PadelZoom). Lo que se dice de cada
//    pala sale de sus datos (lib/guides.ts). Así una guía no recomienda una pala
//    agotada ni cita un precio viejo.
import type { CatalogQuery } from "@/lib/catalog/query";
import { catalogHref } from "@/lib/catalog/query";
import { routes } from "@/lib/routes";
import type { FaqItem, Guide } from "@/types/catalog";

export interface GuidePick {
  id: string;
  /** Antetítulo en mayúsculas: «PARA ATACAR» */
  eyebrow: string;
  title: string;
  /** Filtro del catálogo del que sale la pala */
  query: Partial<CatalogQuery>;
  /** Qué necesita ese perfil de jugador, en general */
  why: string;
}

export interface GuideBlock {
  id: string;
  title: string;
  paragraphs: string[];
  links?: { label: string; href: string }[];
}

export interface GuideDoc extends Guide {
  /** Descripción para buscadores */
  description: string;
  /** Fecha de la última revisión del texto (YYYY-MM-DD) */
  updatedAt: string;
  intro: string[];
  picks: GuidePick[];
  blocks: GuideBlock[];
  faq: FaqItem[];
  /** Colecciones del catálogo relacionadas (slugs) */
  collections: string[];
}

const UPDATED = "2026-10-09";

export const guides: GuideDoc[] = [
  {
    slug: "mejores-palas-padel-2026",
    title: "Las mejores palas de pádel de 2026",
    subtitle: "Según tu nivel y tu forma de jugar",
    image: null,
    description:
      "Las palas de pádel de 2026 mejor puntuadas que están a la venta, por tipo de juego: potencia, equilibrio, control y para empezar. Con su mejor precio de hoy.",
    updatedAt: UPDATED,
    intro: [
      "No existe la mejor pala para todo el mundo, pero sí la que mejor encaja con cómo juegas tú. Por eso esta guía no da una lista única: separa las palas de la temporada 2026 por tipo de juego.",
      "En cada apartado enseñamos la pala de 2026 con mejor puntuación técnica entre las que hoy tienen precio en las tiendas que seguimos. La selección se recalcula sola: si una pala se agota o aparece otra mejor puntuada, cambia.",
    ],
    picks: [
      {
        id: "atacar",
        eyebrow: "Para atacar",
        title: "Si te gusta rematar",
        query: { styles: ["potencia"], years: [2026] },
        why: "Quien gana los puntos por arriba busca inercia en el remate: forma de diamante o lágrima alta, balance medio-alto y caras que devuelvan la bola con velocidad. A cambio hay que aceptar un punto dulce más pequeño y más peso en la cabeza al defender.",
      },
      {
        id: "completos",
        eyebrow: "Para jugadores completos",
        title: "La más equilibrada",
        query: { styles: ["polivalente"], years: [2026] },
        why: "Si haces de todo en la pista, lo que quieres es que la pala no te limite: control suficiente desde el fondo y potencia razonable para cerrar el punto. Suele ser una lágrima de balance medio.",
      },
      {
        id: "control",
        eyebrow: "Para construir el punto",
        title: "Si prefieres el control",
        query: { styles: ["control"], years: [2026] },
        why: "El jugador de control coloca la bola y espera su momento. Le conviene un punto dulce amplio y una pala fácil de mover: forma redonda o lágrima baja y balance bajo o medio.",
      },
      {
        id: "empezar",
        eyebrow: "Para empezar",
        title: "La que más perdona",
        query: { levels: ["iniciacion"], years: [2026] },
        why: "Al empezar se falla mucho el centro de la cara. Una pala de iniciación compensa eso con forma redonda, balance bajo y un tacto que no sea duro. No hace falta gastar mucho.",
      },
    ],
    blocks: [
      {
        id: "como-elegir",
        title: "Cómo elegir la tuya",
        paragraphs: [
          "Empieza por tu nivel: una pala por encima de él no te hará jugar mejor, solo fallar más. Después piensa en cómo ganas los puntos: si es atacando, busca potencia; si es construyendo, control y manejabilidad.",
          "Con eso claro, mira la forma y el balance antes que la marca o el jugador que la lleva. Y compara precios: la misma pala puede costar bastante menos según la tienda y el día.",
        ],
        links: [
          { label: "Guía completa: cómo elegir pala de pádel", href: routes.guide("como-elegir-pala-de-padel") },
        ],
      },
    ],
    faq: [
      {
        question: "¿Cómo elegís las palas de esta guía?",
        answer:
          "No las elegimos a mano. En cada apartado se muestra la pala de 2026 que cumple el filtro (por ejemplo, estilo de juego «potencia»), tiene precio hoy en alguna tienda que seguimos y tiene la puntuación técnica total más alta en PadelZoom. Las puntuaciones son de PadelZoom, no de PalaRadar.",
      },
      {
        question: "¿La pala mejor puntuada es la mejor para mí?",
        answer:
          "No necesariamente. Una puntuación alta indica una pala bien valorada en su categoría, no que encaje con tu nivel o tu juego. Usa la guía para acotar y el test de Pala ideal para afinar.",
      },
      {
        question: "¿Merece la pena comprar una pala de 2026 o una del año anterior?",
        answer:
          "Los modelos de la temporada anterior suelen mantener casi todas las características y cuestan menos. Si no necesitas la novedad, compara las dos ediciones en el comparador antes de decidir.",
      },
    ],
    collections: ["2026", "potencia", "polivalentes", "control", "principiantes"],
  },
  {
    slug: "mejores-palas-nivel-intermedio",
    title: "Mejores palas para nivel intermedio",
    subtitle: "Para cuando ya juegas con regularidad y quieres más",
    image: null,
    description:
      "Palas de pádel para nivel intermedio mejor puntuadas y a la venta hoy, según juegues a control, a todo o a potencia. Con su mejor precio.",
    updatedAt: UPDATED,
    intro: [
      "El nivel intermedio es donde más se nota la pala: ya mantienes peloteos, empiezas a rematar y la pala de iniciación se queda corta. También es donde más fácil resulta equivocarse comprando una pala demasiado exigente.",
      "Esta guía enseña, para cada forma de jugar, la pala de nivel intermedio mejor puntuada entre las que hoy están a la venta.",
    ],
    picks: [
      {
        id: "control",
        eyebrow: "Control",
        title: "Si juegas desde el fondo",
        query: { levels: ["intermedio"], styles: ["control"] },
        why: "Si tu punto fuerte es la regularidad, mantén una pala fácil: redonda o lágrima baja, balance bajo o medio. Notarás el salto en materiales sin perder tolerancia.",
      },
      {
        id: "polivalente",
        eyebrow: "Equilibrio",
        title: "Si haces de todo",
        query: { levels: ["intermedio"], styles: ["polivalente"] },
        why: "Es la apuesta más segura en este nivel: una lágrima de balance medio que acompaña mientras defines tu juego.",
      },
      {
        id: "potencia",
        eyebrow: "Potencia",
        title: "Si ya rematas",
        query: { levels: ["intermedio"], styles: ["potencia"] },
        why: "Si el remate ya es parte de tu juego, una pala de potencia de nivel intermedio te dará más pegada. Mejor con balance medio que con uno muy alto: cansa menos y se controla mejor.",
      },
    ],
    blocks: [
      {
        id: "errores",
        title: "Tres errores habituales al dar el salto",
        paragraphs: [
          "El primero es comprar la pala de un profesional. Están pensadas para un golpeo muy limpio y un brazo entrenado: en nivel intermedio suelen dar menos control, no más potencia.",
          "El segundo es elegir por dureza creyendo que duro es mejor. Una pala dura da precisión cuando se golpea fuerte y bien; si no, la bola sale poco. En este nivel un tacto medio suele funcionar mejor.",
          "El tercero es fijarse solo en el precio de salida. Las palas bajan mucho durante el año: mira el precio de hoy en cada tienda y, si no tienes prisa, crea una alerta.",
        ],
      },
    ],
    faq: [
      {
        question: "¿Cómo sé si soy de nivel intermedio?",
        answer:
          "De forma orientativa: juegas con regularidad, mantienes peloteos, sacas y restas con seguridad y empiezas a usar la pared y a rematar. Si aún te cuesta devolver la bola con continuidad, una pala de iniciación te ayudará más.",
      },
      {
        question: "¿Qué peso de pala es adecuado en nivel intermedio?",
        answer:
          "La mayoría de las palas de adulto pesan entre 355 y 375 gramos. Una pala más ligera se mueve mejor y cansa menos; una más pesada da más estabilidad. Si dudas, empieza por la parte baja del rango.",
      },
      {
        question: "¿De dónde salen las palas que enseña la guía?",
        answer:
          "De un filtro del catálogo (nivel intermedio y estilo de juego) ordenado por la puntuación técnica total de PadelZoom, entre las palas con precio hoy. Se recalcula con cada actualización de precios.",
      },
    ],
    collections: ["nivel-intermedio", "polivalentes", "lagrima", "menos-de-150-euros"],
  },
  {
    slug: "palas-menos-de-150-euros",
    title: "Palas por menos de 150 €",
    subtitle: "Buenas palas sin pasarte de presupuesto",
    image: null,
    description:
      "Las palas de pádel mejor puntuadas que hoy cuestan menos de 150 euros, por tipo de juego, y qué se puede esperar de una pala en ese presupuesto.",
    updatedAt: UPDATED,
    intro: [
      "Con 150 euros se puede comprar muy bien. En ese presupuesto entran la gama media de casi todas las marcas y, sobre todo, modelos de gamas superiores de la temporada anterior que han bajado de precio.",
      "Aquí enseñamos la pala mejor puntuada de cada tipo de juego entre las que hoy cuestan menos de 150 euros en alguna de las tiendas que seguimos. Como los precios cambian, la selección también.",
    ],
    picks: [
      {
        id: "control",
        eyebrow: "Control",
        title: "Para jugar con cabeza",
        query: { maxPrice: 150, styles: ["control"] },
        why: "En control es donde menos hace falta gastar: una buena pala redonda con un punto dulce amplio no necesita los materiales más caros.",
      },
      {
        id: "polivalente",
        eyebrow: "Equilibrio",
        title: "Para hacer de todo",
        query: { maxPrice: 150, styles: ["polivalente"] },
        why: "La pala polivalente es la compra más segura con un presupuesto ajustado: sirve aunque cambies de lado o de compañero.",
      },
      {
        id: "potencia",
        eyebrow: "Potencia",
        title: "Para atacar sin gastar de más",
        query: { maxPrice: 150, styles: ["potencia"] },
        why: "Las palas de potencia son las que más bajan de precio de una temporada a otra. Por debajo de 150 euros suelen aparecer modelos de gama alta del año anterior.",
      },
      {
        id: "cien",
        eyebrow: "Menos de 100 €",
        title: "Si quieres gastar lo mínimo",
        query: { maxPrice: 100 },
        why: "Por debajo de 100 euros mandan las palas de iniciación y la fibra de vidrio, que da un tacto más blando y cómodo.",
      },
    ],
    blocks: [
      {
        id: "ahorrar",
        title: "Cómo pagar menos por la misma pala",
        paragraphs: [
          "Compara tiendas: la misma pala puede tener diferencias de decenas de euros de una tienda a otra, y el envío no siempre está incluido. En cada ficha verás el precio de cada tienda ordenado de menor a mayor.",
          "Mira la temporada anterior. Entre dos ediciones seguidas del mismo modelo los cambios suelen ser pequeños, y la antigua baja en cuanto sale la nueva.",
          "Y no te fíes del porcentaje de descuento que anuncia una tienda: lo que importa es el precio final frente al de otras tiendas y frente a lo que ha costado esa pala en las últimas semanas.",
        ],
        links: [
          { label: "Todas las palas por menos de 150 €", href: routes.collection("menos-de-150-euros") },
          { label: "Ofertas de hoy", href: routes.deals },
        ],
      },
    ],
    faq: [
      {
        question: "¿Una pala barata es una pala mala?",
        answer:
          "No. El precio depende mucho de los materiales y de la temporada. Una pala de gama media bien elegida para tu nivel te servirá mejor que una de gama alta que no puedas controlar.",
      },
      {
        question: "¿Los precios de esta guía están actualizados?",
        answer:
          "Sí: son los precios que hemos comprobado hoy en las tiendas que seguimos, y la selección de palas se recalcula con ellos.",
      },
      {
        question: "¿El envío está incluido en el precio?",
        answer:
          "Depende de la tienda. En la ficha de cada pala indicamos, para cada tienda, si el envío está incluido o no.",
      },
    ],
    collections: ["menos-de-150-euros", "menos-de-100-euros", "principiantes", "nivel-intermedio"],
  },
  {
    slug: "palas-para-principiantes",
    title: "Palas de pádel para principiantes",
    subtitle: "Qué mirar en tu primera pala y cuáles hay a la venta",
    image: null,
    description:
      "Cómo elegir tu primera pala de pádel: forma, balance, peso y precio. Y las palas de iniciación mejor puntuadas que hoy están a la venta.",
    updatedAt: UPDATED,
    intro: [
      "La primera pala no tiene que ser la mejor: tiene que ponértelo fácil. Una pala que perdona los golpes descentrados y se mueve sin esfuerzo te hará mejorar más rápido que una pala de profesional.",
      "Primero te contamos en qué fijarte y, después, enseñamos las palas de iniciación mejor puntuadas entre las que hoy tienen precio.",
    ],
    picks: [
      {
        id: "redonda",
        eyebrow: "La opción clásica",
        title: "Redonda y fácil",
        query: { levels: ["iniciacion"], shapes: ["redonda"] },
        why: "La forma redonda es la más tolerante: punto dulce grande y peso cerca de la mano. Es la recomendación habitual para empezar.",
      },
      {
        id: "lagrima",
        eyebrow: "Con algo más de pegada",
        title: "Lágrima para empezar",
        query: { levels: ["iniciacion"], shapes: ["lagrima"] },
        why: "Si vienes de otro deporte de raqueta o ya tienes algo de técnica, una lágrima de iniciación te da un poco más de potencia sin complicarte.",
      },
      {
        id: "barata",
        eyebrow: "Presupuesto ajustado",
        title: "Por menos de 100 €",
        query: { levels: ["iniciacion"], maxPrice: 100 },
        why: "Para probar el deporte no hace falta más. Hay palas de iniciación de marcas conocidas por debajo de 100 euros.",
      },
    ],
    blocks: [
      {
        id: "que-mirar",
        title: "En qué fijarte en tu primera pala",
        paragraphs: [
          "Forma: redonda. Deja el punto dulce amplio y en el centro, así que los golpes que no dan justo en medio siguen saliendo.",
          "Balance: bajo o medio. Con el peso cerca del puño la pala se mueve con facilidad y cansa menos el brazo.",
          "Peso: en la parte baja del rango habitual (entre 350 y 365 gramos para la mayoría de adultos). Ya habrá tiempo de subir.",
          "Tacto: blando o medio. La bola sale con facilidad sin necesidad de pegar fuerte, que es justo lo que ayuda al principio.",
        ],
        links: [{ label: "Ver todas las palas para principiantes", href: routes.collection("principiantes") }],
      },
      {
        id: "que-evitar",
        title: "Qué evitar",
        paragraphs: [
          "Las palas de diamante con balance alto y las de tacto duro: son las más difíciles de controlar. Tampoco compres por el jugador que la anuncia: su pala está hecha para su nivel, no para el tuyo.",
        ],
      },
    ],
    faq: [
      {
        question: "¿Cuánto cuesta una pala de pádel para empezar?",
        answer:
          "Hay palas de iniciación por menos de 100 euros. Con ese presupuesto es suficiente para empezar; el precio de hoy de cada una está en su ficha.",
      },
      {
        question: "¿Sirve cualquier pala para empezar?",
        answer:
          "Se puede empezar con cualquiera, pero una pala exigente (diamante, balance alto, tacto duro) hace más difícil aprender. Una redonda de balance bajo facilita mucho los primeros meses.",
      },
      {
        question: "¿Hay palas distintas para hombre y para mujer?",
        answer:
          "Algunas marcas tienen líneas con menos peso que anuncian para mujer, pero lo que importa es el peso y el balance que te resulten cómodos. Cualquier jugador puede usar cualquier pala.",
      },
    ],
    collections: ["principiantes", "redondas", "menos-de-100-euros", "control"],
  },
  {
    slug: "como-elegir-pala-de-padel",
    title: "Cómo elegir pala de pádel",
    subtitle: "Nivel, forma, balance, peso y materiales, explicados sin tecnicismos",
    image: null,
    description:
      "Guía para elegir pala de pádel paso a paso: nivel, forma, balance, peso, núcleo, caras y presupuesto. Qué significa cada característica y cómo te afecta.",
    updatedAt: UPDATED,
    intro: [
      "Las fichas de las palas están llenas de datos: forma, balance, peso, núcleo, caras, marco. Todos influyen, pero no todos importan lo mismo ni en el mismo orden.",
      "Esta guía los recorre en el orden en que conviene decidir, y explica qué cambia cada uno en la pista. Al final puedes llevar las respuestas al test de Pala ideal y ver palas concretas.",
    ],
    picks: [],
    blocks: [
      {
        id: "nivel",
        title: "1. Tu nivel",
        paragraphs: [
          "Es el primer filtro. Las palas de iniciación perdonan los golpes descentrados; las avanzadas dan más cuando se golpea bien y castigan cuando no. Una pala por encima de tu nivel no te hace jugar mejor.",
          "Los fabricantes declaran para qué nivel está pensada cada pala. Es una orientación suya, pero útil para descartar.",
        ],
        links: [
          { label: "Para principiantes", href: routes.collection("principiantes") },
          { label: "Nivel intermedio", href: routes.collection("nivel-intermedio") },
          { label: "Nivel avanzado", href: routes.collection("nivel-avanzado") },
        ],
      },
      {
        id: "juego",
        title: "2. Cómo juegas",
        paragraphs: [
          "Piensa en cómo ganas los puntos. Si es colocando la bola y esperando el fallo, buscas control. Si es rematando y cerrando por arriba, potencia. Si haces un poco de todo, una pala polivalente.",
          "El lado de la pista también orienta: en el revés se remata más y suele preferirse algo más de potencia; en el drive se agradece el control.",
        ],
        links: [
          { label: "Palas de control", href: routes.collection("control") },
          { label: "Palas polivalentes", href: routes.collection("polivalentes") },
          { label: "Palas de potencia", href: routes.collection("potencia") },
        ],
      },
      {
        id: "forma",
        title: "3. La forma",
        paragraphs: [
          "La forma decide dónde está el punto dulce. Redonda: abajo y amplio, la más fácil. Lágrima: en el centro, equilibrada. Diamante: arriba y más pequeño, la más potente y exigente.",
          "Hay marcas que llaman híbrida a una forma entre la lágrima y la diamante.",
        ],
        links: [
          { label: "Redonda, lágrima o diamante: diferencias", href: routes.guide("forma-redonda-lagrima-diamante") },
        ],
      },
      {
        id: "balance",
        title: "4. El balance",
        paragraphs: [
          "El balance es dónde se concentra el peso. Bajo, cerca del puño: la pala se mueve rápido y es fácil de manejar. Alto, hacia la cabeza: más inercia y potencia en el remate, pero más carga para el brazo y menos agilidad en la red.",
          "Forma y balance suelen ir juntos (redonda con balance bajo, diamante con balance alto), aunque hay excepciones. Por eso conviene mirar los dos datos.",
        ],
        links: [
          { label: "Diamante y balance alto", href: catalogHref({ shapes: ["diamante"], balances: ["alto"] }) },
          { label: "Redonda y balance bajo", href: catalogHref({ shapes: ["redonda"], balances: ["bajo"] }) },
        ],
      },
      {
        id: "peso",
        title: "5. El peso",
        paragraphs: [
          "La mayoría de las palas de adulto pesan entre 350 y 385 gramos, y casi siempre se declara un rango, porque dos unidades del mismo modelo no pesan exactamente igual.",
          "Más ligera: más manejable y más cómoda en partidos largos. Más pesada: más estable y con más pegada, si tienes fuerza para moverla. Ten en cuenta que el overgrip y el protector añaden unos gramos.",
        ],
      },
      {
        id: "nucleo",
        title: "6. El núcleo",
        paragraphs: [
          "El núcleo es la goma del interior, casi siempre EVA de distintas densidades o FOAM. Es lo que más define el tacto.",
          "Un núcleo blando deforma más al golpear: la bola sale con facilidad aunque no pegues fuerte y el tacto es más cómodo. Uno duro responde mejor a los golpes fuertes y da más precisión, pero exige generar tú la velocidad.",
        ],
      },
      {
        id: "caras",
        title: "7. Las caras y el marco",
        paragraphs: [
          "Las caras suelen ser de fibra de vidrio, de carbono o de una mezcla. La fibra de vidrio es más flexible y barata: da salida de bola y es habitual en palas de iniciación. El carbono es más rígido y resistente: es el material de las gamas media y alta.",
          "Las cifras 3K, 12K o 18K indican cuántos filamentos tiene cada hilo del tejido de carbono. Cambian el tacto, pero cada fabricante las combina con núcleos distintos, así que no sirven por sí solas para comparar dos palas de marcas diferentes.",
          "La superficie rugosa o arenosa ayuda a darle efecto a la bola.",
        ],
      },
      {
        id: "presupuesto",
        title: "8. El presupuesto",
        paragraphs: [
          "Decide el tope antes de mirar modelos. Por menos de 100 euros hay palas de iniciación; hasta 150, gama media y modelos anteriores rebajados; a partir de ahí, las gamas altas.",
          "El precio de una pala cambia mucho a lo largo del año y de una tienda a otra. Compara el de hoy en cada tienda y, si no tienes prisa, sigue su evolución.",
        ],
        links: [
          { label: "Menos de 100 €", href: routes.collection("menos-de-100-euros") },
          { label: "Menos de 150 €", href: routes.collection("menos-de-150-euros") },
          { label: "Ofertas de hoy", href: routes.deals },
        ],
      },
    ],
    faq: [
      {
        question: "¿Qué es más importante al elegir una pala?",
        answer:
          "Por este orden: que sea de tu nivel, que encaje con cómo juegas (forma y balance) y que el peso te resulte cómodo. Los materiales afinan el tacto, pero pesan menos en la decisión.",
      },
      {
        question: "¿Cada cuánto hay que cambiar de pala?",
        answer:
          "Depende de cuánto juegues. Con el uso el núcleo pierde respuesta y pueden aparecer fisuras. Si notas que la bola sale menos o que el sonido cambia, es momento de mirar otra.",
      },
      {
        question: "¿Puedo probar una pala antes de comprarla?",
        answer:
          "Algunos clubes y tiendas físicas tienen palas de prueba. Es la mejor forma de decidir entre dos candidatas: los datos orientan, pero las sensaciones son personales.",
      },
      {
        question: "¿Qué pala usan los profesionales?",
        answer:
          "Cada uno la de su marca, hecha para su juego. Los modelos de jugador que se venden comparten nombre y estética, pero no por eso son adecuados para un jugador amateur.",
      },
    ],
    collections: ["principiantes", "control", "potencia", "polivalentes", "redondas", "lagrima", "diamante"],
  },
  {
    slug: "forma-redonda-lagrima-diamante",
    title: "Pala redonda, de lágrima o de diamante",
    subtitle: "En qué se diferencian las formas y cuál te conviene",
    image: null,
    description:
      "Diferencias entre palas de pádel redondas, de lágrima y de diamante: punto dulce, balance, control y potencia. Cuál elegir según tu nivel y tu juego.",
    updatedAt: UPDATED,
    intro: [
      "La forma es lo primero que se ve de una pala y una de las cosas que más cambian cómo juega. No es una cuestión estética: mueve el punto dulce y el reparto del peso.",
      "Te explicamos las tres formas principales, para quién es cada una y, de cada forma, la pala mejor puntuada que hoy está a la venta.",
    ],
    picks: [
      {
        id: "redonda",
        eyebrow: "Redonda",
        title: "Control y tolerancia",
        query: { shapes: ["redonda"] },
        why: "La cabeza es un círculo casi perfecto. El punto dulce es el más grande de las tres y queda en el centro, y el peso se concentra cerca del puño (balance bajo). Resultado: mucha tolerancia, mucho control y menos potencia en el remate. Es la forma de quien empieza y de quien juega a no fallar.",
      },
      {
        id: "lagrima",
        eyebrow: "Lágrima",
        title: "El punto medio",
        query: { shapes: ["lagrima"] },
        why: "La cabeza se estrecha hacia el puño, como una gota. El punto dulce sube un poco y el balance suele ser medio. Da más potencia que una redonda sin llegar a la exigencia de una diamante. Es la forma más polivalente y la que más modelos tiene.",
      },
      {
        id: "diamante",
        eyebrow: "Diamante",
        title: "Potencia y exigencia",
        query: { shapes: ["diamante"] },
        why: "La parte más ancha de la cabeza está arriba. El punto dulce es más pequeño y más alto, y el peso se va hacia la cabeza (balance alto). Mucha inercia en el remate, menos margen de error y más carga para el brazo. Para jugadores con técnica que atacan.",
      },
    ],
    blocks: [
      {
        id: "cual",
        title: "Cuál te conviene",
        paragraphs: [
          "Si estás empezando o juegas de vez en cuando: redonda. Si ya juegas con regularidad y no quieres renunciar a nada: lágrima. Si rematas con soltura y ganas los puntos por arriba: diamante.",
          "La forma no lo decide todo. Dos palas de la misma forma pueden ser muy distintas según su balance, su peso y sus materiales. Mira la forma para acotar y el resto de la ficha para elegir.",
        ],
        links: [
          { label: "Palas redondas", href: routes.collection("redondas") },
          { label: "Palas de lágrima", href: routes.collection("lagrima") },
          { label: "Palas de diamante", href: routes.collection("diamante") },
        ],
      },
    ],
    faq: [
      {
        question: "¿Qué es el punto dulce?",
        answer:
          "La zona de la cara en la que el golpe sale mejor: con más control, más potencia y menos vibración. Cuanto más grande y centrado, más fácil es la pala.",
      },
      {
        question: "¿Qué es una pala híbrida?",
        answer:
          "Un nombre que usan algunos fabricantes y tiendas para formas intermedias, normalmente entre la lágrima y la diamante. En PalaRadar la tratamos como una forma propia cuando la marca la declara así.",
      },
      {
        question: "¿Puedo pasar de una redonda a una diamante directamente?",
        answer:
          "Se puede, pero el cambio es grande: el punto dulce sube y el peso se va a la cabeza. Pasar antes por una lágrima suele hacer la adaptación más fácil.",
      },
    ],
    collections: ["redondas", "lagrima", "diamante", "hibridas"],
  },
  {
    slug: "balance-pala-de-padel",
    title: "El balance de una pala de pádel",
    subtitle: "Bajo, medio o alto: qué cambia y cuál te conviene",
    image: null,
    description:
      "Qué es el balance de una pala de pádel y cómo influye: balance bajo, medio y alto, su relación con la forma y el peso, y cuál elegir según tu juego.",
    updatedAt: UPDATED,
    intro: [
      "Dos palas pueden pesar lo mismo y sentirse muy distintas en la mano. La diferencia suele estar en el balance: dónde se concentra ese peso, cerca del puño o hacia la cabeza.",
      "Es uno de los datos que más cambian cómo se mueve una pala y uno de los que menos se miran. Aquí explicamos los tres tipos y, de cada uno, enseñamos la pala mejor puntuada que hoy está a la venta.",
    ],
    picks: [
      {
        id: "bajo",
        eyebrow: "Balance bajo",
        title: "La pala se mueve rápido",
        query: { balances: ["bajo"] },
        why: "El peso queda cerca de la mano. La pala cambia de dirección con facilidad, llega antes a las voleas y cansa menos en partidos largos. A cambio, hay menos inercia en el remate: la potencia la tienes que poner tú. Es el balance habitual de las palas redondas y de las de iniciación.",
      },
      {
        id: "medio",
        eyebrow: "Balance medio",
        title: "El reparto equilibrado",
        query: { balances: ["medio"] },
        why: "El peso se reparte entre la cabeza y el puño. No destaca en un extremo ni en otro, que es justo lo que busca quien defiende, volea y remata en el mismo partido. Es el balance más frecuente en las palas de lágrima.",
      },
      {
        id: "alto",
        eyebrow: "Balance alto",
        title: "Más inercia en el remate",
        query: { balances: ["alto"] },
        why: "El peso se va hacia la cabeza. Al golpear por arriba la pala lleva más inercia y la bola sale con más velocidad. Se paga en la defensa y en la red, donde la pala tarda más en moverse, y se nota más en el brazo cuando el partido se alarga. Es el balance típico de las palas de diamante.",
      },
    ],
    blocks: [
      {
        id: "forma-y-peso",
        title: "Balance, forma y peso van juntos",
        paragraphs: [
          "La forma orienta el balance, pero no lo decide: hay palas redondas con balance medio y lágrimas con balance alto. Por eso conviene mirar los dos datos por separado.",
          "El peso multiplica el efecto. Una pala pesada con balance alto es la combinación más exigente; una ligera con balance bajo, la más manejable. Y el overgrip añade unos gramos en el puño, lo que baja un poco el balance.",
          "No todas las palas publican su balance. Cuando una ficha no lo enseña es porque la fuente no lo declara, y no lo damos por supuesto a partir de la forma.",
        ],
        links: [
          { label: "Palas manejables: redondas y de balance bajo", href: routes.collection("manejables") },
          { label: "Diamante y balance alto", href: catalogHref({ shapes: ["diamante"], balances: ["alto"] }) },
        ],
      },
    ],
    faq: [
      {
        question: "¿Cómo se mide el balance de una pala?",
        answer:
          "Es la distancia desde el extremo del puño hasta el punto en el que la pala queda en equilibrio. Los fabricantes suelen resumirlo en bajo, medio o alto, que es como lo enseñamos.",
      },
      {
        question: "¿Qué balance es mejor para empezar?",
        answer:
          "Bajo o medio. Una pala que se mueve con facilidad ayuda a llegar bien colocado a la bola, que es lo que más cuesta al principio.",
      },
      {
        question: "¿El balance alto da más potencia siempre?",
        answer:
          "Da más inercia en los golpes por arriba si llegas a tiempo y golpeas bien. Si la pala te resulta lenta, llegarás tarde y perderás más de lo que ganas.",
      },
      {
        question: "¿Puedo cambiar el balance de mi pala?",
        answer:
          "Ligeramente. Un overgrip más lo baja; un protector en la cabeza lo sube. Son ajustes de pocos gramos, no convierten una pala en otra.",
      },
    ],
    collections: ["manejables", "redondas", "lagrima", "diamante"],
  },
  {
    slug: "pala-blanda-o-dura",
    title: "Pala blanda o dura",
    subtitle: "Cómo influye la dureza y cuál elegir",
    image: null,
    description:
      "Diferencias entre una pala de pádel blanda y una dura: salida de bola, control, potencia y comodidad. De qué depende la dureza y cómo elegirla.",
    updatedAt: UPDATED,
    intro: [
      "«Blanda» y «dura» son las dos palabras que más se oyen al hablar de palas, y también las que más confunden. La dureza no es un nivel de calidad: es una forma de responder al golpe.",
      "Esta guía explica qué cambia entre un tacto y otro, de qué depende y cómo leer ese dato en una ficha.",
    ],
    picks: [],
    blocks: [
      {
        id: "que-cambia",
        title: "Qué cambia entre una pala blanda y una dura",
        paragraphs: [
          "Una pala blanda se deforma más al impactar y devuelve esa energía a la bola: la bola sale con facilidad aunque el golpe sea suave. Se nota en la defensa y en los globos, y el tacto resulta más cómodo.",
          "Una pala dura se deforma menos. Con golpes suaves la bola sale poco, pero cuando se golpea fuerte responde con más precisión y no «se come» la bola. Por eso las prefieren quienes rematan mucho y golpean limpio.",
          "Entre las dos hay tactos medios, que son los más repartidos en el catálogo y los que menos condicionan.",
        ],
      },
      {
        id: "de-que-depende",
        title: "De qué depende la dureza",
        paragraphs: [
          "Sobre todo del núcleo: la goma interior, casi siempre EVA de distintas densidades o FOAM. Cuanto más densa, más duro el tacto.",
          "Las caras también cuentan. La fibra de vidrio es más flexible que el carbono, y dentro del carbono cada tejido se comporta distinto. La misma goma con caras diferentes da tactos diferentes.",
          "Y la temperatura: con frío las gomas se endurecen y con calor se ablandan. Una pala puede sentirse distinta en invierno y en verano.",
        ],
      },
      {
        id: "cual-elegir",
        title: "Cuál elegir",
        paragraphs: [
          "Si estás empezando o juegas sobre todo desde el fondo, un tacto blando o medio te dará salida de bola sin esfuerzo. Si atacas mucho y ya golpeas con fuerza, un tacto medio o duro te dará más control en esos golpes.",
          "Si dudas, el tacto medio rara vez es un error. Y si puedes probar la pala antes de comprarla, hazlo: es la característica más personal de todas.",
        ],
        links: [
          { label: "Haz el test de Pala ideal y elige tu tacto", href: routes.idealPala },
          { label: "Palas para principiantes", href: routes.collection("principiantes") },
        ],
      },
      {
        id: "en-la-ficha",
        title: "Cómo leerlo en una ficha",
        paragraphs: [
          "En cada ficha enseñamos el tacto o la dureza que declara la fuente, con sus palabras. No hay una escala común: lo que una marca llama «medio» otra puede llamarlo «medio-duro», así que sirve mejor para comparar palas de una misma marca que de marcas distintas.",
          "Si una ficha no enseña ese dato es porque no está declarado. En ese caso, el núcleo y las caras, que sí suelen estar, dan una pista.",
        ],
      },
    ],
    faq: [
      {
        question: "¿Una pala dura tiene más potencia?",
        answer:
          "En golpes fuertes y bien dados, sí responde mejor. En golpes suaves ocurre lo contrario: la blanda da más salida. Depende de cómo golpees tú.",
      },
      {
        question: "¿Las palas blandas duran menos?",
        answer:
          "Las gomas blandas tienden a perder respuesta antes con el uso intenso, aunque depende mucho del modelo y de cuánto se juegue. No hay una regla fija.",
      },
      {
        question: "¿Qué significa EVA Soft, EVA Hard o MultiEVA?",
        answer:
          "Son nombres comerciales de gomas de distinta densidad. «Soft» y «Hard» indican blanda y dura; las gomas «multi» combinan capas de densidades diferentes. Cada marca usa sus propios nombres.",
      },
    ],
    collections: ["principiantes", "control", "potencia", "polivalentes"],
  },
  {
    slug: "pala-de-la-temporada-anterior",
    title: "¿Pala nueva o de la temporada anterior?",
    subtitle: "Qué revisar antes de comprar una edición pasada",
    image: null,
    description:
      "Cuándo compensa comprar una pala de pádel de la temporada anterior, qué suele cambiar entre ediciones y qué revisar antes de comprarla.",
    updatedAt: UPDATED,
    intro: [
      "Cada temporada las marcas renuevan sus gamas, y las ediciones anteriores siguen a la venta durante meses, a menudo más baratas. Para mucha gente son la mejor compra; para otra, no.",
      "La diferencia entre dos ediciones de un mismo modelo se puede comprobar: está en sus datos. Esta guía explica qué mirar.",
    ],
    picks: [
      {
        id: "anterior",
        eyebrow: "Temporada 2025",
        title: "La mejor puntuada que sigue a la venta",
        query: { years: [2025] },
        why: "Entre las palas de la temporada 2025 que hoy tienen precio en las tiendas que seguimos, esta es la que tiene la puntuación técnica total más alta. Sirve como referencia de lo que se puede encontrar en una edición pasada.",
      },
    ],
    blocks: [
      {
        id: "que-cambia",
        title: "Qué suele cambiar de una edición a otra",
        paragraphs: [
          "Lo más frecuente es que cambien la estética y algún material de las caras o del núcleo, y que el molde, la forma y el balance se mantengan. Otras veces el fabricante rehace el modelo y solo conserva el nombre.",
          "No hay forma de saberlo por el nombre. Hay que enfrentar las dos fichas: forma, balance, peso, núcleo, caras y marco.",
        ],
      },
      {
        id: "como-comparar",
        title: "Cómo compararlas en PalaRadar",
        paragraphs: [
          "Cuando tenemos dos ediciones del mismo modelo, la ficha de cada una enseña la otra en «Otras temporadas», con lo que cambia, lo que se mantiene y la diferencia de precio de hoy.",
          "Solo comparamos lo que las dos ediciones declaran. Si un dato lo publica una y la otra no, lo decimos: no damos por hecho que sea igual.",
        ],
        links: [
          { label: "Comparador de palas", href: routes.compare },
          { label: "Palas de la temporada 2026", href: routes.collection("2026") },
        ],
      },
      {
        id: "que-revisar",
        title: "Qué revisar antes de comprar una edición pasada",
        paragraphs: [
          "Primero, que sea la misma pala: comprueba el año en el nombre del producto de la tienda. Los nombres se repiten entre temporadas y es fácil confundirlas.",
          "Después, el precio. Una edición anterior no siempre es más barata: cuando quedan pocas unidades puede incluso subir. Compara el precio de hoy de las dos.",
          "Y la disponibilidad: una edición pasada puede estar en una sola tienda. Mira en cuántas la encontramos y si su precio está comprobado hoy.",
        ],
        links: [{ label: "Ofertas de hoy", href: routes.deals }],
      },
    ],
    faq: [
      {
        question: "¿Una pala de la temporada anterior es peor?",
        answer:
          "No por ser anterior. Es otra edición: puede ser casi idéntica o bastante distinta. Lo que cuenta es si sus características encajan con tu juego y cuánto cuesta hoy.",
      },
      {
        question: "¿Cuándo salen las palas nuevas?",
        answer:
          "Depende de cada marca; no hay una fecha común. Lo que sí se repite es que, cuando llega la edición nueva, la anterior suele seguir a la venta un tiempo.",
      },
      {
        question: "¿Cómo sé de qué año es una pala?",
        answer:
          "En PalaRadar cada ficha lleva su temporada en el título y en las especificaciones. En las tiendas no siempre aparece en el nombre: por eso hay productos que dejamos sin emparejar hasta confirmar el año.",
      },
    ],
    collections: ["2026", "menos-de-150-euros", "menos-de-200-euros"],
  },
  {
    slug: "como-saber-si-una-oferta-es-buena",
    title: "Cómo saber si una oferta es buena",
    subtitle: "Precio recomendado, histórico, envío y lo que conviene comprobar",
    image: null,
    description:
      "Cómo valorar una oferta de una pala de pádel: descuento sobre el precio recomendado, histórico de precios, gastos de envío y vigencia del precio.",
    updatedAt: UPDATED,
    intro: [
      "Un cartel de «−40 %» dice poco si no sabes sobre qué precio se calcula ni cuánto costaba esa pala la semana pasada. Una oferta es buena cuando el precio de hoy es bajo respecto a lo que la pala cuesta de verdad.",
      "Estas son las cuatro comprobaciones que hacemos en cada ficha, y que puedes hacer tú con cualquier pala.",
    ],
    picks: [],
    blocks: [
      {
        id: "pvpr",
        title: "1. El descuento sobre el precio recomendado",
        paragraphs: [
          "El precio de venta recomendado (PVPR) lo fija el fabricante al lanzar la pala. Casi ninguna tienda lo cobra: lo normal es que una pala esté por debajo desde el primer mes.",
          "Por eso un descuento sobre el PVPR indica cuánto has bajado del precio de catálogo, no que hoy sea un buen día para comprar. En la ficha lo enseñamos como un dato aparte del histórico.",
        ],
      },
      {
        id: "historico",
        title: "2. Lo que ha costado antes",
        paragraphs: [
          "Lo que de verdad importa es comparar el precio de hoy con el de las últimas semanas. Guardamos el mejor precio de cada día y, cuando una pala lleva 30 días en seguimiento, calculamos su media y su mínimo de ese periodo.",
          "Con eso damos un veredicto («buen momento para comprar», «precio normal», «puedes esperar») y un índice de oportunidad de 0 a 100, que suma tres cosas: cuánto está por debajo de su media, si está cerca de su mínimo y si ha bajado en la última semana.",
          "Con menos de 30 días no damos ni veredicto ni índice. Con tan pocos datos, cualquier precio parecería el mejor que se ha visto.",
        ],
      },
      {
        id: "envio",
        title: "3. El precio final, con envío",
        paragraphs: [
          "Dos tiendas con el mismo precio pueden no costar lo mismo si una cobra el envío. Donde conocemos los gastos de envío, el precio que enseñamos ya los incluye.",
          "Donde no los hemos verificado, lo indicamos junto al precio, que entonces es solo el de la pala, y no señalamos ninguna tienda como la más barata. En ese caso, compruébalo antes de pagar.",
        ],
      },
      {
        id: "vigencia",
        title: "4. Que el precio siga vigente",
        paragraphs: [
          "Comprobamos los precios varias veces al día. Junto a cada precio decimos cuándo se comprobó: si llevamos un tiempo sin poder confirmarlo, lo presentamos como último precio conocido y, si pasa más, como precio sin confirmar.",
          "Un precio sin confirmar nunca aparece como oferta. El precio que cuenta es siempre el que veas en la tienda al comprar.",
        ],
        links: [
          { label: "Ofertas de hoy", href: routes.deals },
          { label: "Palas por menos de 150 €", href: routes.collection("menos-de-150-euros") },
        ],
      },
    ],
    faq: [
      {
        question: "¿Qué es el índice de oportunidad?",
        answer:
          "Una puntuación de 0 a 100 que resume cómo de bueno es el precio de hoy frente a lo que la pala ha costado en los últimos 30 días. 50 es su precio habitual. Es una orientación a partir de nuestros datos, no una predicción de lo que hará el precio.",
      },
      {
        question: "¿Por qué una pala rebajada dice «precio reciente»?",
        answer:
          "Porque llevamos menos de 30 días siguiendo su precio y todavía no podemos compararlo con su histórico. El descuento que ves es respecto a su precio anterior en la tienda.",
      },
      {
        question: "¿Los precios incluyen cupones o códigos de descuento?",
        answer:
          "No. Enseñamos el precio público que la tienda muestra en la página del producto. Si la tienda tiene un cupón, el precio final puede ser menor.",
      },
      {
        question: "¿Cobráis por enseñar una tienda antes que otra?",
        answer:
          "No. Las tiendas se ordenan por precio, de más barata a más cara. Si en el futuro hay enlaces de afiliación o contenido patrocinado, se indicará de forma visible y no cambiará ese orden.",
      },
    ],
    collections: ["menos-de-100-euros", "menos-de-150-euros", "menos-de-200-euros"],
  },
  {
    slug: "cuanto-gastar-en-una-pala-de-padel",
    title: "Cuánto gastar en una pala de pádel",
    subtitle: "Qué se paga en cada tramo de precio y cuándo compensa subir",
    image: null,
    description:
      "Cuánto cuesta una pala de pádel según la gama, qué se paga al subir de precio y cuándo merece la pena gastar más. Con la mejor puntuada de cada presupuesto.",
    updatedAt: UPDATED,
    intro: [
      "Hay palas a la venta desde menos de 50 euros hasta más de 300. La más cara no es la que mejor te va a ir: es la que usa los materiales más caros y, casi siempre, la más exigente.",
      "Esta guía recorre los tramos de precio y enseña, en cada uno, la pala mejor puntuada que hoy está por debajo de ese tope.",
    ],
    picks: [
      {
        id: "hasta-100",
        eyebrow: "Hasta 100 €",
        title: "Para empezar o jugar de vez en cuando",
        query: { maxPrice: 100 },
        why: "En este tramo están las palas de iniciación y algunos modelos de temporadas pasadas. Predominan las caras de fibra de vidrio y los núcleos blandos: palas cómodas y tolerantes. Es suficiente para aprender y para jugar de forma ocasional.",
      },
      {
        id: "hasta-150",
        eyebrow: "Hasta 150 €",
        title: "El tramo con más donde elegir",
        query: { maxPrice: 150 },
        why: "Aparece el carbono en las caras y hay modelos para todos los niveles y formas de jugar. También entran palas de gamas superiores de la temporada anterior. Para quien juega con regularidad, suele ser el punto de equilibrio entre precio y prestaciones.",
      },
      {
        id: "hasta-200",
        eyebrow: "Hasta 200 €",
        title: "Gama media-alta",
        query: { maxPrice: 200 },
        why: "Más carbono, tejidos de más filamentos y modelos de jugador. Muchas de estas palas se dirigen a nivel avanzado: dan más cuando se golpea bien y perdonan menos cuando no.",
      },
    ],
    blocks: [
      {
        id: "que-se-paga",
        title: "Qué se paga al subir de precio",
        paragraphs: [
          "Materiales y fabricación: carbono en lugar de fibra de vidrio, tejidos más elaborados, superficies con relieve, sistemas para repartir el peso o reducir vibraciones. También el nombre del jugador que la lleva.",
          "Lo que no se paga es la facilidad. Las palas más caras de cada marca están pensadas para jugadores con mucha técnica. Por encima de tu nivel, una pala cara no te hace jugar mejor.",
        ],
      },
      {
        id: "cuando-compensa",
        title: "Cuándo compensa gastar más",
        paragraphs: [
          "Cuando juegas a menudo y ya sabes qué te falta: más control en la red, más pegada, un tacto concreto. Entonces tiene sentido buscar la pala que lo da y pagar lo que cueste.",
          "Si todavía no lo sabes, compensa más una pala equilibrada de gama media y dejar la diferencia para clases o para cambiarla cuando tu juego lo pida.",
          "Y antes de pagar el precio de salida de una novedad, mira la edición anterior del mismo modelo y el histórico de precios: las palas bajan durante el año.",
        ],
        links: [
          { label: "¿Pala nueva o de la temporada anterior?", href: routes.guide("pala-de-la-temporada-anterior") },
          { label: "Cómo saber si una oferta es buena", href: routes.guide("como-saber-si-una-oferta-es-buena") },
          { label: "Test de Pala ideal con tu presupuesto", href: routes.idealPala },
        ],
      },
    ],
    faq: [
      {
        question: "¿Cuánto cuesta una buena pala de pádel?",
        answer:
          "Depende de para quién. Para empezar, por menos de 100 euros hay palas adecuadas. Para jugar con regularidad, entre 100 y 200 euros está la mayor parte de la oferta. Los precios de cada tramo se actualizan a diario en las colecciones por precio.",
      },
      {
        question: "¿Por qué la misma pala cuesta distinto en cada tienda?",
        answer:
          "Cada tienda fija su precio y lo cambia cuando quiere. Por eso comparamos el precio de cada pala en las tiendas que seguimos y lo comprobamos varias veces al día.",
      },
      {
        question: "¿Las palas de más de 250 euros merecen la pena?",
        answer:
          "Para un jugador avanzado que busca algo concreto, pueden. Para la mayoría, la diferencia en la pista respecto a una pala de 150 a 200 euros es menor que la diferencia de precio.",
      },
    ],
    collections: ["menos-de-100-euros", "menos-de-150-euros", "menos-de-200-euros", "principiantes"],
  },
];

export function getGuide(slug: string): GuideDoc | null {
  return guides.find((guide) => guide.slug === slug) ?? null;
}

/** Pala destacada en la portada */
export const featuredPalaSlug = "bullpadel-vertex-04-2025";
