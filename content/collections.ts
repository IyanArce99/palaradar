// Colecciones del catálogo: páginas propias para las búsquedas habituales
// («palas redondas», «palas de control», «palas para principiantes»…). Cada una
// es un filtro sobre datos declarados de las palas, con un texto que explica el
// criterio. El texto es conocimiento general de pádel: no valora ninguna pala
// concreta ni promete resultados; las palas y sus precios salen del catálogo.
import type { CatalogQuery } from "@/lib/catalog/query";
import type { FaqItem } from "@/types/catalog";

export interface Collection {
  /** Segmento de la URL: /palas-padel/{slug}/ */
  slug: string;
  /** Titular de la página */
  title: string;
  /** Texto corto para enlaces («Redondas», «De control») */
  label: string;
  /** Grupo en el que se enseña en los listados de enlaces */
  group: "forma" | "juego" | "nivel" | "precio" | "temporada";
  /** Filtro del catálogo que define la colección */
  query: Partial<CatalogQuery>;
  /** Descripción para buscadores */
  description: string;
  /** Texto de entrada, en párrafos */
  intro: string[];
  faq: FaqItem[];
  /** Guía que amplía el tema */
  guide?: string;
  /** Otras colecciones que suele mirar quien mira esta */
  related: string[];
}

export const collections: Collection[] = [
  {
    slug: "redondas",
    title: "Palas de pádel redondas",
    label: "Redondas",
    group: "forma",
    query: { shapes: ["redonda"] },
    description:
      "Palas de pádel de forma redonda: punto dulce amplio y centrado, más control y más fáciles de manejar. Compara características y precios.",
    intro: [
      "La forma redonda reparte el peso cerca del puño y deja el punto dulce amplio y en el centro de la cara. Es la forma que más perdona los golpes descentrados, por eso es la habitual en palas de control y en las pensadas para empezar.",
      "A cambio, suele dar menos potencia en el remate que una lágrima o una diamante. Si construyes el punto desde el fondo, juegas mucho de volea o quieres una pala cómoda de mover, es por donde empezar a mirar.",
    ],
    faq: [
      {
        question: "¿Para quién es una pala redonda?",
        answer:
          "Para quien prioriza el control y la manejabilidad: jugadores que empiezan, jugadores de fondo y quienes prefieren colocar la bola antes que rematar. También hay palas redondas de gama alta para jugadores avanzados de control.",
      },
      {
        question: "¿Una pala redonda tiene menos potencia?",
        answer:
          "En general sí: su peso está más cerca de la mano y el punto dulce queda más bajo, así que el remate sale con menos inercia que con una diamante. La potencia también depende del núcleo, de las caras y del balance de cada pala.",
      },
      {
        question: "¿Qué diferencia hay entre una redonda y una de lágrima?",
        answer:
          "La lágrima sube un poco el punto dulce y el balance: gana potencia y pierde algo de tolerancia. La redonda es más fácil; la lágrima, más polivalente.",
      },
    ],
    guide: "forma-redonda-lagrima-diamante",
    related: ["control", "principiantes", "lagrima"],
  },
  {
    slug: "lagrima",
    title: "Palas de pádel de lágrima",
    label: "De lágrima",
    group: "forma",
    query: { shapes: ["lagrima"] },
    description:
      "Palas de pádel de forma de lágrima: el equilibrio entre control y potencia. Compara características y el mejor precio de cada una.",
    intro: [
      "La lágrima es el punto medio entre la redonda y la diamante: el punto dulce queda en el centro o algo por encima y el balance suele ser medio. Es la forma más polivalente, y por eso la que más modelos tiene en casi todas las marcas.",
      "Encaja con quien hace un poco de todo en la pista: defiende, volea y también remata. Si no tienes claro si necesitas más control o más potencia, una lágrima rara vez es un error.",
    ],
    faq: [
      {
        question: "¿Para qué nivel es una pala de lágrima?",
        answer:
          "Hay lágrimas para todos los niveles. Las de núcleo blando y balance medio son habituales en nivel intermedio; las de carbono y tacto duro se dirigen a jugadores avanzados.",
      },
      {
        question: "¿Lágrima o diamante?",
        answer:
          "La diamante concentra más peso en la cabeza y da más potencia en el remate, pero exige más técnica y más brazo. La lágrima es más equilibrada y más fácil de controlar.",
      },
    ],
    guide: "forma-redonda-lagrima-diamante",
    related: ["polivalentes", "nivel-intermedio", "diamante"],
  },
  {
    slug: "diamante",
    title: "Palas de pádel de diamante",
    label: "De diamante",
    group: "forma",
    query: { shapes: ["diamante"] },
    description:
      "Palas de pádel de forma de diamante: punto dulce alto y más potencia en el remate. Compara modelos, características y precios.",
    intro: [
      "La forma de diamante lleva el punto dulce a la parte alta de la cara y, normalmente, el balance hacia la cabeza. Es la forma de las palas de potencia: más inercia en el remate y en la bandeja.",
      "Son palas exigentes: el punto dulce es más pequeño y el balance alto se nota en la defensa y en los partidos largos. Tienen sentido si ya rematas con soltura y ganas los puntos atacando.",
    ],
    faq: [
      {
        question: "¿Una pala de diamante es buena para empezar?",
        answer:
          "No suele serlo. El punto dulce alto y pequeño penaliza los golpes descentrados, que son frecuentes al empezar. Para iniciarse se recomienda una pala redonda o de lágrima con balance bajo o medio.",
      },
      {
        question: "¿Todas las palas de diamante tienen balance alto?",
        answer:
          "La mayoría, pero no todas: hay diamantes de balance medio pensadas para ganar potencia sin perder tanta manejabilidad. El balance declarado de cada pala está en su ficha.",
      },
    ],
    guide: "forma-redonda-lagrima-diamante",
    related: ["potencia", "nivel-avanzado", "lagrima"],
  },
  {
    slug: "control",
    title: "Palas de pádel de control",
    label: "De control",
    group: "juego",
    query: { styles: ["control"] },
    description:
      "Palas de pádel de control: precisión y seguridad para construir el punto. Compara características y precios en las tiendas que seguimos.",
    intro: [
      "Una pala de control es la que el fabricante orienta a colocar la bola antes que a rematarla. Suelen ser redondas o de lágrima, con balance bajo o medio y un punto dulce amplio.",
      "Son la elección habitual de quien juega desde el fondo, de quien prefiere la volea a la definición por alto y de quien busca regularidad. Aquí están todas las palas del catálogo cuyo estilo de juego declarado es el control.",
    ],
    faq: [
      {
        question: "¿Qué hace que una pala sea de control?",
        answer:
          "Sobre todo la forma y el balance: una cara redonda con el peso cerca del puño es más fácil de dirigir. También influyen un núcleo de dureza media y unas caras que no devuelvan la bola demasiado rápido.",
      },
      {
        question: "¿Las palas de control son solo para principiantes?",
        answer:
          "No. Muchos jugadores avanzados y profesionales del lado de drive usan palas de control. Lo que cambia entre gamas son los materiales y el tacto, no la orientación.",
      },
    ],
    guide: "como-elegir-pala-de-padel",
    related: ["redondas", "polivalentes", "principiantes"],
  },
  {
    slug: "potencia",
    title: "Palas de pádel de potencia",
    label: "De potencia",
    group: "juego",
    query: { styles: ["potencia"] },
    description:
      "Palas de pádel de potencia: para atacar, rematar y cerrar el punto. Compara modelos, características y su mejor precio hoy.",
    intro: [
      "Las palas de potencia están pensadas para quien gana los puntos atacando. Lo habitual es una forma de diamante o una lágrima alta, balance medio-alto y caras de carbono que devuelven la bola con más velocidad.",
      "Piden técnica y físico: el peso en la cabeza ayuda en el remate, pero se nota al defender y al volear rápido. Aquí están las palas cuyo estilo de juego declarado es la potencia.",
    ],
    faq: [
      {
        question: "¿Qué pala da más potencia?",
        answer:
          "La potencia viene de la combinación de forma (diamante), balance alto y materiales duros. No hay una única «más potente»: en cada ficha puedes ver la forma, el balance y, cuando existen, las puntuaciones técnicas de PadelZoom.",
      },
      {
        question: "¿Una pala de potencia es recomendable en nivel intermedio?",
        answer:
          "Depende de tu técnica. Si todavía fallas golpes por alto, una pala polivalente te dará más regularidad. Si ya rematas con confianza, una pala de potencia de balance medio es un buen primer paso.",
      },
    ],
    guide: "mejores-palas-padel-2026",
    related: ["diamante", "polivalentes", "nivel-avanzado"],
  },
  {
    slug: "polivalentes",
    title: "Palas de pádel polivalentes",
    label: "Polivalentes",
    group: "juego",
    query: { styles: ["polivalente"] },
    description:
      "Palas de pádel polivalentes: equilibrio entre control y potencia para jugar a todo. Compara características y precios.",
    intro: [
      "Una pala polivalente no destaca en un solo golpe: busca el equilibrio. Casi siempre es una lágrima de balance medio, con control suficiente en defensa y potencia razonable para definir.",
      "Es la opción más segura si juegas en los dos lados, si cambias de compañero a menudo o si todavía estás descubriendo tu forma de jugar.",
    ],
    faq: [
      {
        question: "¿Polivalente significa que no hace nada bien?",
        answer:
          "No: significa que no te obliga a jugar de una sola manera. Una pala polivalente de buena gama defiende y ataca con solvencia; lo que no tiene es el extremo de una diamante de balance alto ni el de una redonda muy blanda.",
      },
      {
        question: "¿Qué forma tienen las palas polivalentes?",
        answer:
          "La mayoría son de lágrima; también hay híbridas. La forma de cada una está en su ficha.",
      },
    ],
    guide: "como-elegir-pala-de-padel",
    related: ["lagrima", "nivel-intermedio", "control"],
  },
  {
    slug: "principiantes",
    title: "Palas de pádel para principiantes",
    label: "Para empezar",
    group: "nivel",
    query: { levels: ["iniciacion"] },
    description:
      "Palas de pádel para principiantes: fáciles de manejar y que perdonan. Compara las palas de iniciación y su precio en cada tienda.",
    intro: [
      "Para empezar conviene una pala que perdone: forma redonda, balance bajo, peso contenido y un núcleo que no sea duro. Así el punto dulce es grande, la pala se mueve con facilidad y los golpes descentrados no castigan tanto.",
      "No hace falta gastar mucho: las palas de iniciación son de las más baratas del catálogo. Aquí están las que los fabricantes declaran para nivel de iniciación.",
    ],
    faq: [
      {
        question: "¿Qué pala de pádel comprar para empezar?",
        answer:
          "Una redonda o de lágrima de balance bajo o medio, de entre 350 y 370 gramos y de tacto blando o medio. Evita al principio las diamante de balance alto: son más difíciles de controlar.",
      },
      {
        question: "¿Cuánto debería gastarme en mi primera pala?",
        answer:
          "Hay palas de iniciación correctas por menos de 100 euros. Tiene más sentido empezar con una pala sencilla y cambiar cuando tengas claro cómo juegas.",
      },
      {
        question: "¿Cuándo cambiar a una pala de nivel intermedio?",
        answer:
          "Cuando juegues con regularidad, mantengas peloteos y notes que la pala se te queda corta en potencia o en tacto. No hay un plazo fijo.",
      },
    ],
    guide: "palas-para-principiantes",
    related: ["redondas", "menos-de-100-euros", "nivel-intermedio"],
  },
  {
    slug: "nivel-intermedio",
    title: "Palas de pádel para nivel intermedio",
    label: "Nivel intermedio",
    group: "nivel",
    query: { levels: ["intermedio"] },
    description:
      "Palas de pádel para nivel intermedio: el paso siguiente a la pala de iniciación. Compara características y precios.",
    intro: [
      "En nivel intermedio ya se juega con regularidad y se empieza a notar qué golpes hacen ganar puntos. Es el momento de elegir según tu juego: más control si construyes, más potencia si defines.",
      "La mayoría de las palas de este nivel son lágrimas y redondas de balance medio, con mejores materiales que las de iniciación. Aquí están las que los fabricantes declaran para nivel intermedio.",
    ],
    faq: [
      {
        question: "¿Qué cambia entre una pala de iniciación y una intermedia?",
        answer:
          "Los materiales y el tacto: aparecen el carbono en las caras o en el marco y núcleos con más respuesta. La pala transmite más y exige un golpeo algo más limpio.",
      },
      {
        question: "¿Puedo usar una pala avanzada siendo intermedio?",
        answer:
          "Puedes, pero las palas avanzadas suelen ser más duras y con el punto dulce más pequeño. Si fallas a menudo el centro de la cara, una pala intermedia te dará más regularidad.",
      },
    ],
    guide: "mejores-palas-nivel-intermedio",
    related: ["polivalentes", "lagrima", "menos-de-150-euros"],
  },
  {
    slug: "nivel-avanzado",
    title: "Palas de pádel para nivel avanzado",
    label: "Nivel avanzado",
    group: "nivel",
    query: { levels: ["avanzado"] },
    description:
      "Palas de pádel para jugadores avanzados: más respuesta y más exigencia. Compara modelos, características y precios.",
    intro: [
      "Las palas de nivel avanzado dan más de todo a cambio de pedir más: caras de carbono, núcleos más firmes y puntos dulces menos tolerantes. Premian el golpeo limpio.",
      "A este nivel la elección depende casi por completo de tu juego y de tu lado de la pista. Aquí están las palas que los fabricantes declaran para nivel avanzado.",
    ],
    faq: [
      {
        question: "¿Qué diferencia a una pala avanzada?",
        answer:
          "Materiales más rígidos (carbono de distintos trenzados), tactos de medio a duro y balances más marcados. Transmiten más potencia y precisión cuando se golpea bien.",
      },
      {
        question: "¿Las palas avanzadas son siempre las más caras?",
        answer:
          "Suelen serlo de salida, pero su precio baja mucho con el tiempo. Los modelos de la temporada anterior aparecen a menudo muy por debajo de su precio recomendado.",
      },
    ],
    guide: "mejores-palas-padel-2026",
    related: ["potencia", "diamante", "control"],
  },
  {
    slug: "menos-de-100-euros",
    title: "Palas de pádel por menos de 100 €",
    label: "Menos de 100 €",
    group: "precio",
    query: { maxPrice: 100 },
    description:
      "Palas de pádel por menos de 100 euros con su mejor precio de hoy en las tiendas que seguimos. Compara características antes de comprar.",
    intro: [
      "Por menos de 100 euros hay palas de iniciación nuevas y también modelos de temporadas anteriores que han bajado de precio. Es el presupuesto habitual para una primera pala.",
      "La lista se actualiza con cada comprobación de precios: solo aparecen las palas cuyo mejor precio de hoy, en alguna de las tiendas que seguimos, está por debajo de 100 euros.",
    ],
    faq: [
      {
        question: "¿Merece la pena una pala de menos de 100 euros?",
        answer:
          "Para empezar o para jugar de forma ocasional, sí. Lo que se ahorra suele estar en los materiales: fibra de vidrio en lugar de carbono, que además da un tacto más blando y cómodo.",
      },
      {
        question: "¿El precio incluye el envío?",
        answer:
          "No siempre. En la ficha de cada pala se indica, tienda a tienda, si el envío está incluido.",
      },
    ],
    guide: "palas-menos-de-150-euros",
    related: ["principiantes", "menos-de-150-euros", "redondas"],
  },
  {
    slug: "menos-de-150-euros",
    title: "Palas de pádel por menos de 150 €",
    label: "Menos de 150 €",
    group: "precio",
    query: { maxPrice: 150 },
    description:
      "Palas de pádel por menos de 150 euros: gama media y modelos rebajados, con su mejor precio de hoy. Compara antes de comprar.",
    intro: [
      "Hasta 150 euros entra buena parte de la gama media y muchos modelos de la temporada anterior de gamas superiores. Es el tramo con más variedad de formas y de niveles.",
      "Aquí están todas las palas cuyo mejor precio de hoy no pasa de 150 euros. Los precios cambian a diario: cada ficha enseña el de cada tienda.",
    ],
    faq: [
      {
        question: "¿Qué se puede esperar de una pala de 150 euros?",
        answer:
          "Caras con fibra de carbono o mezcla de carbono y vidrio, y modelos de nivel intermedio de las principales marcas. También palas de gama alta de temporadas pasadas con descuento.",
      },
      {
        question: "¿Es mejor una pala nueva de gama media o una de gama alta del año pasado?",
        answer:
          "Depende de tu nivel: una gama alta rebajada sigue siendo exigente. Compara la forma, el balance y el nivel declarado de las dos antes de decidir por precio.",
      },
    ],
    guide: "palas-menos-de-150-euros",
    related: ["menos-de-100-euros", "menos-de-200-euros", "nivel-intermedio"],
  },
  {
    slug: "menos-de-200-euros",
    title: "Palas de pádel por menos de 200 €",
    label: "Menos de 200 €",
    group: "precio",
    query: { maxPrice: 200 },
    description:
      "Palas de pádel por menos de 200 euros con su mejor precio de hoy: gama media-alta y modelos de gama alta rebajados. Compara antes de comprar.",
    intro: [
      "Hasta 200 euros entran casi todas las gamas medias, bastantes modelos de gama alta de la temporada en curso cuando bajan de precio y la mayoría de los de temporadas anteriores.",
      "La lista se recalcula con cada comprobación de precios: solo aparecen las palas cuyo mejor precio de hoy, en alguna de las tiendas que seguimos, no pasa de 200 euros.",
    ],
    faq: [
      {
        question: "¿Qué cambia entre una pala de 150 y una de 200 euros?",
        answer:
          "Sobre todo los materiales de las caras (más carbono y tejidos de más filamentos) y que aparecen modelos de jugador. No implica que la pala sea más fácil de jugar: muchas de este tramo se dirigen a nivel avanzado.",
      },
      {
        question: "¿Cómo sé si una pala de este precio está rebajada de verdad?",
        answer:
          "En su ficha comparamos el precio de hoy con su precio de venta recomendado y, cuando lleva 30 días en seguimiento, con lo que ha costado ese mes. Un descuento sobre el precio recomendado no siempre es una bajada reciente.",
      },
    ],
    guide: "cuanto-gastar-en-una-pala-de-padel",
    related: ["menos-de-150-euros", "nivel-avanzado", "potencia"],
  },
  {
    slug: "manejables",
    title: "Palas de pádel manejables",
    label: "Manejables",
    group: "juego",
    query: { shapes: ["redonda"], balances: ["bajo"] },
    description:
      "Palas de pádel manejables: forma redonda y balance bajo declarados, las más fáciles de mover. Compara sus características y su precio.",
    intro: [
      "Una pala se siente manejable cuando su peso queda cerca de la mano. Eso lo dan, sobre todo, dos datos: la forma redonda y el balance bajo. Esta página reúne las palas del catálogo que declaran los dos.",
      "Son palas que se mueven rápido en la red y cansan menos en partidos largos. A cambio, el remate sale con menos inercia que con una pala de balance alto. El peso también cuenta: está en la ficha de cada una.",
    ],
    faq: [
      {
        question: "¿Qué hace que una pala sea manejable?",
        answer:
          "Que su peso se concentre cerca del puño (balance bajo) y que no sea de las más pesadas. La forma redonda suele ir unida a ese balance. Aquí filtramos por forma y balance declarados; el peso aparece en cada ficha.",
      },
      {
        question: "¿Una pala manejable sirve para jugadores avanzados?",
        answer:
          "Sí. Hay palas redondas y de balance bajo con materiales de gama alta, dirigidas a jugadores avanzados que priorizan el control y la velocidad de mano en la red.",
      },
      {
        question: "¿Por qué hay pocas palas en esta lista?",
        answer:
          "Porque solo entran las que declaran las dos cosas. Muchas palas no publican su balance, y no lo damos por supuesto.",
      },
    ],
    guide: "balance-pala-de-padel",
    related: ["redondas", "control", "principiantes"],
  },
  {
    slug: "hibridas",
    title: "Palas de pádel híbridas",
    label: "Híbridas",
    group: "forma",
    query: { shapes: ["hibrida"] },
    description:
      "Palas de pádel de forma híbrida, entre la lágrima y la diamante: para quien busca potencia sin llegar a una diamante. Compara modelos y precios.",
    intro: [
      "Algunas marcas y tiendas llaman híbrida a una forma intermedia, normalmente entre la lágrima y la diamante: la cabeza es más ancha arriba que en una lágrima, sin llegar al hombro marcado de una diamante.",
      "En el catálogo tratamos la híbrida como forma propia solo cuando la fuente la declara así. Suelen ser palas con el punto dulce algo alto, pensadas para atacar con un poco más de margen que una diamante.",
    ],
    faq: [
      {
        question: "¿Qué es una pala híbrida?",
        answer:
          "Una pala cuya forma está entre dos de las clásicas, casi siempre entre la lágrima y la diamante. No es una categoría con una definición única: cada fabricante la aplica a su manera.",
      },
      {
        question: "¿Híbrida o diamante?",
        answer:
          "La diamante lleva el punto dulce más arriba y suele tener más balance. La híbrida se queda un paso antes. Compara el balance y el peso declarados de los modelos que te interesen, que es donde se nota la diferencia.",
      },
    ],
    guide: "forma-redonda-lagrima-diamante",
    related: ["lagrima", "diamante", "potencia"],
  },
  {
    slug: "2026",
    title: "Palas de pádel 2026",
    label: "Temporada 2026",
    group: "temporada",
    query: { years: [2026] },
    description:
      "Las palas de pádel de la temporada 2026: novedades de todas las marcas con sus características y su precio en cada tienda.",
    intro: [
      "Todas las palas de la colección 2026 que tenemos en el catálogo, de todas las marcas. Las novedades de cada temporada suelen llegar con cambios en los materiales de las caras, en el núcleo y en la estética.",
      "Si un modelo te interesa, mira también su edición anterior: mantiene buena parte de las características y suele estar más barata.",
    ],
    faq: [
      {
        question: "¿Merece la pena comprar la pala del año?",
        answer:
          "Solo si el cambio respecto a la anterior te aporta algo. Entre dos temporadas del mismo modelo las diferencias suelen ser pequeñas; puedes compararlas cara a cara en el comparador.",
      },
      {
        question: "¿Cuándo bajan de precio las palas nuevas?",
        answer:
          "No hay una regla fija. En la ficha de cada pala seguimos su precio a diario y, cuando lleva 30 días en seguimiento, indicamos si está barata respecto a su histórico.",
      },
    ],
    guide: "mejores-palas-padel-2026",
    related: ["potencia", "control", "polivalentes"],
  },
];

export function getCollection(slug: string): Collection | null {
  return collections.find((collection) => collection.slug === slug) ?? null;
}

export const COLLECTION_GROUPS: Record<Collection["group"], string> = {
  forma: "Por forma",
  juego: "Por juego",
  nivel: "Por nivel",
  precio: "Por precio",
  temporada: "Por temporada",
};
