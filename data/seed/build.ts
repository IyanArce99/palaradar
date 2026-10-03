// Convierte la semilla (marcas, tiendas y palas reales) en filas con la forma
// exacta de las tablas de db/schema.sql. La usan el repositorio en memoria y
// `npm run db:seed`, así que ambos orígenes de datos parten de lo mismo.
import { createHash } from "node:crypto";
import { BALANCE_LABELS, formatLevels, SHAPE_LABELS } from "@/lib/labels";
import type { PlayStyle, Spec } from "@/types/catalog";
import type {
  BrandRow,
  PriceHistoryRow,
  RacketAlternativeRow,
  RacketRow,
  ReviewRow,
  StorePriceRow,
  StoreRow,
} from "@/types/db";
import { brandSeeds } from "./brands";
import { racketSpecs, type RacketSpec } from "./rackets";
import { storeSeeds } from "./stores";

export interface SeedTables {
  brands: BrandRow[];
  stores: StoreRow[];
  rackets: RacketRow[];
  racketAlternatives: RacketAlternativeRow[];
  storePrices: StorePriceRow[];
  priceHistory: PriceHistoryRow[];
  reviews: ReviewRow[];
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const HISTORY_POINTS = 26;
const HISTORY_STEP_DAYS = 14;
const MAX_ALTERNATIVES = 4;

/** UUID determinista: la misma clave da siempre el mismo id, en memoria y en base de datos. */
export function seedId(key: string): string {
  const hash = createHash("sha1").update(`palaradar:${key}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Generador pseudoaleatorio con semilla: los precios de prueba no cambian entre ejecuciones. */
function seededRandom(seed: string): () => number {
  let state = Number.parseInt(createHash("sha1").update(seed).digest("hex").slice(0, 8), 16);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Precio "de tienda": entero terminado en ,95 */
function shelfPrice(value: number): number {
  return Math.max(1, Math.round(value)) - 0.05;
}

const STYLE_PHRASE: Record<PlayStyle, { noun: string; seeker: string }> = {
  control: { noun: "Pala de control", seeker: "Quienes buscan control" },
  polivalente: { noun: "Pala polivalente", seeker: "Quienes buscan una pala polivalente" },
  potencia: { noun: "Pala de potencia", seeker: "Quienes buscan potencia" },
};

// --- Palas -------------------------------------------------------------------

function racketSlug(spec: RacketSpec, brandName: string): string {
  return slugify(`${brandName} ${spec.model} ${spec.year}`);
}

/** Frase de tarjeta, compuesta solo con datos declarados. */
function describe(spec: RacketSpec): string {
  const noun = spec.playStyle ? STYLE_PHRASE[spec.playStyle].noun : "Pala";
  const balance = spec.balance ? ` y balance ${BALANCE_LABELS[spec.balance].toLowerCase()}` : "";
  return `${noun} de forma ${SHAPE_LABELS[spec.shape].toLowerCase()}${balance}.`;
}

function idealFor(spec: RacketSpec): string[] {
  const items: string[] = [];
  if (spec.levels.length > 0) {
    items.push(`Jugadores de nivel ${formatLevels(spec.levels).toLowerCase().replaceAll(" · ", ", ")}`);
  }
  if (spec.playStyle) items.push(STYLE_PHRASE[spec.playStyle].seeker);
  return items;
}

function technicalSpecs(spec: RacketSpec): Spec[] {
  const entries: [string, string | null][] = [
    ["Núcleo", spec.core],
    ["Caras", spec.faces],
    ["Marco", spec.frame],
  ];
  return entries.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

function toRacketRow(spec: RacketSpec, brand: BrandRow, today: string): RacketRow {
  const slug = racketSlug(spec, brand.name);

  return {
    id: seedId(`racket:${slug}`),
    slug,
    brand_id: brand.id,
    model: spec.model,
    year: spec.year,
    // Ilustración de scripts/generate-art.ts, no foto del producto.
    images: [`/img/palas/${slug}.svg`],
    shape: spec.shape,
    balance: spec.balance,
    play_style: spec.playStyle,
    levels: spec.levels,
    weight_min: spec.weightMin,
    weight_max: spec.weightMax,
    description: describe(spec),
    // Borrador: resume lo que declara la fuente, sin valoración propia.
    editorial_summary: spec.claim,
    editorial_status: "draft",
    pros: [],
    cons: [],
    ideal_for: idealFor(spec),
    not_for: [],
    feel: [],
    feel_summary: "",
    editorial_updated_at: today,
    // Todavía no hay opiniones reales.
    rating: 0,
    review_count: 0,
    review_aspects: [],
    review_highlights: [],
    technical_specs: technicalSpecs(spec),
    faq: [],
    specs_source_url: spec.sourceUrl,
  };
}

/** Alternativas: palas de la misma forma de otras marcas, las de precio de referencia más parecido. */
function alternativesFor(
  spec: RacketSpec,
  racket: RacketRow,
  all: { spec: RacketSpec; row: RacketRow }[],
): RacketAlternativeRow[] {
  const distance = (other: RacketSpec) =>
    Math.abs((other.referencePrice ?? 0) - (spec.referencePrice ?? 0));

  return all
    .filter(({ spec: other }) => other.shape === spec.shape && other.brand !== spec.brand)
    .sort((a, b) => distance(a.spec) - distance(b.spec))
    .slice(0, MAX_ALTERNATIVES)
    .map(({ row }, position) => ({
      racket_id: racket.id,
      alternative_id: row.id,
      reason: "Misma forma",
      position,
    }));
}

// --- Precios de prueba -------------------------------------------------------

const AVAILABILITY = ["En stock · 24 h", "En stock · 24-48 h", "En stock", "3-5 días"];

/**
 * Antigüedad de la comprobación de precio de cada pala. La mayoría se
 * comprueban "ahora"; unas pocas quedan a propósito a 30 horas (último precio
 * conocido) y a 6 días (precio sin confirmar) para poder ver los tres estados.
 */
function checkedHoursAgo(index: number): number {
  if (index % 9 === 4) return 30;
  if (index % 9 === 8) return 144;
  return 0.2;
}

interface TestPrices {
  storePrices: StorePriceRow[];
  priceHistory: PriceHistoryRow[];
}

/** Precios e histórico de PRUEBA, generados a partir del precio de referencia. No son precios reales. */
function testPrices(
  spec: RacketSpec,
  racket: RacketRow,
  stores: StoreRow[],
  index: number,
  now: Date,
): TestPrices {
  if (spec.referencePrice === null) return { storePrices: [], priceHistory: [] };

  const random = seededRandom(racket.slug);
  const reference = spec.referencePrice;
  const best = shelfPrice(reference * (0.72 + random() * 0.26));
  const checkedAt = new Date(now.getTime() - checkedHoursAgo(index) * HOUR_MS);

  const storeCount = 3 + Math.floor(random() * 4);
  const chosen = [...stores].sort(() => random() - 0.5).slice(0, storeCount);

  const offers = chosen.map((store, i) => {
    const total = i === 0 ? best : shelfPrice(best * (1.02 + random() * 0.12));
    const shipping = i > 0 && random() < 0.25 ? 3.95 : 0;
    return { store, total, shipping, availability: AVAILABILITY[Math.floor(random() * AVAILABILITY.length)] };
  });

  // Serie quincenal del mejor precio: oscila bajo el precio de referencia, con
  // una bajada puntual, y termina en el precio actual el día de la comprobación.
  const dipIndex = 3 + Math.floor(random() * 6);
  const bestSeries = Array.from({ length: HISTORY_POINTS }, (_, i) => {
    if (i === HISTORY_POINTS - 1) return best;
    if (i === dipIndex) return shelfPrice(best * (0.92 + random() * 0.1));
    return shelfPrice(reference * (0.86 + random() * 0.14));
  });
  const lastDay = Date.parse(`${checkedAt.toISOString().slice(0, 10)}T00:00:00Z`);
  const dateAt = (i: number) =>
    new Date(lastDay - (HISTORY_POINTS - 1 - i) * HISTORY_STEP_DAYS * DAY_MS).toISOString().slice(0, 10);

  return {
    storePrices: offers.map(({ store, total, shipping, availability }) => ({
      racket_id: racket.id,
      store_id: store.id,
      current_price: Math.round((total - shipping) * 100) / 100,
      previous_price: total === best && reference > best ? reference : null,
      shipping_cost: shipping,
      availability,
      product_url: null,
      checked_at: checkedAt.toISOString(),
    })),
    // Cada tienda sigue la serie del mejor precio a la distancia que mantiene hoy.
    priceHistory: offers.flatMap(({ store, total }) =>
      bestSeries.map((price, i) => ({
        racket_id: racket.id,
        store_id: store.id,
        price: Math.round((price + (total - best)) * 100) / 100,
        price_date: dateAt(i),
      })),
    ),
  };
}

// --- Semilla completa --------------------------------------------------------

/** Filas de todas las tablas a fecha `now` (los precios de prueba se comprueban "ahora"). */
export function buildSeed(now: Date): SeedTables {
  const today = now.toISOString().slice(0, 10);

  const brands: BrandRow[] = brandSeeds.map((brand) => ({
    id: seedId(`brand:${brand.slug}`),
    slug: brand.slug,
    name: brand.name,
    description: brand.description,
    logo_url: null,
  }));
  const stores: StoreRow[] = storeSeeds.map((store) => ({ id: seedId(`store:${store.slug}`), ...store }));
  const brandBySlug = new Map(brands.map((brand) => [brand.slug, brand]));

  const entries = racketSpecs.flatMap((spec) => {
    const brand = brandBySlug.get(spec.brand);
    return brand ? [{ spec, row: toRacketRow(spec, brand, today) }] : [];
  });

  const prices = entries.map(({ spec, row }, index) => testPrices(spec, row, stores, index, now));

  return {
    brands,
    stores,
    rackets: entries.map(({ row }) => row),
    racketAlternatives: entries.flatMap(({ spec, row }) => alternativesFor(spec, row, entries)),
    storePrices: prices.flatMap((p) => p.storePrices),
    priceHistory: prices.flatMap((p) => p.priceHistory),
    reviews: [],
  };
}
