// Confianza de los datos: una sola definición de qué se sabe, con qué seguridad y
// para qué alcanza. La usan la ficha, el buscador, las alternativas, el
// recomendador, los informes y el panel interno de calidad, para que todos digan
// lo mismo de una misma pala.
//
// Tres cosas que no se mezclan:
//   · el PRECIO: reciente, conocido pero antiguo, sin confirmar o inexistente.
//     Lo decide la regla de vigencia de siempre (lib/pricing.ts, `priceFreshness`);
//   · los ATRIBUTOS: verificado, declarado, inferido o desconocido;
//   · las RELACIONES entre palas: verificada (la ha fijado una persona) o
//     provisional (la calcula una regla).
// Que un dato falte no es un error del dato ni un defecto de la pala: es una
// ausencia, y se dice así.
import { COMPARABLE_STORES } from "@/lib/catalog/query";
import { formatDate, formatTimeAgo, pluralize } from "@/lib/format";
import type { PalaBalance, PlayerLevel, PlayStyle } from "@/types/catalog";
import type { PriceFreshness, PriceSummary } from "@/types/pricing";

// --- Precio ---------------------------------------------------------------------

export type PriceState = "reciente" | "antiguo" | "sin-confirmar" | "sin-precio";

export const PRICE_STATE_LABELS: Record<PriceState, string> = {
  reciente: "Precio reciente",
  antiguo: "Precio conocido, pero antiguo",
  "sin-confirmar": "Precio sin confirmar",
  "sin-precio": "Sin precio",
};

const FRESHNESS_STATE: Record<PriceFreshness, PriceState> = {
  current: "reciente",
  recent: "antiguo",
  stale: "sin-confirmar",
};

/** Estado del precio a partir de la vigencia que ya calcula lib/pricing.ts. */
export function priceState(freshness: PriceFreshness | null): PriceState {
  return freshness === null ? "sin-precio" : FRESHNESS_STATE[freshness];
}

/** Solo un precio reciente o antiguo-pero-vigente puede usarse en una recomendación o un ahorro. */
export function isUsablePrice(state: PriceState): boolean {
  return state === "reciente" || state === "antiguo";
}

// --- Atributos ------------------------------------------------------------------

/**
 * · verificado: contrastado con el fabricante o en dos fuentes (hoy, solo el EAN)
 * · declarado: lo publica una fuente (fabricante, tienda o PadelZoom) y se muestra tal cual
 * · inferido: deducido por una regla nuestra a partir de otro dato; nunca se enseña como dato de la pala
 * · desconocido: ninguna fuente lo da
 */
export type AttributeStatus = "verificado" | "declarado" | "inferido" | "desconocido";

export const ATTRIBUTE_STATUS_LABELS: Record<AttributeStatus, string> = {
  verificado: "Verificado",
  declarado: "Declarado por la fuente",
  inferido: "Deducido",
  desconocido: "Dato no disponible",
};

export function attributeStatus(value: unknown, options: { verified?: boolean; inferred?: boolean } = {}): AttributeStatus {
  const empty = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  if (empty) return "desconocido";
  if (options.inferred) return "inferido";
  return options.verified ? "verificado" : "declarado";
}

// --- Relaciones entre palas -----------------------------------------------------

/**
 * · verificada: la ha fijado una persona (las «parecidas» curadas)
 * · provisional: la calcula una regla (otras temporadas: misma marca y mismo nombre de modelo)
 */
export type RelationStatus = "verificada" | "provisional";

export const SEASON_RELATION: { status: RelationStatus; note: string } = {
  status: "provisional",
  note: "Las ediciones se relacionan por tener la misma marca y el mismo nombre de modelo. Es una regla nuestra, no una confirmación del fabricante: comprueba en la tienda que es la pala que buscas.",
};

// --- Para qué alcanza lo que se sabe de una pala -----------------------------------

/** Lo mínimo de una pala para saber qué funciones puede alimentar */
export interface ReadinessInput {
  /** Hay precio vigente (no «sin confirmar») */
  hasUsablePrice: boolean;
  /** Tiendas con precio vigente */
  storeCount: number;
  balance: PalaBalance | null;
  playStyle: PlayStyle | null;
  levels: PlayerLevel[];
  hasWeight: boolean;
  /** Tacto o dureza declarados */
  hasTouch: boolean;
  /** Puntuaciones técnicas de la fuente externa */
  hasRatings: boolean;
}

export type ReadinessKey = "alternativas" | "recomendador" | "comparar-tiendas" | "comparar-rendimiento" | "perfil-completo";

export const READINESS_LABELS: Record<ReadinessKey, string> = {
  alternativas: "Proponerla como alternativa",
  recomendador: "Recomendarla en el test de Pala ideal",
  "comparar-tiendas": "Comparar su precio entre tiendas",
  "comparar-rendimiento": "Comparar su rendimiento (puntuaciones)",
  "perfil-completo": "Perfil de juego completo",
};

/** Datos de perfil que hacen falta, como mínimo, para proponer una pala como alternativa */
export const MIN_PROFILE_TRAITS = 2;

function profileTraits(input: ReadinessInput): number {
  return Number(input.balance !== null) + Number(input.playStyle !== null) + Number(input.levels.length > 0);
}

/**
 * Para qué funciones tiene una pala información suficiente y, cuando no, por
 * qué. Las reglas son las mismas que aplican esas funciones:
 *   · alternativas y recomendador solo usan palas con precio vigente;
 *   · el recomendador necesita, además, nivel o estilo con los que comparar;
 *   · comparar tiendas exige dos precios vigentes.
 */
export function readiness(input: ReadinessInput): Record<ReadinessKey, { ready: boolean; reason: string | null }> {
  const noPrice = "No hay precio actual confirmado.";
  const traits = profileTraits(input);
  const check = (ready: boolean, reason: string) => ({ ready, reason: ready ? null : reason });

  let alternativesReason = noPrice;
  if (input.hasUsablePrice) alternativesReason = "Declara menos de dos datos de perfil (balance, estilo de juego, nivel).";
  let recommenderReason = noPrice;
  if (input.hasUsablePrice) recommenderReason = "No declara ni nivel ni estilo de juego.";

  return {
    alternativas: check(input.hasUsablePrice && traits >= MIN_PROFILE_TRAITS, alternativesReason),
    recomendador: check(input.hasUsablePrice && (input.levels.length > 0 || input.playStyle !== null), recommenderReason),
    "comparar-tiendas": check(
      input.hasUsablePrice && input.storeCount >= COMPARABLE_STORES,
      input.hasUsablePrice ? "Solo hay una tienda con precio disponible." : noPrice,
    ),
    "comparar-rendimiento": check(input.hasRatings, "No tiene puntuaciones técnicas de la fuente externa."),
    "perfil-completo": check(
      traits === 3 && input.hasWeight && input.hasTouch,
      "Le falta algún dato de perfil: balance, estilo de juego, nivel, peso o tacto.",
    ),
  };
}

// --- Lo que se le dice al usuario -------------------------------------------------

export interface ReliabilityNote {
  /** ok: se sabe · aviso: hay una limitación · falta: no se sabe */
  tone: "ok" | "aviso" | "falta";
  text: string;
}

/** Datos de una pala de la ficha que hacen falta para explicar su fiabilidad */
export interface ReliabilitySource {
  price: Pick<PriceSummary, "freshness" | "checkedAt" | "asOf" | "storeCount" | "offers" | "trackedSince"> | null;
  /** Características habituales que la pala no declara (`missingData`) */
  missing: string[];
  /**
   * Qué se sabe del código de barras: «declarado» si solo consta que una fuente lo
   * da; «verificado» únicamente si quien llama puede demostrar que se ha
   * contrastado (fabricante o dos fuentes). null si la pala no tiene EAN.
   */
  gtin: Extract<AttributeStatus, "verificado" | "declarado"> | null;
  /** Nombre de la fuente de las puntuaciones técnicas, si las hay */
  ratingsSource: string | null;
}

/**
 * Qué se sabe de una pala y con qué seguridad, en frases. Cada limitación se
 * explica; ninguna se presenta como un error ni como un defecto del producto.
 */
export function reliabilityNotes(source: ReliabilitySource): ReliabilityNote[] {
  const notes: ReliabilityNote[] = [];
  const { price } = source;
  const state = priceState(price?.freshness ?? null);

  if (!price) {
    notes.push({ tone: "falta", text: "No hay precio actual confirmado: ninguna de las tiendas que seguimos la tiene a la venta." });
  } else if (state === "reciente") {
    notes.push({ tone: "ok", text: `Precio comprobado ${formatTimeAgo(price.checkedAt, price.asOf)}.` });
  } else if (state === "antiguo") {
    notes.push({
      tone: "aviso",
      text: `Precio conocido, pero antiguo: se comprobó ${formatTimeAgo(price.checkedAt, price.asOf)}. Confírmalo en la tienda.`,
    });
  } else {
    notes.push({
      tone: "aviso",
      text: `Precio sin confirmar desde el ${formatDate(price.checkedAt)}: no lo usamos en ofertas ni en recomendaciones.`,
    });
  }

  if (price && isUsablePrice(state)) {
    notes.push(
      price.storeCount >= COMPARABLE_STORES
        ? { tone: "ok", text: `Precio comparado en ${pluralize(price.storeCount, "tienda", "tiendas")}.` }
        : { tone: "aviso", text: "Solo hay una tienda con precio disponible: no podemos compararlo con otra." },
    );
    const unverified = price.offers.filter((offer) => offer.shipping === null).map((offer) => offer.store.name);
    if (unverified.length > 0) {
      notes.push({ tone: "aviso", text: `Gastos de envío no verificados en ${unverified.join(" y ")}.` });
    }
  }

  notes.push({
    tone: "ok",
    text: "Las características son las que declara la fuente; no son mediciones propias.",
  });
  if (source.gtin === "verificado") {
    notes.push({ tone: "ok", text: "El código de barras (EAN) está verificado." });
  } else if (source.gtin === "declarado") {
    // Que exista un EAN no es una verificación: se dice de dónde sale y nada más.
    notes.push({ tone: "aviso", text: "El código de barras (EAN) es el que declara la fuente; no lo hemos contrastado con otra." });
  }
  if (source.ratingsSource) {
    notes.push({ tone: "ok", text: `Las puntuaciones técnicas son de ${source.ratingsSource}, no de PalaRadar.` });
  }
  for (const item of source.missing) {
    notes.push({ tone: "falta", text: `No se ha podido verificar: ${item}.` });
  }
  return notes;
}
