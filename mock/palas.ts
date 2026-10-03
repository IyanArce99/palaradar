import type { Pala, PricePoint } from "@/types/catalog";
import { adidas, bullpadel, head, nox, siux, starvie } from "./brands";
import { mockOffer, stores } from "./stores";

// DATOS DE EJEMPLO. Precios, tiendas, valoraciones y opiniones son ficticios y
// reproducen las pantallas del diseño V3. No proceden de tiendas ni jugadores reales.

const HISTORY_END = Date.UTC(2026, 9, 1);
const HISTORY_STEP_DAYS = 14;
const DAY_MS = 86_400_000;
const EDITORIAL_UPDATED_AT = "2026-10-01";

/** Ilustración provisional generada por scripts/generate-art.mjs; no es foto del producto. */
function mockImage(slug: string): string {
  return `/img/palas/${slug}.svg`;
}

/** Histórico quincenal que termina en HISTORY_END. */
function mockHistory(prices: number[]): PricePoint[] {
  return prices.map((price, i) => ({
    date: new Date(HISTORY_END - (prices.length - 1 - i) * HISTORY_STEP_DAYS * DAY_MS)
      .toISOString()
      .slice(0, 10),
    price,
  }));
}

const vertex04: Pala = {
  id: "pala-bullpadel-vertex-04-2026",
  slug: "bullpadel-vertex-04-2026",
  brand: bullpadel,
  model: "Vertex 04",
  year: 2026,
  images: [mockImage("bullpadel-vertex-04-2026")],
  shape: "diamante",
  weight: { min: 360, max: 375 },
  balance: "alto",
  levels: ["intermedio", "avanzado"],
  playStyle: "potencia",
  description: "Potente y exigente, pensada para atacar.",
  editorial: {
    summary:
      "Potente, exigente y con un balance alto. Una buena opción si buscas atacar y ya tienes un nivel intermedio o avanzado; si estás empezando, probablemente te resulte más fácil una pala redonda o de lágrima.",
    pros: ["Mucha potencia", "Gran respuesta en ataque", "Buen comportamiento en remates"],
    cons: [
      "Puede resultar exigente para principiantes",
      "El balance alto se nota en defensa",
      "Menos manejable que una pala de control",
    ],
    idealFor: [
      "Jugadores intermedios y avanzados",
      "Jugadores ofensivos",
      "Quienes buscan potencia",
      "Quienes priorizan el remate",
    ],
    notFor: ["Estás empezando", "Buscas una pala muy manejable", "Prefieres mucho control"],
    feel: [
      { label: "Potencia", score: 5 },
      { label: "Control", score: 4 },
      { label: "Manejabilidad", score: 3 },
      { label: "Salida de bola", score: 4 },
      { label: "Punto dulce", score: 3 },
    ],
    feelSummary:
      "Se siente bastante contundente en ataque, especialmente en remates y voleas. Desde el fondo ofrece buen control, aunque no es una pala especialmente ligera de mover.",
    updatedAt: EDITORIAL_UPDATED_AT,
  },
  rating: 4.6,
  reviewCount: 1180,
  reviewAspects: [
    { label: "Potencia", score: 9.2 },
    { label: "Control", score: 7.4 },
    { label: "Salida de bola", score: 8.1 },
    { label: "Manejabilidad", score: 7.3 },
    { label: "Punto dulce", score: 8.0 },
  ],
  reviewHighlights: [
    "Muchos jugadores destacan la potencia en remate y bandeja.",
    "También se repite que el balance alto se nota, sobre todo cuando juegas desde el fondo.",
    "Algunos consideran que no es la opción más cómoda para empezar.",
  ],
  reviews: [
    {
      id: "review-vertex-1",
      rating: 5,
      body: "Me sorprendió la potencia que tiene. En el remate se nota muchísimo, aunque las primeras partidas me costó acostumbrarme al balance.",
      authorName: "Carlos",
      authorLevel: "avanzado",
      authorContext: "Juega 3 veces/semana · Revés · Usándola 5 meses",
      createdAt: "2026-09-17",
    },
    {
      id: "review-vertex-2",
      rating: 5,
      body: "Venía de una pala redonda y el cambio ha sido bastante grande. Ahora tengo más potencia, pero noto que pierdo algo de control.",
      authorName: "Miguel",
      authorLevel: "intermedio",
      authorContext: "Juega 2 veces/semana · Drive · Usándola 3 meses",
      createdAt: "2026-08-30",
    },
    {
      id: "review-vertex-3",
      rating: 4,
      body: "Muy buena pala, pero para alguien que está empezando creo que hay opciones más fáciles.",
      authorName: "Javier",
      authorLevel: "intermedio",
      authorContext: "Juega 1-2 veces/semana · Usándola 2 meses",
      createdAt: "2026-08-28",
    },
  ],
  offers: [
    mockOffer(stores.padelNuestro, 239.95, 0, "En stock · 24-48 h"),
    mockOffer(stores.padelProShop, 244.0, 0, "En stock · 48 h"),
    mockOffer(stores.padelTienda, 249.0, 0, "En stock · 24 h"),
    mockOffer(stores.zonaDePadel, 247.9, 3.95, "En stock"),
    mockOffer(stores.amazon, 254.3, 0, "Prime"),
    mockOffer(stores.elCorteIngles, 299.95, 0, "3-5 días"),
  ],
  previousPrice: 299.95,
  priceHistory: mockHistory([
    289.95, 279.95, 269.95, 259.95, 219.95, 249.95, 269.95, 279.95, 289.95, 299.95, 299.95, 294.95,
    289.95, 289.95, 294.95, 299.95, 299.95, 294.95, 299.95, 299.95, 299.95, 294.95, 289.95, 284.95,
    289.95, 239.95,
  ]),
  specs: [
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
  alternatives: [
    { slug: "nox-at10-genius-18k-2026", reason: "Más control" },
    { slug: "adidas-metalbone-3-4-2025", reason: "Más barata" },
    { slug: "head-speed-pro-2025", reason: "Más manejable" },
    { slug: "siux-electra-st3-pro-2026", reason: "Más potencia por menos" },
  ],
};

const at10Genius: Pala = {
  id: "pala-nox-at10-genius-18k-2026",
  slug: "nox-at10-genius-18k-2026",
  brand: nox,
  model: "AT10 Genius 18K",
  year: 2026,
  images: [mockImage("nox-at10-genius-18k-2026")],
  shape: "lagrima",
  weight: { min: 360, max: 375 },
  balance: "medio",
  levels: ["intermedio", "avanzado"],
  playStyle: "polivalente",
  description: "Equilibrada, cómoda y fácil de manejar.",
  editorial: {
    summary:
      "Si no quieres renunciar a nada, es de las opciones más seguras. Da control desde el fondo, es cómoda en partidos largos y aun así tiene potencia suficiente para cerrar el punto.",
    pros: ["Muy equilibrada", "Cómoda en partidos largos", "Punto dulce generoso"],
    cons: ["No es la más explosiva en remate", "Poco diferencial si ya buscas pura potencia"],
    idealFor: [
      "Jugadores intermedios que quieren progresar",
      "Quienes construyen el punto",
      "Quienes valoran la comodidad",
    ],
    notFor: ["Buscas la máxima pegada", "Prefieres un tacto muy duro"],
    feel: [
      { label: "Potencia", score: 4 },
      { label: "Control", score: 5 },
      { label: "Manejabilidad", score: 4 },
      { label: "Salida de bola", score: 4 },
      { label: "Punto dulce", score: 4 },
    ],
    feelSummary:
      "Se mueve con facilidad y transmite mucha seguridad en defensa y en la volea. En el remate cumple, pero pide que pongas tú la fuerza.",
    updatedAt: EDITORIAL_UPDATED_AT,
  },
  rating: 4.7,
  reviewCount: 1320,
  reviewAspects: [
    { label: "Potencia", score: 7.8 },
    { label: "Control", score: 9.0 },
    { label: "Salida de bola", score: 8.2 },
    { label: "Manejabilidad", score: 8.6 },
    { label: "Punto dulce", score: 8.5 },
  ],
  reviewHighlights: [
    "Se repite mucho que es una pala con la que cuesta fallar.",
    "Varios jugadores la recomiendan para partidos largos por lo cómoda que resulta.",
  ],
  reviews: [],
  offers: [
    mockOffer(stores.padelProShop, 229.0, 0, "En stock · 48 h"),
    mockOffer(stores.padelNuestro, 234.95, 0, "En stock · 24-48 h"),
    mockOffer(stores.amazon, 239.9, 0, "Prime"),
    mockOffer(stores.zonaDePadel, 236.0, 3.95, "En stock"),
    mockOffer(stores.elCorteIngles, 284.95, 0, "3-5 días"),
  ],
  previousPrice: 284.95,
  priceHistory: mockHistory([
    284.95, 284.95, 279.95, 249.95, 224.95, 259.95, 274.95, 284.95, 284.95, 284.95, 279.95, 284.95,
    284.95, 284.95, 279.95, 274.95, 279.95, 284.95, 284.95, 279.95, 274.95, 269.95, 264.95, 259.95,
    249.95, 229.0,
  ]),
  specs: [
    { label: "Núcleo", value: "HR3" },
    { label: "Caras", value: "Carbono 18K" },
    { label: "Marco", value: "Carbono" },
  ],
  faq: [],
  alternatives: [
    { slug: "bullpadel-vertex-04-2026", reason: "Más potencia" },
    { slug: "head-speed-pro-2025", reason: "Más barata" },
    { slug: "starvie-triton-pro-2026", reason: "Tacto más blando" },
  ],
};

const metalbone34: Pala = {
  id: "pala-adidas-metalbone-3-4-2025",
  slug: "adidas-metalbone-3-4-2025",
  brand: adidas,
  model: "Metalbone 3.4",
  year: 2025,
  images: [mockImage("adidas-metalbone-3-4-2025")],
  shape: "diamante",
  weight: { min: 345, max: 360 },
  balance: "alto",
  levels: ["avanzado", "competicion"],
  playStyle: "potencia",
  description: "Potencia con algo más de control.",
  editorial: {
    summary:
      "Una pala de ataque que no se descontrola tanto como otras de su tipo. Tiene mucha pegada, pero el tacto firme ayuda a colocar la bola cuando no rematas.",
    pros: ["Pegada contundente", "Más control del esperado en un diamante", "Peso ajustable"],
    cons: ["Tacto duro", "Exige buena técnica"],
    idealFor: ["Jugadores avanzados", "Quienes definen el punto arriba", "Quienes prefieren tacto firme"],
    notFor: ["Te molesta el codo", "Juegas una vez por semana"],
    feel: [
      { label: "Potencia", score: 5 },
      { label: "Control", score: 4 },
      { label: "Manejabilidad", score: 3 },
      { label: "Salida de bola", score: 3 },
      { label: "Punto dulce", score: 3 },
    ],
    feelSummary:
      "Dura y directa: la bola sale rápida si la aceleras tú. En defensa hay que trabajar más porque no regala salida de bola.",
    updatedAt: EDITORIAL_UPDATED_AT,
  },
  rating: 4.5,
  reviewCount: 940,
  reviewAspects: [
    { label: "Potencia", score: 9.0 },
    { label: "Control", score: 7.8 },
    { label: "Salida de bola", score: 7.0 },
    { label: "Manejabilidad", score: 7.1 },
    { label: "Punto dulce", score: 7.4 },
  ],
  reviewHighlights: [
    "Se destaca la pegada en remate y víbora.",
    "Varios jugadores avisan de que el tacto es duro y cuesta en los primeros partidos.",
  ],
  reviews: [],
  offers: [
    mockOffer(stores.padelNuestro, 219.0, 0, "En stock · 24-48 h"),
    mockOffer(stores.padelTienda, 224.9, 0, "En stock · 24 h"),
    mockOffer(stores.amazon, 229.0, 0, "Prime"),
    mockOffer(stores.padelProShop, 227.5, 3.5, "En stock · 48 h"),
  ],
  previousPrice: 289.95,
  priceHistory: mockHistory([
    289.95, 279.95, 259.95, 229.95, 199.0, 239.95, 259.95, 269.95, 259.95, 249.95, 239.95, 249.95,
    239.95, 229.95, 199.0, 229.95, 239.95, 229.95, 219.0, 229.0, 199.0, 219.0, 225.0, 209.0, 219.0,
    219.0,
  ]),
  specs: [
    { label: "Núcleo", value: "EVA Soft Performance" },
    { label: "Caras", value: "Carbono aluminizado 16K" },
    { label: "Marco", value: "Octagonal de carbono" },
  ],
  faq: [],
  alternatives: [
    { slug: "bullpadel-vertex-04-2026", reason: "Más salida de bola" },
    { slug: "siux-electra-st3-pro-2026", reason: "Más barata" },
  ],
};

const speedPro: Pala = {
  id: "pala-head-speed-pro-2025",
  slug: "head-speed-pro-2025",
  brand: head,
  model: "Speed Pro",
  year: 2025,
  images: [mockImage("head-speed-pro-2025")],
  shape: "lagrima",
  weight: { min: 355, max: 365 },
  balance: "medio",
  levels: ["intermedio", "avanzado"],
  playStyle: "polivalente",
  description: "Ligera, manejable y polivalente.",
  editorial: {
    summary:
      "Una pala rápida de manos y muy fácil de mover. Encaja si juegas mucho en la red y quieres reaccionar antes, sin renunciar a algo de pegada cuando toca.",
    pros: ["Muy manejable", "Rápida en la volea", "Buena relación calidad-precio"],
    cons: ["Menos peso en el remate", "Punto dulce algo más pequeño"],
    idealFor: ["Jugadores de red", "Quienes buscan una pala ligera", "Nivel intermedio y avanzado"],
    notFor: ["Buscas una pala muy pesada arriba", "Prefieres un tacto blando"],
    feel: [
      { label: "Potencia", score: 4 },
      { label: "Control", score: 4 },
      { label: "Manejabilidad", score: 5 },
      { label: "Salida de bola", score: 3 },
      { label: "Punto dulce", score: 3 },
    ],
    feelSummary:
      "Muy viva en los intercambios rápidos. Desde el fondo pide acompañar el golpe, porque no es de las que más salida de bola da.",
    updatedAt: EDITORIAL_UPDATED_AT,
  },
  rating: 4.4,
  reviewCount: 610,
  reviewAspects: [
    { label: "Potencia", score: 7.9 },
    { label: "Control", score: 8.2 },
    { label: "Salida de bola", score: 7.2 },
    { label: "Manejabilidad", score: 9.1 },
    { label: "Punto dulce", score: 7.4 },
  ],
  reviewHighlights: [
    "Lo más repetido es lo fácil que resulta moverla en la red.",
    "Algunos jugadores echan en falta más pegada en el remate.",
  ],
  reviews: [],
  offers: [
    mockOffer(stores.padelTienda, 184.95, 0, "En stock · 24 h"),
    mockOffer(stores.padelNuestro, 189.95, 0, "En stock · 24-48 h"),
    mockOffer(stores.amazon, 194.5, 0, "Prime"),
    mockOffer(stores.zonaDePadel, 192.0, 3.95, "En stock"),
  ],
  previousPrice: 259.95,
  priceHistory: mockHistory([
    259.95, 259.95, 249.95, 229.95, 199.95, 229.95, 249.95, 259.95, 259.95, 259.95, 254.95, 259.95,
    259.95, 249.95, 259.95, 259.95, 254.95, 249.95, 259.95, 259.95, 249.95, 239.95, 229.95, 219.95,
    209.95, 184.95,
  ]),
  specs: [
    { label: "Núcleo", value: "Power Foam" },
    { label: "Caras", value: "Carbono 3K" },
    { label: "Marco", value: "Carbono" },
  ],
  faq: [],
  alternatives: [
    { slug: "nox-at10-genius-18k-2026", reason: "Más control" },
    { slug: "starvie-triton-pro-2026", reason: "Más cómoda" },
  ],
};

const ml10ProCup: Pala = {
  id: "pala-nox-ml10-pro-cup-2026",
  slug: "nox-ml10-pro-cup-2026",
  brand: nox,
  model: "ML10 Pro Cup",
  year: 2026,
  images: [mockImage("nox-ml10-pro-cup-2026")],
  shape: "redonda",
  weight: { min: 360, max: 375 },
  balance: "bajo",
  levels: ["iniciacion", "intermedio"],
  playStyle: "control",
  description: "Fácil y cómoda para empezar.",
  editorial: {
    summary:
      "Una pala redonda, cómoda y con un punto dulce grande. Es una recomendación habitual para quien juega una o dos veces por semana y quiere mejorar sin hacerse daño.",
    pros: ["Muy fácil de jugar", "Cómoda para el brazo", "Precio contenido"],
    cons: ["Se queda corta de potencia", "Poco margen si ya juegas mucho"],
    idealFor: ["Quienes empiezan", "Jugadores de control", "Quienes buscan comodidad"],
    notFor: ["Ya rematas con frecuencia", "Buscas una pala rígida"],
    feel: [
      { label: "Potencia", score: 3 },
      { label: "Control", score: 5 },
      { label: "Manejabilidad", score: 5 },
      { label: "Salida de bola", score: 4 },
      { label: "Punto dulce", score: 5 },
    ],
    feelSummary:
      "Perdona mucho los golpes descentrados y la bola sale sin esfuerzo. En ataque notarás que le falta algo de pegada.",
    updatedAt: EDITORIAL_UPDATED_AT,
  },
  rating: 4.6,
  reviewCount: 2100,
  reviewAspects: [
    { label: "Potencia", score: 6.8 },
    { label: "Control", score: 9.1 },
    { label: "Salida de bola", score: 8.4 },
    { label: "Manejabilidad", score: 9.0 },
    { label: "Punto dulce", score: 9.2 },
  ],
  reviewHighlights: [
    "Casi todos coinciden en que es muy fácil de jugar desde el primer día.",
    "Quienes ya tienen nivel comentan que se les queda corta en el remate.",
  ],
  reviews: [],
  offers: [
    mockOffer(stores.padelNuestro, 129.95, 0, "En stock · 24-48 h"),
    mockOffer(stores.amazon, 132.9, 0, "Prime"),
    mockOffer(stores.padelProShop, 134.0, 0, "En stock · 48 h"),
    mockOffer(stores.padelTienda, 134.95, 0, "En stock · 24 h"),
    mockOffer(stores.elCorteIngles, 149.95, 0, "3-5 días"),
  ],
  previousPrice: 149.95,
  priceHistory: mockHistory([
    149.95, 149.95, 144.95, 134.95, 119.95, 134.95, 139.95, 144.95, 149.95, 149.95, 144.95, 139.95,
    144.95, 149.95, 144.95, 139.95, 139.95, 144.95, 139.95, 134.95, 139.95, 134.95, 134.95, 129.95,
    134.95, 129.95,
  ]),
  specs: [
    { label: "Núcleo", value: "HR3 Core" },
    { label: "Caras", value: "Fibra de vidrio" },
    { label: "Marco", value: "Carbono" },
  ],
  faq: [],
  alternatives: [
    { slug: "starvie-triton-pro-2026", reason: "Más potencia" },
    { slug: "nox-at10-genius-18k-2026", reason: "Para subir de nivel" },
  ],
};

const electraSt3: Pala = {
  id: "pala-siux-electra-st3-pro-2026",
  slug: "siux-electra-st3-pro-2026",
  brand: siux,
  model: "Electra ST3 Pro",
  year: 2026,
  images: [mockImage("siux-electra-st3-pro-2026")],
  shape: "diamante",
  weight: { min: 360, max: 375 },
  balance: "alto",
  levels: ["avanzado"],
  playStyle: "potencia",
  description: "Mucha pegada a buen precio.",
  editorial: {
    summary:
      "Pensada para pegar fuerte sin pagar lo que cuestan las palas más conocidas. Rinde muy bien en ataque, aunque es exigente cuando toca defender.",
    pros: ["Mucha pegada", "Buen precio para sus materiales", "Tacto firme"],
    cons: ["Exigente en defensa", "Punto dulce reducido"],
    idealFor: ["Jugadores avanzados", "Quienes buscan potencia", "Quienes miran el precio"],
    notFor: ["Estás empezando", "Buscas comodidad ante todo"],
    feel: [
      { label: "Potencia", score: 5 },
      { label: "Control", score: 3 },
      { label: "Manejabilidad", score: 3 },
      { label: "Salida de bola", score: 3 },
      { label: "Punto dulce", score: 2 },
    ],
    feelSummary:
      "Arriba es una pala muy agradecida: la bola sale con mucho peso. Abajo exige llegar bien colocado.",
    updatedAt: EDITORIAL_UPDATED_AT,
  },
  rating: 4.3,
  reviewCount: 380,
  reviewAspects: [
    { label: "Potencia", score: 9.1 },
    { label: "Control", score: 6.9 },
    { label: "Salida de bola", score: 7.0 },
    { label: "Manejabilidad", score: 6.8 },
    { label: "Punto dulce", score: 6.5 },
  ],
  reviewHighlights: [
    "Se valora sobre todo la pegada que ofrece para lo que cuesta.",
    "Se repite que no perdona los golpes descentrados.",
  ],
  reviews: [],
  offers: [
    mockOffer(stores.padelProShop, 199.0, 0, "En stock · 48 h"),
    mockOffer(stores.padelNuestro, 209.0, 0, "En stock · 24-48 h"),
    mockOffer(stores.zonaDePadel, 205.0, 3.95, "En stock"),
  ],
  previousPrice: 249.0,
  priceHistory: mockHistory([
    249, 249, 239, 219, 189, 219, 239, 249, 249, 249, 245, 249, 249, 239, 249, 249, 245, 239, 249,
    249, 239, 229, 225, 219, 209, 199,
  ]),
  specs: [
    { label: "Núcleo", value: "EVA Soft" },
    { label: "Caras", value: "Carbono 12K" },
    { label: "Marco", value: "Carbono" },
  ],
  faq: [],
  alternatives: [
    { slug: "bullpadel-vertex-04-2026", reason: "Más equilibrada" },
    { slug: "adidas-metalbone-3-4-2025", reason: "Más control" },
  ],
};

const tritonPro: Pala = {
  id: "pala-starvie-triton-pro-2026",
  slug: "starvie-triton-pro-2026",
  brand: starvie,
  model: "Triton Pro",
  year: 2026,
  images: [mockImage("starvie-triton-pro-2026")],
  shape: "lagrima",
  weight: { min: 355, max: 370 },
  balance: "medio",
  levels: ["intermedio"],
  playStyle: "polivalente",
  description: "Tacto blando y gran punto dulce.",
  editorial: {
    summary:
      "Una pala cómoda, de tacto blando, que ayuda mucho en defensa. Buena elección si priorizas la sensación en el golpe y el cuidado del brazo sobre la pura potencia.",
    pros: ["Tacto blando y agradable", "Punto dulce amplio", "Mucha salida de bola"],
    cons: ["Menos precisa a máxima velocidad", "Le falta algo de pegada arriba"],
    idealFor: ["Jugadores intermedios", "Quienes buscan confort", "Quienes juegan mucho desde el fondo"],
    notFor: ["Prefieres un tacto duro", "Buscas la máxima potencia"],
    feel: [
      { label: "Potencia", score: 3 },
      { label: "Control", score: 4 },
      { label: "Manejabilidad", score: 4 },
      { label: "Salida de bola", score: 5 },
      { label: "Punto dulce", score: 5 },
    ],
    feelSummary:
      "La bola sale sola incluso con golpes cortos, lo que da mucho descanso en defensa. En el remate hay que acelerar bastante.",
    updatedAt: EDITORIAL_UPDATED_AT,
  },
  rating: 4.4,
  reviewCount: 300,
  reviewAspects: [
    { label: "Potencia", score: 7.2 },
    { label: "Control", score: 8.3 },
    { label: "Salida de bola", score: 9.0 },
    { label: "Manejabilidad", score: 8.2 },
    { label: "Punto dulce", score: 9.0 },
  ],
  reviewHighlights: [
    "Lo más comentado es el tacto blando y lo cómoda que resulta.",
    "Algunos jugadores la notan poco precisa cuando pegan muy fuerte.",
  ],
  reviews: [],
  offers: [
    mockOffer(stores.padelNuestro, 174.9, 0, "En stock · 24-48 h"),
    mockOffer(stores.padelTienda, 179.9, 0, "En stock · 24 h"),
    mockOffer(stores.padelProShop, 182.0, 0, "En stock · 48 h"),
    mockOffer(stores.amazon, 184.9, 0, "Prime"),
  ],
  previousPrice: 199.9,
  priceHistory: mockHistory([
    199.9, 199.9, 194.9, 184.9, 164.9, 184.9, 194.9, 199.9, 199.9, 199.9, 194.9, 199.9, 199.9,
    194.9, 189.9, 194.9, 199.9, 194.9, 189.9, 184.9, 189.9, 184.9, 179.9, 184.9, 179.9, 174.9,
  ]),
  specs: [
    { label: "Núcleo", value: "EVA Soft 30" },
    { label: "Caras", value: "Carbono 2x" },
    { label: "Marco", value: "Carbono" },
  ],
  faq: [],
  alternatives: [
    { slug: "nox-at10-genius-18k-2026", reason: "Más control" },
    { slug: "nox-ml10-pro-cup-2026", reason: "Más barata" },
  ],
};

export const palas: Pala[] = [
  vertex04,
  at10Genius,
  metalbone34,
  speedPro,
  ml10ProCup,
  electraSt3,
  tritonPro,
];
