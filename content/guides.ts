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
    collections: ["redondas", "lagrima", "diamante"],
  },
];

export function getGuide(slug: string): GuideDoc | null {
  return guides.find((guide) => guide.slug === slug) ?? null;
}

/** Pala destacada en la portada */
export const featuredPalaSlug = "bullpadel-vertex-04-2025";
