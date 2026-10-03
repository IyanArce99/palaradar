import type { PalaBalance, PalaShape, PlayerLevel, PlayStyle } from "@/types/catalog";

/**
 * Palas REALES. Cada dato sale de la página indicada en `sourceUrl`, consultada
 * el 3 de octubre de 2026. Reglas:
 * - Si la fuente no declara un dato, o lo declara de forma ambigua, va en null
 *   (o lista vacía): no se rellena por deducción.
 * - `source` distingue la web del fabricante de la ficha de una tienda. Cuando
 *   es "tienda" (el fabricante bloquea el acceso automático), nivel y estilo
 *   son la clasificación de esa tienda y conviene revisarlos a mano.
 * - `claim` resume con palabras propias lo que declara la fuente; es el
 *   borrador editorial, no una valoración de PalaRadar.
 * - `referencePrice` es el PVP del fabricante (o el precio de lista de la
 *   tienda fuente). Solo sirve de base para generar los precios de PRUEBA.
 */
export interface RacketSpec {
  /** Slug de la marca (data/seed/brands.ts) */
  brand: string;
  model: string;
  year: number;
  shape: PalaShape;
  balance: PalaBalance | null;
  weightMin: number | null;
  weightMax: number | null;
  core: string | null;
  faces: string | null;
  frame: string | null;
  levels: PlayerLevel[];
  playStyle: PlayStyle | null;
  referencePrice: number | null;
  claim: string;
  source: "fabricante" | "tienda";
  sourceUrl: string;
  /** Dudas pendientes de revisar a mano */
  pending?: string;
  /** EAN/GTIN real de la pala, solo cuando se ha contrastado en dos fuentes */
  gtin?: { value: string; source: string };
}

export const racketSpecs: RacketSpec[] = [
  // --- Bullpadel (ficha de tienda: bullpadel.com bloquea el acceso automático) --------
  {
    brand: "bullpadel",
    model: "Vertex 04",
    year: 2025,
    shape: "diamante",
    balance: "alto",
    weightMin: 365,
    weightMax: 375,
    core: "MultiEva",
    faces: "Xtend Carbon 12K",
    frame: "CarbonTube",
    levels: ["avanzado", "competicion"],
    playStyle: "potencia",
    referencePrice: 309.95,
    claim:
      "Según la ficha consultada, es la pala de Juan Tello: potente y precisa, para jugadores de nivel experto. Se destacan el sistema contra las torsiones y las placas que permiten modificar el balance.",
    source: "tienda",
    sourceUrl: "https://www.padelnuestro.com/bullpadel-vertex-04-25-113772-p",
    pending: "Sin verificar en bullpadel.com. Nivel y estilo son la clasificación de la tienda.",
    gtin: {
      value: "8445402691890",
      source: "https://www.zonadepadel.com/bullpadel/10839-bullpadel-vertex-04-2025.html",
    },
  },
  {
    brand: "bullpadel",
    model: "Hack 04",
    year: 2026,
    shape: "diamante",
    balance: null,
    weightMin: 365,
    weightMax: 375,
    core: "MultiEva",
    faces: "Tricarbon 18K",
    frame: null,
    levels: ["competicion"],
    playStyle: "potencia",
    referencePrice: 319.95,
    claim:
      "Según la ficha consultada, está orientada al jugador profesional de perfil ofensivo. Se destaca una potencia que aprovecha la velocidad del gesto y el acabado rugoso de la cara.",
    source: "tienda",
    sourceUrl: "https://www.padelnuestro.com/bullpadel-hack-04-26",
    gtin: {
      value: "8445402973934",
      source: "https://www.stockpadel.com/en/padel-rackets/bullpadel-padel-rackets/3192-bullpadel-hack-04-26-8445402973934.html",
    },
    pending:
      "Sin verificar en bullpadel.com. Balance ambiguo en la ficha («Alto, Medio»). El año sale del sufijo «26» del nombre comercial.",
  },
  {
    brand: "bullpadel",
    model: "Neuron",
    year: 2025,
    shape: "lagrima",
    balance: "medio",
    weightMin: 365,
    weightMax: 375,
    core: "MultiEva",
    faces: "Xtend Carbon 3K",
    frame: "CarbonTube",
    levels: ["avanzado", "competicion"],
    playStyle: "polivalente",
    referencePrice: 319.95,
    claim:
      "Según la ficha consultada, es la pala de Fede Chingotto, para jugadores avanzados o profesionales que quieren una pala polivalente. Se destaca el equilibrio entre potencia y control y un perfil que reduce vibraciones.",
    source: "tienda",
    sourceUrl: "https://www.padelnuestro.com/bullpadel-neuron-25-113768-p",
    pending:
      "Sin verificar en bullpadel.com. Forma «híbrida» asignada a lágrima. El año sale del sufijo «25» del nombre comercial.",
  },
  {
    brand: "bullpadel",
    model: "Indiga CTR",
    year: 2026,
    shape: "redonda",
    balance: "bajo",
    weightMin: 360,
    weightMax: 370,
    core: "SoftEva",
    faces: "Polyglass",
    frame: "Refuerzos de CarbonTube",
    levels: ["iniciacion", "intermedio"],
    playStyle: "control",
    referencePrice: 89.95,
    claim:
      "Según la ficha consultada, es una pala para el jugador amateur en fase de aprendizaje que prioriza colocar la bola sobre pegar fuerte. Se destaca por ser ligera, cómoda y muy manejable.",
    source: "tienda",
    sourceUrl: "https://www.padelnuestro.com/bullpadel-indiga-ctr-26",
    gtin: {
      value: "8445402993833",
      source: "https://www.ofertasdepadel.com/en/padel-rackets/41416-bullpadel-indiga-ctr-26-8445402993833.html",
    },
    pending: "Sin verificar en bullpadel.com. Nivel y estilo son la clasificación de la tienda.",
  },

  // --- Nox (noxsport.com) -------------------------------------------------------------
  {
    brand: "nox",
    model: "AT10 Luxury Genius 18K Alum",
    year: 2026,
    shape: "lagrima",
    balance: null,
    weightMin: 360,
    weightMax: 375,
    core: "MLD Black Eva",
    faces: "Carbon Fiber 18K Alum",
    frame: "Carbono",
    levels: ["competicion"],
    playStyle: "polivalente",
    referencePrice: 389.99,
    claim:
      "Es la pala de Agustín Tapia para la temporada 2026, de nivel profesional y juego polivalente. Nox destaca el nuevo molde, el sistema de contrapesos para ajustar el balance y la superficie pensada para generar efectos.",
    source: "fabricante",
    sourceUrl: "https://www.noxsport.com/products/pala-at10-genius-18k-alum-2026-by-agustin-tapia",
    gtin: {
      value: "8435778902621",
      source: "https://www.noxsport.com/products/pala-at10-genius-18k-alum-2026-by-agustin-tapia",
    },
    pending: "El fabricante no da un balance fijo: es ajustable con contrapesos.",
  },
  {
    brand: "nox",
    model: "EA10 Ventus Attack 12K Xtrem",
    year: 2026,
    shape: "diamante",
    balance: "alto",
    weightMin: 360,
    weightMax: 375,
    core: "MLD Black Eva",
    faces: "Carbon Fiber 12K Xtrem",
    frame: "Carbono",
    levels: ["competicion"],
    playStyle: "potencia",
    referencePrice: 339.99,
    claim:
      "Desarrollada con Edu Alonso para jugadores que quieren mandar en ataque y definir en el remate. Nox destaca el formato diamante con puño más largo y balance alto, y un tacto firme con buena salida de bola.",
    source: "fabricante",
    sourceUrl: "https://www.noxsport.com/products/ea10-ventus-attack-12k-xtrem-by-edu-alonso",
    gtin: {
      value: "8435778902683",
      source: "https://www.noxsport.com/products/ea10-ventus-attack-12k-xtrem-by-edu-alonso",
    },
  },
  {
    brand: "nox",
    model: "Equation Hard Advanced",
    year: 2027,
    shape: "redonda",
    balance: "medio",
    weightMin: 355,
    weightMax: 365,
    core: "HR3 Hard EVA",
    faces: "Fibra de vidrio 3K",
    frame: "Carbono",
    levels: ["intermedio"],
    playStyle: "control",
    referencePrice: 124.99,
    claim:
      "Según Nox es una pala para progresar con control: manejable, de tacto intermedio-duro pero cómoda, con respuesta precisa. Subraya el sistema antivibración para proteger el brazo.",
    source: "fabricante",
    sourceUrl: "https://www.noxsport.com/products/equation-hard-advanced-2027",
    gtin: {
      value: "8435778915850",
      source: "https://www.noxsport.com/products/equation-hard-advanced-2027",
    },
  },

  // --- Adidas (allforpadel.com, web oficial de adidas padel) ---------------------
  {
    brand: "adidas",
    model: "Metalbone 3.4",
    year: 2025,
    shape: "diamante",
    balance: "alto",
    weightMin: 345,
    weightMax: 360,
    core: "Eva Soft Performance",
    faces: "Carbon Aluminized 16K",
    frame: null,
    levels: ["competicion"],
    playStyle: "potencia",
    referencePrice: 390,
    claim:
      "Uno de los modelos de Ale Galán de la colección 2025, pensado para el máximo nivel de exigencia y un juego de ataque. El fabricante destaca el sistema de pesos ajustable, la empuñadura alargada y el raíl que da rigidez al marco.",
    source: "fabricante",
    sourceUrl:
      "https://allforpadel.com/es/palas-padel/7750-pala-de-padel-adidas-metalbone-34-ale-galan-8435739402740.html",
    pending: "Nivel «Pro» del fabricante asignado a competición.",
    gtin: {
      value: "8435739402740",
      source:
        "https://allforpadel.com/es/palas-padel/7750-pala-de-padel-adidas-metalbone-34-ale-galan-8435739402740.html",
    },
  },
  {
    brand: "adidas",
    model: "Cross It Ctrl",
    year: 2026,
    shape: "redonda",
    balance: "medio",
    weightMin: 360,
    weightMax: 375,
    core: "Eva High Memory",
    faces: "Carbon Aluminized 15K",
    frame: null,
    levels: ["competicion"],
    playStyle: "control",
    referencePrice: 350,
    claim:
      "Pala redonda orientada a jugadores de nivel profesional que quieren mandar en el punto desde la colocación y la precisión. Combina goma de alta densidad y carbono aluminizado 15K con agujeros en el corazón para acelerar el swing.",
    source: "fabricante",
    sourceUrl:
      "https://allforpadel.com/es/palas-padel/7527-pala-de-padel-adidas-cross-it-ctrl-2026-8435739405949.html",
    gtin: {
      value: "8435739405949",
      source: "https://allforpadel.com/es/palas-padel/7527-pala-de-padel-adidas-cross-it-ctrl-2026-8435739405949.html",
    },
    pending: "El estilo de juego sale del texto de la ficha, no de un campo.",
  },
  {
    brand: "adidas",
    model: "Metalbone Team Light",
    year: 2026,
    shape: "redonda",
    balance: "medio",
    weightMin: 345,
    weightMax: 360,
    core: "Eva Soft Performance",
    faces: "Fibra de vidrio",
    frame: null,
    levels: ["avanzado"],
    playStyle: null,
    referencePrice: 200,
    claim:
      "Versión ligera de la gama Metalbone para jugadores avanzados en evolución que buscan manejabilidad y reacción rápida. Fibra de vidrio y goma blanda para un tacto cómodo, con formato redondo que favorece la defensa.",
    source: "fabricante",
    sourceUrl:
      "https://allforpadel.com/es/palas-padel/7535-pala-de-padel-adidas-metalbone-team-light-2026-8435739405864.html",
    gtin: {
      value: "8435739405864",
      source: "https://allforpadel.com/es/palas-padel/7535-pala-de-padel-adidas-metalbone-team-light-2026-8435739405864.html",
    },
  },
  {
    brand: "adidas",
    model: "Match Black",
    year: 2026,
    shape: "lagrima",
    balance: null,
    weightMin: 360,
    weightMax: 375,
    core: "Eva Soft Performance",
    faces: "Fibra de vidrio",
    frame: null,
    levels: ["iniciacion"],
    playStyle: "polivalente",
    referencePrice: 75,
    claim:
      "Pala todo en uno para quien empieza, con forma híbrida que sirve tanto para aprender a defender como para los primeros golpes en la red. Fibra de vidrio y goma blanda para un tacto cómodo y mucha salida de bola.",
    source: "fabricante",
    sourceUrl:
      "https://allforpadel.com/es/palas-padel/7493-pala-de-padel-adidas-match-black-2026-8435739406052.html",
    gtin: {
      value: "8435739406052",
      source: "https://allforpadel.com/es/palas-padel/7493-pala-de-padel-adidas-match-black-2026-8435739406052.html",
    },
    pending:
      "El fabricante la llama «Allround (híbrido)»: se asigna a lágrima. Balance «Slightly Head Heavy», sin equivalente claro.",
  },

  // --- Babolat (babolat.com) -------------------------------------------------------
  {
    brand: "babolat",
    model: "Technical Viper 3.0",
    year: 2026,
    shape: "diamante",
    balance: "alto",
    weightMin: 360,
    weightMax: 380,
    core: "Hard EVA",
    faces: "Carbono 3K",
    frame: "Carbono",
    levels: ["competicion"],
    playStyle: "potencia",
    referencePrice: 370,
    claim:
      "Babolat la plantea para el jugador competitivo de perfil atacante técnico que quiere imponer un ritmo ofensivo. Destaca las caras de carbono 3K y una capa de carbono dentro de la goma para ganar potencia y reactividad.",
    source: "fabricante",
    sourceUrl: "https://www.babolat.com/es/technical-viper-3.0/150175.html",
    gtin: {
      value: "3324922283110",
      source: "https://www.babolat.com/es/technical-viper-3.0/150175.html",
    },
  },
  {
    brand: "babolat",
    model: "Counter Veron 2.6",
    year: 2026,
    shape: "redonda",
    balance: null,
    weightMin: 355,
    weightMax: 375,
    core: "Black EVA",
    faces: "CarbonFlex",
    frame: "Carbono",
    levels: [],
    playStyle: "control",
    referencePrice: 240,
    claim:
      "Pensada para jugadores contraatacantes que construyen el punto con paciencia y precisión antes de rematar. El fabricante destaca la forma redonda con punto dulce amplio y unas caras que dan más salida de bola y un tacto más cómodo.",
    source: "fabricante",
    sourceUrl: "https://www.babolat.com/es/counter-veron-2.6/150181.html",
    gtin: {
      value: "3324922283172",
      source: "https://www.babolat.com/es/counter-veron-2.6/150181.html",
    },
    pending:
      "Balance contradictorio en la ficha (tabla «cabeza pesada», texto «equilibrio medio»). El año viene de una tienda. Babolat no declara nivel.",
  },
  {
    brand: "babolat",
    model: "Air Vertuo 2.6",
    year: 2026,
    shape: "lagrima",
    balance: "medio",
    weightMin: 335,
    weightMax: 355,
    core: "Black EVA",
    faces: "Fibra de vidrio",
    frame: "Carbono",
    levels: [],
    playStyle: null,
    referencePrice: 180,
    claim:
      "Dirigida a quien busca una pala muy manejable y cómoda que genere potencia sin exigir mucho esfuerzo. Babolat subraya la fibra de vidrio flexible, el diseño aerodinámico y el sistema antivibraciones.",
    source: "fabricante",
    sourceUrl: "https://www.babolat.com/es/air-vertuo-2.6/150184.html",
    gtin: {
      value: "3324922283202",
      source: "https://www.babolat.com/es/air-vertuo-2.6/150184.html",
    },
    pending: "El año viene de una tienda. Babolat no declara nivel ni estilo de juego.",
  },
  {
    brand: "babolat",
    model: "Counter Origin",
    year: 2025,
    shape: "redonda",
    balance: "bajo",
    weightMin: 345,
    weightMax: 365,
    core: "EVA",
    faces: "Fibra de vidrio",
    frame: "Híbrido",
    levels: ["iniciacion"],
    playStyle: "control",
    referencePrice: 99,
    claim:
      "Babolat la presenta como una pala de control para quien pisa una pista de pádel por primera vez, incluso sin experiencia en deportes de raqueta. Destaca su manejabilidad, confort y tolerancia.",
    source: "fabricante",
    sourceUrl: "https://www.babolat.com/es/counter-origin/150154.html",
    gtin: {
      value: "3324922162392",
      source: "https://www.babolat.com/es/counter-origin/150154.html",
    },
    pending: "El año viene de una tienda.",
  },

  // --- Head (ficha de tienda: head.com bloquea el acceso automático) ----------------
  {
    brand: "head",
    model: "Extreme Pro",
    year: 2026,
    shape: "diamante",
    balance: "alto",
    weightMin: 370,
    weightMax: 370,
    core: "Power Foam",
    faces: "Carbono y fibra de vidrio",
    frame: null,
    levels: ["avanzado", "competicion"],
    playStyle: "potencia",
    referencePrice: 279.95,
    claim:
      "Según la ficha consultada, está orientada a jugadores ofensivos de nivel alto con técnica suficiente para mover una pala pesada y de balance alto. Se destaca la potencia en remates y golpes aéreos y la superficie rugosa para los efectos.",
    source: "tienda",
    sourceUrl: "https://www.padelnuestro.com/pala-head-extreme-pro-2026-223126",
    pending: "Sin verificar en head.com. Nivel y estilo son la clasificación de la tienda.",
  },
  {
    brand: "head",
    model: "Radical Motion",
    year: 2026,
    shape: "lagrima",
    balance: "bajo",
    weightMin: null,
    weightMax: null,
    core: "Control Foam",
    faces: "Fibra de vidrio",
    frame: null,
    levels: ["avanzado", "competicion"],
    playStyle: "control",
    referencePrice: 199.95,
    claim:
      "Según la ficha consultada, es para jugadores avanzados de perfil táctico que quieren marcar el ritmo del punto. Se destaca el equilibrio entre manejabilidad, estabilidad y precisión, con caras de fibra de vidrio de tacto flexible.",
    source: "tienda",
    sourceUrl: "https://www.padelnuestro.com/int/head-radical-motion-2026",
    gtin: {
      value: "198772134440",
      source: "https://www.time2padel.com/en/padel-rackets/31439-head-radical-motion-2026-head-198772134440.html",
    },
    pending: "Sin verificar en head.com. La ficha no indica el peso.",
  },
  {
    brand: "head",
    model: "Speed Team",
    year: 2025,
    shape: "lagrima",
    balance: "medio",
    weightMin: 365,
    weightMax: 365,
    core: "Power Foam",
    faces: "Fibra de vidrio",
    frame: null,
    levels: ["intermedio", "avanzado"],
    playStyle: "polivalente",
    referencePrice: 199.95,
    claim:
      "Según la ficha consultada, es una pala versátil y fácil de usar para jugadores intermedios y avanzados que buscan algo manejable. Se destaca el tacto blando de la fibra de vidrio y un punto dulce amplio y tolerante.",
    source: "tienda",
    sourceUrl: "https://www.padelnuestro.com/pala-head-speed-team-2025-221085",
    gtin: {
      value: "726423386001",
      source: "https://padelmania.com/es/palas-de-padel/24302-head-speed-team-2025-head-726423386001.html",
    },
    pending: "Sin verificar en head.com. La tienda etiqueta el nivel de forma contradictoria.",
  },
  {
    brand: "head",
    model: "Evo Extreme",
    year: 2025,
    shape: "lagrima",
    balance: "medio",
    weightMin: 350,
    weightMax: 350,
    core: "Foam",
    faces: "Fibra de vidrio",
    frame: null,
    levels: ["iniciacion", "intermedio"],
    playStyle: "control",
    referencePrice: 89.95,
    claim:
      "Según la ficha consultada, está pensada para quien empieza a jugar: ligera, con goma blanda y zona de golpeo amplia. Se destaca la salida de bola cómoda de la fibra de vidrio y la absorción de vibraciones.",
    source: "tienda",
    sourceUrl: "https://www.padelnuestro.com/head-evo-extreme-2025",
    pending: "Sin verificar en head.com. Nivel y estilo son la clasificación de la tienda.",
  },

  // --- Siux (siuxpadel.com; no publica peso en sus fichas) ----------------------------
  {
    brand: "siux",
    model: "Beat Control 2",
    year: 2025,
    shape: "redonda",
    balance: "bajo",
    weightMin: null,
    weightMax: null,
    core: null,
    faces: "Fibra de vidrio",
    frame: null,
    levels: ["iniciacion"],
    playStyle: "control",
    referencePrice: 85,
    claim:
      "Pala redonda de la gama Beat para jugadores de iniciación que buscan control. El fabricante declara balance bajo y un tacto blando.",
    source: "fabricante",
    sourceUrl: "https://www.siuxpadel.com/products/siux-beat-control-2",
    gtin: {
      value: "8435762902934",
      source: "https://www.siuxpadel.com/products/siux-beat-control-2",
    },
  },
  {
    brand: "siux",
    model: "Astra Hybrid",
    year: 2026,
    shape: "lagrima",
    balance: "medio",
    weightMin: null,
    weightMax: null,
    core: "EVA Soft",
    faces: "Fibra de vidrio 3K",
    frame: null,
    levels: ["intermedio"],
    playStyle: "polivalente",
    referencePrice: 150,
    claim:
      "Pala versátil de la gama Go para jugadores intermedios que quieren progresar en todas las facetas del juego. El fabricante declara forma de lágrima, balance medio y tacto equilibrado.",
    source: "fabricante",
    sourceUrl: "https://www.siuxpadel.com/products/siux-astra-hybrid-2026",
    gtin: {
      value: "8436625200525",
      source: "https://www.siuxpadel.com/products/siux-astra-hybrid-2026",
    },
    pending: "La web dice literalmente «Fibra de vidrio 3K»; 3K suele ser carbono (posible errata).",
  },
  {
    brand: "siux",
    model: "Fenix Pro",
    year: 2026,
    shape: "diamante",
    balance: "alto",
    weightMin: null,
    weightMax: null,
    core: null,
    faces: "Carbon 12K Honeycomb",
    frame: null,
    levels: ["avanzado", "competicion"],
    playStyle: "potencia",
    referencePrice: 350,
    claim:
      "Pala de ataque para jugadores avanzados o profesionales que quieren definir el punto con el remate. El fabricante declara forma de diamante, balance alto y el tacto más duro de su gama.",
    source: "fabricante",
    sourceUrl: "https://www.siuxpadel.com/products/siux-fenix-pro-2026-glow-purple",
    gtin: {
      value: "8436625200426",
      source: "https://www.siuxpadel.com/products/siux-fenix-pro-2026-glow-purple",
    },
  },
  {
    brand: "siux",
    model: "Electra Stupa Pro ST4",
    year: 2025,
    shape: "lagrima",
    balance: null,
    weightMin: null,
    weightMax: null,
    core: null,
    faces: null,
    frame: null,
    levels: ["competicion"],
    playStyle: "polivalente",
    referencePrice: 325,
    claim:
      "Pala de la gama Pro catalogada para nivel profesional, con un juego polivalente de tendencia agresiva. El fabricante declara forma híbrida y tacto medio-duro.",
    source: "fabricante",
    sourceUrl: "https://www.siuxpadel.com/products/siux-electra-stupa-pro-st4",
    gtin: {
      value: "8435762902804",
      source: "https://www.siuxpadel.com/products/siux-electra-stupa-pro-st4",
    },
    pending:
      "Forma «híbrida» asignada a lágrima. Balance «medio-alto» y superficie «15K» (sin material), sin equivalente claro.",
  },

  // --- StarVie (starvie.com; su catálogo actual está etiquetado como colección 2027) ----
  {
    brand: "starvie",
    model: "Kyra",
    year: 2027,
    shape: "redonda",
    balance: "bajo",
    weightMin: 340,
    weightMax: 360,
    core: "S-Eva Flex",
    faces: "X-Glass Tech",
    frame: null,
    levels: ["iniciacion"],
    playStyle: "control",
    referencePrice: 99,
    claim:
      "StarVie la plantea para quien empieza a jugar y quiere ante todo una pala fácil de mover. Destaca el tacto blando y cómodo de la goma y la fibra, y un puente pensado para generar potencia con poco esfuerzo.",
    source: "fabricante",
    sourceUrl: "https://starvie.com/products/pala-kyra",
    gtin: {
      value: "8436612942100",
      source: "https://starvie.com/products/pala-kyra",
    },
  },
  {
    brand: "starvie",
    model: "Drax +",
    year: 2027,
    shape: "lagrima",
    balance: "medio",
    weightMin: 350,
    weightMax: 370,
    core: "M-Eva Balance",
    faces: "12K Carbon Hyper",
    frame: null,
    levels: ["intermedio"],
    playStyle: "polivalente",
    referencePrice: 198,
    claim:
      "Dirigida a jugadores versátiles que quieren un reparto equilibrado entre control y potencia. El fabricante resalta el carbono 12K, que amplía el punto dulce, y una goma de densidad media-dura.",
    source: "fabricante",
    sourceUrl: "https://starvie.com/products/drax",
    gtin: {
      value: "8436612942087",
      source: "https://starvie.com/products/drax",
    },
  },
  {
    brand: "starvie",
    model: "Tritón Power +",
    year: 2027,
    shape: "diamante",
    balance: "alto",
    weightMin: 350,
    weightMax: 366,
    core: "H-Eva Power",
    faces: "18K Carbon",
    frame: null,
    levels: ["avanzado"],
    playStyle: "potencia",
    referencePrice: 265.5,
    claim:
      "Pensada para un juego de ataque: StarVie destaca la rigidez del carbono 18K y una goma de alta densidad con tacto firme para sacar la máxima potencia en los golpes definitivos.",
    source: "fabricante",
    sourceUrl: "https://starvie.com/products/triton-power",
    gtin: {
      value: "8436612942056",
      source: "https://starvie.com/products/triton-power",
    },
    pending: "265,50 € es el único precio mostrado; podría ser ya un precio rebajado y no el PVP.",
  },
  {
    brand: "starvie",
    model: "Raptor +",
    year: 2026,
    shape: "lagrima",
    balance: "medio",
    weightMin: 360,
    weightMax: 376,
    core: "M-Eva Balance",
    faces: "3D Carbon",
    frame: null,
    levels: ["avanzado", "competicion"],
    playStyle: "polivalente",
    referencePrice: 315,
    claim:
      "Para jugadores versátiles de nivel alto que buscan equilibrio entre potencia, control y manejabilidad. StarVie subraya el sistema antivibración y una pieza intercambiable con distintos pesos que permite ajustar el balance.",
    source: "fabricante",
    sourceUrl: "https://starvie.com/products/raptor",
    gtin: {
      value: "8436612941035",
      source: "https://starvie.com/products/raptor",
    },
  },

  // --- Wilson (ficha de tienda: wilson.com bloquea el acceso automático) ---------------
  {
    brand: "wilson",
    model: "Defy LS V1 SE",
    year: 2026,
    shape: "diamante",
    balance: "alto",
    weightMin: 355,
    weightMax: 355,
    core: "Power Foam",
    faces: "Carbono 3K",
    frame: null,
    levels: ["avanzado", "competicion"],
    playStyle: "polivalente",
    referencePrice: 239.95,
    claim:
      "Según la ficha consultada, es una pala para jugadores que quieren pasar a un juego más agresivo sin renunciar a comodidad ni estabilidad. Se destaca una potencia fácil de sacar junto con control.",
    source: "tienda",
    sourceUrl: "https://www.padelnuestro.com/pala-wilson-defy-ls-v1-se-wr214611u2",
    pending:
      "Sin verificar en wilson.com. La tienda marca nivel avanzado/competición pero su texto habla de intermedios y avanzados.",
  },
];
