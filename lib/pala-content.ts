// Texto de la ficha construido con los datos reales de cada pala: descripción,
// «De un vistazo», especificaciones y preguntas frecuentes. Reglas:
//   · solo se escribe lo que la pala declara; un dato que falta no genera texto;
//   · las explicaciones dicen qué significa un atributo en general, no valoran
//     esta pala («balance alto: concentra más peso hacia la cabeza…»);
//   · nada de adjetivos que los datos no respalden.
import { displayValue } from "@/lib/compare";
import { formatEuro, formatEuroCompact, formatWeight, pluralize } from "@/lib/format";
import { BALANCE_LABELS, formatLevels, LEVEL_LABELS, SHAPE_LABELS, STYLE_LABELS } from "@/lib/labels";
import type { FaqItem, Pala, PalaBalance, PalaShape, PlayStyle, Spec } from "@/types/catalog";

/** Nombre completo de la pala: marca y modelo. */
export function palaName(pala: Pick<Pala, "brand" | "model">): string {
  return `${pala.brand.name} ${pala.model}`;
}

function spec(pala: Pala, label: string): string | null {
  return displayValue(pala.specs.find((item) => item.label === label)?.value);
}

/** «a», «a y b», «a, b y c» */
function list(items: (string | null | false | undefined)[]): string {
  const parts = items.filter((item): item is string => Boolean(item));
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
}

const lower = (text: string) => text.toLowerCase();

function levelList(pala: Pala): string {
  return list(pala.levels.map((level) => lower(LEVEL_LABELS[level])));
}

/** Tacto declarado o, si no lo hay, dureza declarada. */
export function touchOf(pala: Pala): { label: "Tacto" | "Dureza"; value: string } | null {
  const touch = spec(pala, "Tacto");
  if (touch) return { label: "Tacto", value: touch };
  const hardness = displayValue(pala.hardness);
  return hardness ? { label: "Dureza", value: hardness } : null;
}

const SHAPE_NOTES: Record<PalaShape, string> = {
  redonda: "El punto dulce queda centrado en la cara y suele ser más amplio.",
  lagrima: "A medio camino entre la redonda y la diamante: el punto dulce queda algo por encima del centro.",
  diamante: "El punto dulce queda en la parte alta de la cara.",
  hibrida: "Una forma intermedia entre la lágrima y la diamante.",
};

const BALANCE_NOTES: Record<PalaBalance, string> = {
  bajo: "Concentra más peso hacia el puño y suele dar una sensación más ligera al mover la pala.",
  medio: "Reparte el peso entre la cabeza y el puño.",
  alto: "Concentra más peso hacia la cabeza y suele favorecer una sensación más contundente.",
};

const STYLE_NOTES: Record<PlayStyle, string> = {
  control: "El fabricante la orienta a colocar la bola y jugar con seguridad.",
  polivalente: "El fabricante la orienta a un juego equilibrado entre control y potencia.",
  potencia: "El fabricante la orienta a los golpes de ataque y al remate.",
};

const TOUCH_NOTE =
  "Los tactos blandos suelen dar más salida de bola; los duros, más precisión en los golpes fuertes.";

export interface GlanceItem {
  label: string;
  value: string;
  /** Qué significa ese atributo para quien juega, en general */
  note: string;
}

/** «De un vistazo»: las características principales que la pala declara. */
export function glanceItems(pala: Pala): GlanceItem[] {
  const touch = touchOf(pala);
  const thickness = spec(pala, "Grosor");
  const surface = spec(pala, "Superficie");
  const items: (GlanceItem | null)[] = [
    { label: "Forma", value: SHAPE_LABELS[pala.shape], note: SHAPE_NOTES[pala.shape] },
    pala.weight && {
      label: "Peso",
      value: formatWeight(pala.weight),
      note: "Peso declarado por el fabricante; puede variar unos gramos de una unidad a otra.",
    },
    pala.balance && { label: "Balance", value: BALANCE_LABELS[pala.balance], note: BALANCE_NOTES[pala.balance] },
    pala.levels.length > 0
      ? { label: "Nivel", value: formatLevels(pala.levels), note: "Nivel de juego al que la dirige el fabricante." }
      : null,
    pala.playStyle && {
      label: "Estilo de juego",
      value: STYLE_LABELS[pala.playStyle],
      note: STYLE_NOTES[pala.playStyle],
    },
    touch && { label: touch.label, value: touch.value, note: TOUCH_NOTE },
    thickness ? { label: "Grosor", value: thickness, note: "Grosor del perfil de la pala; lo habitual son 38 mm." } : null,
    surface
      ? { label: "Superficie", value: surface, note: "Acabado de la cara: el relieve influye en el efecto que coge la bola." }
      : null,
    pala.player ? { label: "Jugador", value: pala.player, note: "Jugador profesional asociado a este modelo." } : null,
  ];
  return items.filter((item): item is GlanceItem => Boolean(item));
}

/**
 * Lo que la pala declara sobre su tacto y su cara, en una frase, con la
 * explicación general de qué significa el tacto. null si no declara nada de eso.
 */
export function declaredFeel(pala: Pala): string | null {
  const touch = touchOf(pala);
  const surface = spec(pala, "Superficie");
  const finish = spec(pala, "Acabado");
  const facts = list([
    touch && `${touch.label === "Tacto" ? "un tacto" : "una dureza"} ${lower(touch.value)}`,
    surface && `una superficie ${lower(surface)}`,
    finish && `un acabado ${lower(finish)}`,
  ]);
  if (!facts) return null;
  return `Según los datos declarados, tiene ${facts}.${touch ? ` ${TOUCH_NOTE}` : ""}`;
}

/** Especificaciones completas: solo las características que la fuente declara. */
export function fullSpecs(pala: Pala): Spec[] {
  const entries: [string, string | null][] = [
    ["Forma", SHAPE_LABELS[pala.shape]],
    ["Peso", pala.weight ? formatWeight(pala.weight) : null],
    ["Balance", pala.balance ? BALANCE_LABELS[pala.balance] : null],
    ["Estilo de juego", pala.playStyle ? STYLE_LABELS[pala.playStyle] : null],
    ...pala.specs.map((item): [string, string | null] => [item.label, displayValue(item.value)]),
    ["Dureza", displayValue(pala.hardness)],
    ["Nivel", pala.levels.length > 0 ? formatLevels(pala.levels) : null],
    ["Jugador", pala.player],
    ["Pensada para", displayValue(pala.gender)],
    ["Año", String(pala.year)],
    ["Precio recomendado", pala.msrp ? formatEuroCompact(pala.msrp) : null],
    ["Referencia del fabricante", pala.manufacturerRef],
    // Se guarda con 14 dígitos; con un cero delante es un EAN-13.
    ["EAN", pala.gtin?.length === 14 && pala.gtin.startsWith("0") ? pala.gtin.slice(1) : pala.gtin],
  ];
  return entries.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

/**
 * Descripción de la pala en un párrafo, con sus propios datos. Cada frase existe
 * solo si la pala declara lo que cuenta, así que dos palas con datos distintos
 * tienen textos distintos.
 */
export function describePala(pala: Pala): string {
  const name = palaName(pala);
  const core = spec(pala, "Núcleo");
  const faces = spec(pala, "Caras");
  const frame = spec(pala, "Marco");
  const touch = touchOf(pala);
  const surface = spec(pala, "Superficie");
  const finish = spec(pala, "Acabado");
  const thickness = spec(pala, "Grosor");
  const levels = levelList(pala);
  const style = pala.playStyle ? lower(STYLE_LABELS[pala.playStyle]) : null;

  const sentences: (string | null)[] = [
    `La ${name} es una pala de ${pala.year} con forma ${lower(SHAPE_LABELS[pala.shape])}${
      pala.balance ? ` y balance ${lower(BALANCE_LABELS[pala.balance])}` : ""
    }.`,
    pala.weight || thickness
      ? `${list([
          pala.weight && `Pesa ${formatWeight(pala.weight)}`,
          thickness && `${pala.weight ? "tiene" : "Tiene"} un perfil de ${lower(thickness)}`,
        ])}.`
      : null,
    style || levels
      ? `El fabricante la orienta ${list([
          style && `a un juego de ${style}`,
          levels && `a jugadores de nivel ${levels}`,
        ])}.`
      : null,
    core || faces || frame
      ? `${list([
          core && `Su núcleo es ${core}`,
          faces && `${core ? "las" : "Las"} caras son de ${faces}`,
          frame && `${core || faces ? "el" : "El"} marco es de ${frame}`,
        ])}.`
      : null,
    touch || surface
      ? `Declara ${list([
          touch && `${touch.label === "Tacto" ? "un tacto" : "una dureza"} ${lower(touch.value)}`,
          surface && `una superficie ${lower(surface)}${finish ? ` con acabado ${lower(finish)}` : ""}`,
        ])}.`
      : null,
    pala.player ? `Es el modelo de ${pala.player}.` : null,
    pala.msrp ? `Su precio recomendado por el fabricante es de ${formatEuroCompact(pala.msrp)}.` : null,
  ];
  return sentences.filter(Boolean).join(" ");
}

/** Resumen corto para la descripción SEO: forma, peso y balance, y el precio si está vigente. */
export function metaDescription(pala: Pala): string {
  const traits = list([
    `forma ${lower(SHAPE_LABELS[pala.shape])}`,
    pala.weight && formatWeight(pala.weight),
    pala.balance && `balance ${lower(BALANCE_LABELS[pala.balance])}`,
  ]);
  const price =
    pala.price && pala.price.freshness !== "stale"
      ? ` Desde ${formatEuro(pala.price.current)} en ${pluralize(pala.price.storeCount, "tienda", "tiendas")}.`
      : "";
  const extras = list(["características", pala.sourceRatings && `puntuaciones técnicas de ${pala.sourceRatings.source}`, "precio por tienda"]);
  return `${palaName(pala)} ${pala.year}: pala de ${traits}.${price} Consulta sus ${extras}.`;
}

/**
 * Preguntas frecuentes que se pueden responder con datos de la pala. Una
 * pregunta sin dato detrás no se formula.
 */
export function buildFaq(pala: Pala): FaqItem[] {
  const name = palaName(pala);
  const core = spec(pala, "Núcleo");
  const faces = spec(pala, "Caras");
  const frame = spec(pala, "Marco");
  const touch = touchOf(pala);
  const levels = levelList(pala);
  const { price } = pala;

  const items: (FaqItem | null | false)[] = [
    pala.weight && {
      question: `¿Cuánto pesa la ${name}?`,
      answer: `La ${name} pesa ${formatWeight(pala.weight)}, según los datos del fabricante.`,
    },
    {
      question: `¿Qué forma tiene la ${name}?`,
      answer: `Tiene forma ${lower(SHAPE_LABELS[pala.shape])}. ${SHAPE_NOTES[pala.shape]}`,
    },
    pala.balance && {
      question: `¿Cuál es el balance de la ${name}?`,
      answer: `Su balance es ${lower(BALANCE_LABELS[pala.balance])}. ${BALANCE_NOTES[pala.balance]}`,
    },
    levels
      ? {
          question: `¿Para qué nivel de juego es la ${name}?`,
          answer: `El fabricante la dirige a jugadores de nivel ${levels}.`,
        }
      : null,
    touch && {
      question: `¿Qué ${lower(touch.label)} tiene la ${name}?`,
      answer: `Declara ${touch.label === "Tacto" ? "un tacto" : "una dureza"} ${lower(touch.value)}. ${TOUCH_NOTE}`,
    },
    core || faces
      ? {
          question: `¿De qué materiales está hecha la ${name}?`,
          answer: `${list([
            core && `El núcleo es ${core}`,
            faces && `${core ? "las" : "Las"} caras son de ${faces}`,
            frame && `${core || faces ? "el" : "El"} marco es de ${frame}`,
          ])}.`,
        }
      : null,
    price && price.freshness !== "stale"
      ? {
          question: `¿Cuánto cuesta la ${name}?`,
          answer: `Su mejor precio ahora es de ${formatEuro(price.current)} en ${price.bestOffer.store.name}, entre ${pluralize(price.storeCount, "tienda que seguimos", "tiendas que seguimos")}.${
            pala.msrp ? ` El precio recomendado por el fabricante es de ${formatEuroCompact(pala.msrp)}.` : ""
          }`,
        }
      : null,
  ];
  return items.filter((item): item is FaqItem => Boolean(item));
}
