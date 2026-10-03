import type { RacketRow, ReviewRow } from "@/types/db";

// DATOS DE EJEMPLO. Precios, tiendas, valoraciones y opiniones son ficticios y
// reproducen las pantallas del diseño V3. No proceden de tiendas ni jugadores reales.

const EDITORIAL_UPDATED_AT = "2026-10-01";

/** Una pala de la semilla: su fila y los datos de los que salen las tablas relacionadas. */
export interface RacketSeed {
  racket: RacketRow;
  /** Ofertas actuales: [id de tienda, precio, envío, disponibilidad] */
  prices: [storeId: string, price: number, shipping: number, availability: string][];
  /** Precio anterior en la tienda más barata */
  previousPrice: number | null;
  /** Mejor precio final entre tiendas, un valor cada quincena; el último es el actual */
  bestPriceHistory: number[];
  reviews: Omit<ReviewRow, "id" | "racket_id">[];
  /** [slug de la alternativa, motivo] */
  alternatives: [slug: string, reason: string][];
}

/** Identidad de la fila. La imagen es una ilustración de scripts/generate-art.mjs. */
function identity(slug: string) {
  return { id: `rk_${slug}`, slug, images: [`/img/palas/${slug}.svg`] };
}

export const racketSeeds: RacketSeed[] = [
  {
    racket: {
      ...identity("bullpadel-vertex-04-2026"),
      brand_id: "br_bullpadel",
      model: "Vertex 04",
      year: 2026,
      shape: "diamante",
      balance: "alto",
      play_style: "potencia",
      levels: ["intermedio", "avanzado"],
      weight_min: 360,
      weight_max: 375,
      description: "Potente y exigente, pensada para atacar.",
      editorial_summary:
        "Potente, exigente y con un balance alto. Una buena opción si buscas atacar y ya tienes un nivel intermedio o avanzado; si estás empezando, probablemente te resulte más fácil una pala redonda o de lágrima.",
      pros: ["Mucha potencia", "Gran respuesta en ataque", "Buen comportamiento en remates"],
      cons: [
        "Puede resultar exigente para principiantes",
        "El balance alto se nota en defensa",
        "Menos manejable que una pala de control",
      ],
      ideal_for: [
        "Jugadores intermedios y avanzados",
        "Jugadores ofensivos",
        "Quienes buscan potencia",
        "Quienes priorizan el remate",
      ],
      not_for: ["Estás empezando", "Buscas una pala muy manejable", "Prefieres mucho control"],
      feel: [
        { label: "Potencia", score: 5 },
        { label: "Control", score: 4 },
        { label: "Manejabilidad", score: 3 },
        { label: "Salida de bola", score: 4 },
        { label: "Punto dulce", score: 3 },
      ],
      feel_summary:
        "Se siente bastante contundente en ataque, especialmente en remates y voleas. Desde el fondo ofrece buen control, aunque no es una pala especialmente ligera de mover.",
      editorial_updated_at: EDITORIAL_UPDATED_AT,
      rating: 4.6,
      review_count: 1180,
      review_aspects: [
        { label: "Potencia", score: 9.2 },
        { label: "Control", score: 7.4 },
        { label: "Salida de bola", score: 8.1 },
        { label: "Manejabilidad", score: 7.3 },
        { label: "Punto dulce", score: 8.0 },
      ],
      review_highlights: [
        "Muchos jugadores destacan la potencia en remate y bandeja.",
        "También se repite que el balance alto se nota, sobre todo cuando juegas desde el fondo.",
        "Algunos consideran que no es la opción más cómoda para empezar.",
      ],
      technical_specs: [
        { label: "Núcleo", value: "MultiEva" },
        { label: "Caras", value: "Carbono 18K" },
        { label: "Marco", value: "Tubular de carbono" },
      ],
      faq: [
        {
          question: "¿Sirve para un nivel intermedio?",
          answer:
            "Puede servir si ya rematas con cierta técnica. Si estás empezando a atacar, una pala de lágrima como la AT10 te resultará más fácil.",
        },
        {
          question: "¿Cuándo suele bajar de precio?",
          answer: "Sobre todo en Black Friday y en enero, cuando llegan los modelos nuevos.",
        },
        {
          question: "¿Qué cambia respecto a la de 2025?",
          answer:
            "Nuevas caras de carbono 18K y algo más de salida de bola. El peso y el balance apenas cambian.",
        },
        {
          question: "¿Es buena si me molesta el codo?",
          answer:
            "No es la más recomendable por su balance alto. Mira palas con núcleo más blando y balance medio.",
        },
      ],
    },
    prices: [
      ["st_padelnuestro", 239.95, 0, "En stock · 24-48 h"],
      ["st_padelproshop", 244.0, 0, "En stock · 48 h"],
      ["st_padeltienda", 249.0, 0, "En stock · 24 h"],
      ["st_zonadepadel", 247.9, 3.95, "En stock"],
      ["st_amazon", 254.3, 0, "Prime"],
      ["st_elcorteingles", 299.95, 0, "3-5 días"],
    ],
    previousPrice: 299.95,
    bestPriceHistory: [
      289.95, 279.95, 269.95, 259.95, 219.95, 249.95, 269.95, 279.95, 289.95, 299.95, 299.95,
      294.95, 289.95, 289.95, 294.95, 299.95, 299.95, 294.95, 299.95, 299.95, 299.95, 294.95,
      289.95, 284.95, 289.95, 239.95,
    ],
    reviews: [
      {
        rating: 5,
        title: null,
        text: "Me sorprendió la potencia que tiene. En el remate se nota muchísimo, aunque las primeras partidas me costó acostumbrarme al balance.",
        author: "Carlos",
        level: "avanzado",
        author_context: "Juega 3 veces/semana · Revés · Usándola 5 meses",
        created_at: "2026-09-17T10:00:00Z",
      },
      {
        rating: 5,
        title: null,
        text: "Venía de una pala redonda y el cambio ha sido bastante grande. Ahora tengo más potencia, pero noto que pierdo algo de control.",
        author: "Miguel",
        level: "intermedio",
        author_context: "Juega 2 veces/semana · Drive · Usándola 3 meses",
        created_at: "2026-08-30T10:00:00Z",
      },
      {
        rating: 4,
        title: null,
        text: "Muy buena pala, pero para alguien que está empezando creo que hay opciones más fáciles.",
        author: "Javier",
        level: "intermedio",
        author_context: "Juega 1-2 veces/semana · Usándola 2 meses",
        created_at: "2026-08-28T10:00:00Z",
      },
    ],
    alternatives: [
      ["nox-at10-genius-18k-2026", "Más control"],
      ["adidas-metalbone-3-4-2025", "Más barata"],
      ["head-speed-pro-2025", "Más manejable"],
      ["siux-electra-st3-pro-2026", "Más potencia por menos"],
    ],
  },
  {
    racket: {
      ...identity("nox-at10-genius-18k-2026"),
      brand_id: "br_nox",
      model: "AT10 Genius 18K",
      year: 2026,
      shape: "lagrima",
      balance: "medio",
      play_style: "polivalente",
      levels: ["intermedio", "avanzado"],
      weight_min: 360,
      weight_max: 375,
      description: "Equilibrada, cómoda y fácil de manejar.",
      editorial_summary:
        "Si no quieres renunciar a nada, es de las opciones más seguras. Da control desde el fondo, es cómoda en partidos largos y aun así tiene potencia suficiente para cerrar el punto.",
      pros: ["Muy equilibrada", "Cómoda en partidos largos", "Punto dulce generoso"],
      cons: ["No es la más explosiva en remate", "Poco diferencial si ya buscas pura potencia"],
      ideal_for: [
        "Jugadores intermedios que quieren progresar",
        "Quienes construyen el punto",
        "Quienes valoran la comodidad",
      ],
      not_for: ["Buscas la máxima pegada", "Prefieres un tacto muy duro"],
      feel: [
        { label: "Potencia", score: 4 },
        { label: "Control", score: 5 },
        { label: "Manejabilidad", score: 4 },
        { label: "Salida de bola", score: 4 },
        { label: "Punto dulce", score: 4 },
      ],
      feel_summary:
        "Se mueve con facilidad y transmite mucha seguridad en defensa y en la volea. En el remate cumple, pero pide que pongas tú la fuerza.",
      editorial_updated_at: EDITORIAL_UPDATED_AT,
      rating: 4.7,
      review_count: 1320,
      review_aspects: [
        { label: "Potencia", score: 7.8 },
        { label: "Control", score: 9.0 },
        { label: "Salida de bola", score: 8.2 },
        { label: "Manejabilidad", score: 8.6 },
        { label: "Punto dulce", score: 8.5 },
      ],
      review_highlights: [
        "Se repite mucho que es una pala con la que cuesta fallar.",
        "Varios jugadores la recomiendan para partidos largos por lo cómoda que resulta.",
      ],
      technical_specs: [
        { label: "Núcleo", value: "HR3" },
        { label: "Caras", value: "Carbono 18K" },
        { label: "Marco", value: "Carbono" },
      ],
      faq: [],
    },
    prices: [
      ["st_padelproshop", 229.0, 0, "En stock · 48 h"],
      ["st_padelnuestro", 234.95, 0, "En stock · 24-48 h"],
      ["st_amazon", 239.9, 0, "Prime"],
      ["st_zonadepadel", 236.0, 3.95, "En stock"],
      ["st_elcorteingles", 284.95, 0, "3-5 días"],
    ],
    previousPrice: 284.95,
    bestPriceHistory: [
      284.95, 284.95, 279.95, 249.95, 224.95, 259.95, 274.95, 284.95, 284.95, 284.95, 279.95,
      284.95, 284.95, 284.95, 279.95, 274.95, 279.95, 284.95, 284.95, 279.95, 274.95, 269.95,
      264.95, 259.95, 249.95, 229.0,
    ],
    reviews: [],
    alternatives: [
      ["bullpadel-vertex-04-2026", "Más potencia"],
      ["head-speed-pro-2025", "Más barata"],
      ["starvie-triton-pro-2026", "Tacto más blando"],
    ],
  },
  {
    racket: {
      ...identity("adidas-metalbone-3-4-2025"),
      brand_id: "br_adidas",
      model: "Metalbone 3.4",
      year: 2025,
      shape: "diamante",
      balance: "alto",
      play_style: "potencia",
      levels: ["avanzado", "competicion"],
      weight_min: 345,
      weight_max: 360,
      description: "Potencia con algo más de control.",
      editorial_summary:
        "Una pala de ataque que no se descontrola tanto como otras de su tipo. Tiene mucha pegada, pero el tacto firme ayuda a colocar la bola cuando no rematas.",
      pros: ["Pegada contundente", "Más control del esperado en un diamante", "Peso ajustable"],
      cons: ["Tacto duro", "Exige buena técnica"],
      ideal_for: [
        "Jugadores avanzados",
        "Quienes definen el punto arriba",
        "Quienes prefieren tacto firme",
      ],
      not_for: ["Te molesta el codo", "Juegas una vez por semana"],
      feel: [
        { label: "Potencia", score: 5 },
        { label: "Control", score: 4 },
        { label: "Manejabilidad", score: 3 },
        { label: "Salida de bola", score: 3 },
        { label: "Punto dulce", score: 3 },
      ],
      feel_summary:
        "Dura y directa: la bola sale rápida si la aceleras tú. En defensa hay que trabajar más porque no regala salida de bola.",
      editorial_updated_at: EDITORIAL_UPDATED_AT,
      rating: 4.5,
      review_count: 940,
      review_aspects: [
        { label: "Potencia", score: 9.0 },
        { label: "Control", score: 7.8 },
        { label: "Salida de bola", score: 7.0 },
        { label: "Manejabilidad", score: 7.1 },
        { label: "Punto dulce", score: 7.4 },
      ],
      review_highlights: [
        "Se destaca la pegada en remate y víbora.",
        "Varios jugadores avisan de que el tacto es duro y cuesta en los primeros partidos.",
      ],
      technical_specs: [
        { label: "Núcleo", value: "EVA Soft Performance" },
        { label: "Caras", value: "Carbono aluminizado 16K" },
        { label: "Marco", value: "Octagonal de carbono" },
      ],
      faq: [],
    },
    prices: [
      ["st_padelnuestro", 219.0, 0, "En stock · 24-48 h"],
      ["st_padeltienda", 224.9, 0, "En stock · 24 h"],
      ["st_amazon", 229.0, 0, "Prime"],
      ["st_padelproshop", 227.5, 3.5, "En stock · 48 h"],
    ],
    previousPrice: 289.95,
    bestPriceHistory: [
      289.95, 279.95, 259.95, 229.95, 199.0, 239.95, 259.95, 269.95, 259.95, 249.95, 239.95,
      249.95, 239.95, 229.95, 199.0, 229.95, 239.95, 229.95, 219.0, 229.0, 199.0, 219.0, 225.0,
      209.0, 219.0, 219.0,
    ],
    reviews: [],
    alternatives: [
      ["bullpadel-vertex-04-2026", "Más salida de bola"],
      ["siux-electra-st3-pro-2026", "Más barata"],
    ],
  },
  {
    racket: {
      ...identity("head-speed-pro-2025"),
      brand_id: "br_head",
      model: "Speed Pro",
      year: 2025,
      shape: "lagrima",
      balance: "medio",
      play_style: "polivalente",
      levels: ["intermedio", "avanzado"],
      weight_min: 355,
      weight_max: 365,
      description: "Ligera, manejable y polivalente.",
      editorial_summary:
        "Una pala rápida de manos y muy fácil de mover. Encaja si juegas mucho en la red y quieres reaccionar antes, sin renunciar a algo de pegada cuando toca.",
      pros: ["Muy manejable", "Rápida en la volea", "Buena relación calidad-precio"],
      cons: ["Menos peso en el remate", "Punto dulce algo más pequeño"],
      ideal_for: [
        "Jugadores de red",
        "Quienes buscan una pala ligera",
        "Nivel intermedio y avanzado",
      ],
      not_for: ["Buscas una pala muy pesada arriba", "Prefieres un tacto blando"],
      feel: [
        { label: "Potencia", score: 4 },
        { label: "Control", score: 4 },
        { label: "Manejabilidad", score: 5 },
        { label: "Salida de bola", score: 3 },
        { label: "Punto dulce", score: 3 },
      ],
      feel_summary:
        "Muy viva en los intercambios rápidos. Desde el fondo pide acompañar el golpe, porque no es de las que más salida de bola da.",
      editorial_updated_at: EDITORIAL_UPDATED_AT,
      rating: 4.4,
      review_count: 610,
      review_aspects: [
        { label: "Potencia", score: 7.9 },
        { label: "Control", score: 8.2 },
        { label: "Salida de bola", score: 7.2 },
        { label: "Manejabilidad", score: 9.1 },
        { label: "Punto dulce", score: 7.4 },
      ],
      review_highlights: [
        "Lo más repetido es lo fácil que resulta moverla en la red.",
        "Algunos jugadores echan en falta más pegada en el remate.",
      ],
      technical_specs: [
        { label: "Núcleo", value: "Power Foam" },
        { label: "Caras", value: "Carbono 3K" },
        { label: "Marco", value: "Carbono" },
      ],
      faq: [],
    },
    prices: [
      ["st_padeltienda", 184.95, 0, "En stock · 24 h"],
      ["st_padelnuestro", 189.95, 0, "En stock · 24-48 h"],
      ["st_amazon", 194.5, 0, "Prime"],
      ["st_zonadepadel", 192.0, 3.95, "En stock"],
    ],
    previousPrice: 259.95,
    bestPriceHistory: [
      259.95, 259.95, 249.95, 229.95, 199.95, 229.95, 249.95, 259.95, 259.95, 259.95, 254.95,
      259.95, 259.95, 249.95, 259.95, 259.95, 254.95, 249.95, 259.95, 259.95, 249.95, 239.95,
      229.95, 219.95, 209.95, 184.95,
    ],
    reviews: [],
    alternatives: [
      ["nox-at10-genius-18k-2026", "Más control"],
      ["starvie-triton-pro-2026", "Más cómoda"],
    ],
  },
  {
    racket: {
      ...identity("nox-ml10-pro-cup-2026"),
      brand_id: "br_nox",
      model: "ML10 Pro Cup",
      year: 2026,
      shape: "redonda",
      balance: "bajo",
      play_style: "control",
      levels: ["iniciacion", "intermedio"],
      weight_min: 360,
      weight_max: 375,
      description: "Fácil y cómoda para empezar.",
      editorial_summary:
        "Una pala redonda, cómoda y con un punto dulce grande. Es una recomendación habitual para quien juega una o dos veces por semana y quiere mejorar sin hacerse daño.",
      pros: ["Muy fácil de jugar", "Cómoda para el brazo", "Precio contenido"],
      cons: ["Se queda corta de potencia", "Poco margen si ya juegas mucho"],
      ideal_for: ["Quienes empiezan", "Jugadores de control", "Quienes buscan comodidad"],
      not_for: ["Ya rematas con frecuencia", "Buscas una pala rígida"],
      feel: [
        { label: "Potencia", score: 3 },
        { label: "Control", score: 5 },
        { label: "Manejabilidad", score: 5 },
        { label: "Salida de bola", score: 4 },
        { label: "Punto dulce", score: 5 },
      ],
      feel_summary:
        "Perdona mucho los golpes descentrados y la bola sale sin esfuerzo. En ataque notarás que le falta algo de pegada.",
      editorial_updated_at: EDITORIAL_UPDATED_AT,
      rating: 4.6,
      review_count: 2100,
      review_aspects: [
        { label: "Potencia", score: 6.8 },
        { label: "Control", score: 9.1 },
        { label: "Salida de bola", score: 8.4 },
        { label: "Manejabilidad", score: 9.0 },
        { label: "Punto dulce", score: 9.2 },
      ],
      review_highlights: [
        "Casi todos coinciden en que es muy fácil de jugar desde el primer día.",
        "Quienes ya tienen nivel comentan que se les queda corta en el remate.",
      ],
      technical_specs: [
        { label: "Núcleo", value: "HR3 Core" },
        { label: "Caras", value: "Fibra de vidrio" },
        { label: "Marco", value: "Carbono" },
      ],
      faq: [],
    },
    prices: [
      ["st_padelnuestro", 129.95, 0, "En stock · 24-48 h"],
      ["st_amazon", 132.9, 0, "Prime"],
      ["st_padelproshop", 134.0, 0, "En stock · 48 h"],
      ["st_padeltienda", 134.95, 0, "En stock · 24 h"],
      ["st_elcorteingles", 149.95, 0, "3-5 días"],
    ],
    previousPrice: 149.95,
    bestPriceHistory: [
      149.95, 149.95, 144.95, 134.95, 119.95, 134.95, 139.95, 144.95, 149.95, 149.95, 144.95,
      139.95, 144.95, 149.95, 144.95, 139.95, 139.95, 144.95, 139.95, 134.95, 139.95, 134.95,
      134.95, 129.95, 134.95, 129.95,
    ],
    reviews: [],
    alternatives: [
      ["starvie-triton-pro-2026", "Más potencia"],
      ["nox-at10-genius-18k-2026", "Para subir de nivel"],
    ],
  },
  {
    racket: {
      ...identity("siux-electra-st3-pro-2026"),
      brand_id: "br_siux",
      model: "Electra ST3 Pro",
      year: 2026,
      shape: "diamante",
      balance: "alto",
      play_style: "potencia",
      levels: ["avanzado"],
      weight_min: 360,
      weight_max: 375,
      description: "Mucha pegada a buen precio.",
      editorial_summary:
        "Pensada para pegar fuerte sin pagar lo que cuestan las palas más conocidas. Rinde muy bien en ataque, aunque es exigente cuando toca defender.",
      pros: ["Mucha pegada", "Buen precio para sus materiales", "Tacto firme"],
      cons: ["Exigente en defensa", "Punto dulce reducido"],
      ideal_for: ["Jugadores avanzados", "Quienes buscan potencia", "Quienes miran el precio"],
      not_for: ["Estás empezando", "Buscas comodidad ante todo"],
      feel: [
        { label: "Potencia", score: 5 },
        { label: "Control", score: 3 },
        { label: "Manejabilidad", score: 3 },
        { label: "Salida de bola", score: 3 },
        { label: "Punto dulce", score: 2 },
      ],
      feel_summary:
        "Arriba es una pala muy agradecida: la bola sale con mucho peso. Abajo exige llegar bien colocado.",
      editorial_updated_at: EDITORIAL_UPDATED_AT,
      rating: 4.3,
      review_count: 380,
      review_aspects: [
        { label: "Potencia", score: 9.1 },
        { label: "Control", score: 6.9 },
        { label: "Salida de bola", score: 7.0 },
        { label: "Manejabilidad", score: 6.8 },
        { label: "Punto dulce", score: 6.5 },
      ],
      review_highlights: [
        "Se valora sobre todo la pegada que ofrece para lo que cuesta.",
        "Se repite que no perdona los golpes descentrados.",
      ],
      technical_specs: [
        { label: "Núcleo", value: "EVA Soft" },
        { label: "Caras", value: "Carbono 12K" },
        { label: "Marco", value: "Carbono" },
      ],
      faq: [],
    },
    prices: [
      ["st_padelproshop", 199.0, 0, "En stock · 48 h"],
      ["st_padelnuestro", 209.0, 0, "En stock · 24-48 h"],
      ["st_zonadepadel", 205.0, 3.95, "En stock"],
    ],
    previousPrice: 249.0,
    bestPriceHistory: [
      249, 249, 239, 219, 189, 219, 239, 249, 249, 249, 245, 249, 249, 239, 249, 249, 245, 239,
      249, 249, 239, 229, 225, 219, 209, 199,
    ],
    reviews: [],
    alternatives: [
      ["bullpadel-vertex-04-2026", "Más equilibrada"],
      ["adidas-metalbone-3-4-2025", "Más control"],
    ],
  },
  {
    racket: {
      ...identity("starvie-triton-pro-2026"),
      brand_id: "br_starvie",
      model: "Triton Pro",
      year: 2026,
      shape: "lagrima",
      balance: "medio",
      play_style: "polivalente",
      levels: ["intermedio"],
      weight_min: 355,
      weight_max: 370,
      description: "Tacto blando y gran punto dulce.",
      editorial_summary:
        "Una pala cómoda, de tacto blando, que ayuda mucho en defensa. Buena elección si priorizas la sensación en el golpe y el cuidado del brazo sobre la pura potencia.",
      pros: ["Tacto blando y agradable", "Punto dulce amplio", "Mucha salida de bola"],
      cons: ["Menos precisa a máxima velocidad", "Le falta algo de pegada arriba"],
      ideal_for: [
        "Jugadores intermedios",
        "Quienes buscan confort",
        "Quienes juegan mucho desde el fondo",
      ],
      not_for: ["Prefieres un tacto duro", "Buscas la máxima potencia"],
      feel: [
        { label: "Potencia", score: 3 },
        { label: "Control", score: 4 },
        { label: "Manejabilidad", score: 4 },
        { label: "Salida de bola", score: 5 },
        { label: "Punto dulce", score: 5 },
      ],
      feel_summary:
        "La bola sale sola incluso con golpes cortos, lo que da mucho descanso en defensa. En el remate hay que acelerar bastante.",
      editorial_updated_at: EDITORIAL_UPDATED_AT,
      rating: 4.4,
      review_count: 300,
      review_aspects: [
        { label: "Potencia", score: 7.2 },
        { label: "Control", score: 8.3 },
        { label: "Salida de bola", score: 9.0 },
        { label: "Manejabilidad", score: 8.2 },
        { label: "Punto dulce", score: 9.0 },
      ],
      review_highlights: [
        "Lo más comentado es el tacto blando y lo cómoda que resulta.",
        "Algunos jugadores la notan poco precisa cuando pegan muy fuerte.",
      ],
      technical_specs: [
        { label: "Núcleo", value: "EVA Soft 30" },
        { label: "Caras", value: "Carbono 2x" },
        { label: "Marco", value: "Carbono" },
      ],
      faq: [],
    },
    prices: [
      ["st_padelnuestro", 174.9, 0, "En stock · 24-48 h"],
      ["st_padeltienda", 179.9, 0, "En stock · 24 h"],
      ["st_padelproshop", 182.0, 0, "En stock · 48 h"],
      ["st_amazon", 184.9, 0, "Prime"],
    ],
    previousPrice: 199.9,
    bestPriceHistory: [
      199.9, 199.9, 194.9, 184.9, 164.9, 184.9, 194.9, 199.9, 199.9, 199.9, 194.9, 199.9, 199.9,
      194.9, 189.9, 194.9, 199.9, 194.9, 189.9, 184.9, 189.9, 184.9, 179.9, 184.9, 179.9, 174.9,
    ],
    reviews: [],
    alternatives: [
      ["nox-at10-genius-18k-2026", "Más control"],
      ["nox-ml10-pro-cup-2026", "Más barata"],
    ],
  },
];
