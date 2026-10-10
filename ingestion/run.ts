import { normalizeGtin } from "./gtin";
import { hasInvalidEan, matchProduct } from "./matcher";
import { normalizeListing, shippingFor } from "./normalizer";
import type { HistoryEntry, IngestionRepository, IngestionStore } from "./repository";
import { parseTitle } from "./title";
import type {
  CatalogRacket,
  MatchResult,
  NormalizedOffer,
  OfferConflict,
  PublishedPrice,
  RunSummary,
  StoreAdapter,
  StoreListing,
  StoreProduct,
} from "./types";

/** Una bajada mayor que esta respecto al último precio no se publica sin confirmar. */
export const ANOMALOUS_DROP = 0.4;
/** Ejecuciones seguidas sin ver un producto antes de darlo por desaparecido. */
export const MISSING_AFTER_RUNS = 2;

const IN_STOCK_TEXT = "En stock";

/** Prefijo de la nota de un enlace automático que se conserva aunque el catálogo lo haya puesto en duda. */
export const KEPT_LINK_PREFIX = "Enlace conservado, pendiente de revisar: ";
/** Prefijo de la nota de un producto mandado a revisión por chocar con otro de la misma tienda en la misma pala. */
export const CONFLICT_NOTE_PREFIX = "Conflicto en la tienda: ";
export const conflictNote = (kept: StoreProduct) =>
  `${CONFLICT_NOTE_PREFIX}«${kept.title}» (${kept.externalId}) ya está enlazado a la misma pala y su nombre no coincide con este. Revisar cuál es la pala correcta.`;
/** Prefijo de la nota de una bajada extrema que llega en un producto cuya identidad no está demostrada. */
export const DROP_IDENTITY_PREFIX = "Bajada extrema sin identidad demostrada: ";

/**
 * Una revisión que solo resuelve una persona: un conflicto de identidad entre
 * productos de la tienda, o una bajada extrema en un producto que no se ha podido
 * identificar. No se recalcula en cada ejecución, porque lo que la provocó (otro
 * producto, otro precio) puede dejar de verse sin que la duda se haya resuelto:
 * la desaparición o el stock del otro producto no son evidencia de identidad.
 * Sale de aquí con una decisión manual (ingestion/decisions.ts), que ya existe.
 *
 * El marcador es el prefijo de la nota, que solo escribe la ingestión; una nota
 * manual no pasa por aquí porque `matching_method = 'manual'` se mira antes.
 */
export function isHumanOnlyReview(product: Pick<StoreProduct, "matchingStatus" | "matchingMethod" | "matchingNote">): boolean {
  return (
    product.matchingStatus === "pending_review" &&
    product.matchingMethod === null &&
    product.matchingNote !== null &&
    (product.matchingNote.startsWith(CONFLICT_NOTE_PREFIX) || product.matchingNote.startsWith(DROP_IDENTITY_PREFIX))
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// --- Identidad de un producto de tienda ---------------------------------------------

/** Lo que hace falta de un producto (o de un listado) para hablar de su identidad */
type Identifiable = Pick<StoreProduct, "title" | "brand" | "gtin"> & { matchingMethod: StoreProduct["matchingMethod"] };

interface Identity {
  tokens: Set<string>;
  variants: Set<string>;
  /** Año que dice el título, si lo dice */
  year: number | null;
  gtin: string | null;
  method: StoreProduct["matchingMethod"];
}

/** Lo que identifica un producto de tienda para saber si dos son «la misma pala con otro nombre». */
function identityOf(product: Identifiable): Identity {
  const parsed = parseTitle(product.title, [product.brand]);
  return { tokens: parsed.tokens, variants: parsed.variants, year: parsed.year, gtin: normalizeGtin(product.gtin), method: product.matchingMethod };
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((item) => b.has(item));
}

/**
 * Dos productos nombran lo mismo: mismas palabras del modelo, mismas variantes
 * («Pro» y «Pro+», «Youth» y el modelo adulto son distintos) y el mismo año si los
 * dos lo dicen. No cuentan la URL (dos variantes pueden compartirla) ni el EAN
 * (uno declarado por la tienda no demuestra nada por sí solo).
 */
function sameIdentity(a: Identity, b: Identity): boolean {
  return sameSet(a.tokens, b.tokens) && sameSet(a.variants, b.variants) && a.year === b.year;
}

/**
 * Para la convivencia en una misma pala: mismo nombre, o dos EAN distintos que el
 * catálogo ya tiene registrados como la misma pala (dos colores conocidos).
 * Compartir un EAN con nombres distintos no basta: puede ser un error de la tienda
 * o un outlet con el código del fabricante.
 */
function compatible(a: Identity, b: Identity): boolean {
  if (sameIdentity(a, b)) return true;
  if (a.year !== null && b.year !== null && a.year !== b.year) return false;
  return a.method === "gtin" && b.method === "gtin" && a.gtin !== null && b.gtin !== null && a.gtin !== b.gtin;
}

interface ResolvedMatch {
  match: MatchResult;
  /** El emparejamiento automático anterior se ha conservado pese a que hoy saldría en revisión */
  kept: boolean;
}

/**
 * Las decisiones manuales no se recalculan; el resto se reevalúa en cada ejecución.
 *
 * Un enlace automático que funcionaba no se deshace solo porque el catálogo haya
 * crecido: si hoy el producto saldría «en revisión» pero su pala sigue entre las
 * candidatas, el enlace se conserva con una nota para que alguien lo revise. Si la
 * pala ya no es candidata (otro año, otra variante, otro EAN), se sigue la regla.
 */
function resolveMatch(
  listing: StoreListing,
  previous: StoreProduct | undefined,
  catalog: CatalogRacket[],
): ResolvedMatch {
  if (previous?.matchingMethod === "manual") {
    return {
      match: {
        status: previous.matchingStatus,
        racketId: previous.racketId,
        method: "manual",
        note: previous.matchingNote,
      },
      kept: false,
    };
  }
  // Un conflicto de identidad no se recalcula: que el otro producto se agote, falte
  // o vuelva no dice nada sobre cuál de los dos es la pala. Lo decide una persona.
  if (previous && isHumanOnlyReview(previous)) {
    return { match: { status: "pending_review", racketId: null, method: null, note: previous.matchingNote }, kept: false };
  }
  const match = matchProduct(listing, catalog);
  const stable =
    previous?.matchingStatus === "matched" &&
    previous.racketId !== null &&
    previous.matchingMethod !== null &&
    match.status === "pending_review" &&
    (match.candidates ?? []).includes(previous.racketId);
  if (stable && previous) {
    return {
      match: {
        status: "matched",
        racketId: previous.racketId,
        method: previous.matchingMethod,
        note: `${KEPT_LINK_PREFIX}${match.note}`,
      },
      kept: true,
    };
  }
  return { match, kept: false };
}

interface AcceptedPrice {
  price: number | null;
  pendingPrice: number | null;
  checkedAt: string;
  held: boolean;
  /** La bajada no se puede aceptar ni retener: el producto pasa a revisión con este motivo */
  review: string | null;
}

/** Lo que hace falta para juzgar una bajada extrema en un producto que llega a una pala */
interface PriceContext {
  /** Pala a la que queda enlazado el listado */
  racketId: string | null;
  /** Precio publicado hoy para esa pala en esta tienda */
  publishedPrice: number | null;
  /** El producto de la tienda que daba ese precio, si se puede saber */
  publishedBy: StoreProduct | undefined;
  /** El listado tal como llega, para comparar su identidad */
  listing: Identifiable;
}

const euros = (value: number) => `${value.toFixed(2).replace(".", ",")} €`;

/**
 * Decide qué precio se acepta. Una bajada de más del 40 % suele ser un error
 * del origen: se retiene y solo se acepta si la ejecución siguiente la repite.
 * Mientras está retenida, el precio anterior no se da por comprobado.
 *
 * La referencia es el último precio del mismo producto. Un producto que llega
 * nuevo a una pala (o que cambia de pala) se compara con el precio que la tienda
 * ya tiene publicado para esa pala: así una bajada extrema no entra por la puerta
 * de atrás solo por venir en otro producto. Mientras se retiene, ese producto no
 * tiene precio y no se publica.
 *
 * Repetir el precio demuestra que la bajada persiste, no que el producto sea la
 * pala. Por eso, con una bajada extrema, la retención (y su aceptación) exige
 * además identidad: el producto nuevo debe nombrar lo mismo que el producto que
 * daba el precio publicado, y el mismo producto no debe haber cambiado de nombre
 * al bajar. Si no se puede demostrar, el producto va a revisión y no se publica.
 */
function acceptPrice(offer: NormalizedOffer, previous: StoreProduct | undefined, context: PriceContext): AcceptedPrice {
  const { racketId, publishedPrice } = context;
  const last = previous?.price ?? null;
  const newlyLinked = racketId !== null && previous?.racketId !== racketId;
  // Un producto retenido al llegar no tiene precio propio: su referencia sigue siendo el publicado.
  const reference = newlyLinked ? (publishedPrice ?? last) : (last ?? publishedPrice);
  const isAnomalousDrop = reference !== null && offer.price < reference * (1 - ANOMALOUS_DROP);
  const alreadyReported = previous?.pendingPrice != null;
  const accepted: AcceptedPrice = { price: offer.price, pendingPrice: null, checkedAt: offer.checkedAt, held: false, review: null };

  if (!isAnomalousDrop) return accepted;

  // Con una bajada extrema en juego, la identidad tiene que estar clara.
  const review = (reason: string): AcceptedPrice => ({ ...accepted, review: `${DROP_IDENTITY_PREFIX}${reason}` });
  const identity = identityOf(context.listing);
  if (newlyLinked) {
    if (!context.publishedBy) {
      return review(
        `el precio (${euros(offer.price)}) está más de un 40 % por debajo del publicado para esta pala (${euros(reference as number)}) y no se sabe qué producto daba ese precio. Revisar antes de publicar.`,
      );
    }
    if (!sameIdentity(identity, identityOf(context.publishedBy))) {
      return review(
        `el precio (${euros(offer.price)}) está más de un 40 % por debajo del publicado (${euros(reference as number)}) y el nombre no coincide con el del producto que lo daba, «${context.publishedBy.title}» (${context.publishedBy.externalId}). Revisar antes de publicar.`,
      );
    }
  } else if (previous && !sameIdentity(identity, identityOf(previous))) {
    return review(
      `el mismo producto de la tienda ha cambiado de nombre («${previous.title}» → «${context.listing.title}») al bajar más de un 40 %. Revisar antes de publicar.`,
    );
  }

  if (!alreadyReported) {
    return {
      price: newlyLinked ? null : last,
      pendingPrice: offer.price,
      checkedAt: previous?.checkedAt ?? offer.checkedAt,
      held: true,
      review: null,
    };
  }
  return accepted;
}

interface PricePlan {
  publish: PublishedPrice[];
  /** Palas que dejan de publicarse en la tienda */
  unpublish: string[];
  history: HistoryEntry[];
  /** Cuántos precios han cambiado */
  updated: number;
  /** Palas cuyo precio publicado pasa a salir de otro producto de la tienda */
  switches: number;
}

interface Offer {
  product: StoreProduct;
  price: number;
  shipping: number | null;
  total: number;
}

/** Los productos de una tienda que compiten por el precio de una pala, de más barato a más caro. */
function offersFor(adapter: StoreAdapter, products: StoreProduct[]): Map<string, Offer[]> {
  const byRacket = new Map<string, Offer[]>();
  for (const product of products) {
    if (
      product.racketId === null ||
      product.matchingStatus !== "matched" ||
      product.listingStatus !== "active" ||
      product.price === null ||
      product.checkedAt === null
    ) {
      continue;
    }
    const shipping = shippingFor(product.price, adapter.shipping);
    const offer = { product, price: product.price, shipping, total: round2(product.price + (shipping ?? 0)) };
    byRacket.set(product.racketId, [...(byRacket.get(product.racketId) ?? []), offer]);
  }
  for (const offers of byRacket.values()) {
    offers.sort((a, b) => a.total - b.total || a.product.externalId.localeCompare(b.product.externalId));
  }
  return byRacket;
}

/**
 * Decide, sin tocar la base de datos, qué se publica en `store_prices` y qué se
 * anota en el histórico: el mejor producto disponible de cada pala en esta tienda.
 *
 * Cuando el producto publicado cambia (el anterior se agota o desaparece), no hay
 * «precio anterior»: un cambio de producto no es un cambio de precio. Qué producto
 * estaba publicado se recalcula con los productos de antes de esta ejecución (la
 * elección es determinista); la URL no sirve, porque dos variantes de una tienda
 * pueden compartirla.
 */
function planPrices(
  adapter: StoreAdapter,
  storeId: string,
  products: StoreProduct[],
  previousProducts: StoreProduct[],
  racketIds: Set<string>,
  publishedPrices: PublishedPrice[],
  runStartedAt: string,
): PricePlan {
  const plan: PricePlan = { publish: [], unpublish: [], history: [], updated: 0, switches: 0 };
  const publishedByRacket = new Map(publishedPrices.map((price) => [price.racketId, price]));
  const offersByRacket = offersFor(adapter, products);
  const previousByRacket = offersFor(adapter, previousProducts);

  for (const racketId of racketIds) {
    const best = offersByRacket.get(racketId)?.[0];
    const published = publishedByRacket.get(racketId);

    if (!best) {
      // Agotada, desaparecida o ya sin emparejar: deja de publicarse. El histórico se conserva.
      if (published) plan.unpublish.push(racketId);
      continue;
    }

    const checkedAt = best.product.checkedAt as string;
    const priceChanged = !published || published.price !== best.price;
    if (priceChanged) plan.updated++;
    const previousBest = previousByRacket.get(racketId)?.[0];
    const switched = published !== undefined && previousBest !== undefined && previousBest.product.externalId !== best.product.externalId;
    if (switched) plan.switches++;

    // Nuestro propio precio anterior: el que teníamos publicado antes del cambio,
    // solo si sigue siendo el mismo producto.
    let previousPrice: number | null = null;
    if (published && !switched) previousPrice = priceChanged ? published.price : published.previousPrice;

    plan.publish.push({
      racketId,
      storeId,
      price: best.price,
      previousPrice,
      shipping: best.shipping,
      availability: IN_STOCK_TEXT,
      url: best.product.url,
      checkedAt,
    });

    // Solo se anota en el histórico un precio visto y aceptado en esta ejecución
    // (no los de productos ausentes ni los retenidos por bajada anómala).
    const confirmedNow =
      best.product.lastSeenAt === runStartedAt && best.product.pendingPrice === null;
    if (confirmedNow) {
      plan.history.push({ racketId, storeId, priceDate: checkedAt.slice(0, 10), total: best.total });
    }
  }

  return plan;
}

interface ConflictReport {
  conflicts: OfferConflict[];
  /** Productos de más que repiten una pala con el mismo nombre */
  duplicates: number;
}

/**
 * Varios productos de una tienda en la misma pala (activos o agotados; los
 * desaparecidos ya no cuentan). Si nombran lo mismo (dos colores, dos fichas del
 * mismo modelo) son duplicados y se publica el más barato. Si no, es un
 * conflicto: se mantiene el que fijó una persona o el que ya venía enlazado a esa
 * pala de antes, y los demás pasan a revisión con el motivo. Sin
 * ninguno que mantener, todos van a revisión: no se elige el más barato a ciegas.
 *
 * Modifica `products` en el sitio (estado y nota de los que van a revisión).
 */
function resolveConflicts(products: StoreProduct[], previousById: Map<string, StoreProduct>): ConflictReport {
  const report: ConflictReport = { conflicts: [], duplicates: 0 };
  const groups = new Map<string, StoreProduct[]>();
  for (const product of products) {
    if (product.matchingStatus !== "matched" || product.listingStatus === "missing" || product.racketId === null) continue;
    groups.set(product.racketId, [...(groups.get(product.racketId) ?? []), product]);
  }

  for (const [racketId, group] of groups) {
    if (group.length < 2) continue;
    const identities = new Map(group.map((product) => [product.externalId, identityOf(product)]));
    const alike = (a: StoreProduct, b: StoreProduct) =>
      compatible(identities.get(a.externalId) as Identity, identities.get(b.externalId) as Identity);

    if (group.every((a) => group.every((b) => alike(a, b)))) {
      report.duplicates += group.length - 1;
      continue;
    }

    // Qué enlace se mantiene: lo que decidió una persona o lo que ya estaba enlazado a esta
    // pala antes de esta ejecución (la URL no identifica: dos variantes pueden compartirla).
    const kept = group.filter((product) => {
      const previous = previousById.get(product.externalId);
      return product.matchingMethod === "manual" || (previous?.matchingStatus === "matched" && previous.racketId === racketId);
    });
    const review = group.filter((product) => !kept.includes(product) && !kept.some((anchor) => alike(anchor, product)));
    // Entre los que se mantienen puede haber dos con nombre distinto fijados a mano: eso lo decidió una persona.
    report.duplicates += group.length - review.length - 1;

    if (kept.length === 0) {
      // Nadie estaba publicado ni fijado: no hay con qué decidir y ninguno se publica.
      for (const product of group) {
        const other = group.find((candidate) => candidate !== product) as StoreProduct;
        Object.assign(product, { matchingStatus: "pending_review", matchingMethod: null, racketId: null, matchingNote: conflictNote(other) });
      }
      report.conflicts.push({ racketId, kept: null, review: group.map((product) => product.externalId) });
      continue;
    }

    if (review.length === 0) continue;
    const anchor = kept[0];
    for (const product of review) {
      Object.assign(product, { matchingStatus: "pending_review", matchingMethod: null, racketId: null, matchingNote: conflictNote(anchor) });
    }
    report.conflicts.push({ racketId, kept: anchor.externalId, review: review.map((product) => product.externalId) });
  }

  return report;
}

type Counts = Pick<
  RunSummary,
  | "productsMatched"
  | "productsPending"
  | "pricesUpdated"
  | "productsInvalid"
  | "pricesHeld"
  | "productsConflicting"
  | "duplicateOffers"
  | "linksKept"
  | "invalidEans"
  | "offerSwitches"
  | "conflicts"
>;

/**
 * Aplica los listados de una tienda: productos, precios publicados, histórico y
 * agregados. Lee una vez lo que ya se sabe de la tienda, decide todo en memoria
 * y escribe por lotes: el número de consultas no depende de cuántos productos
 * tenga la tienda.
 */
async function applyListings(
  repository: IngestionRepository,
  adapter: StoreAdapter,
  store: IngestionStore,
  listings: StoreListing[],
  now: Date,
): Promise<Counts> {
  const startedAt = now.toISOString();
  const counts: Counts = {
    productsMatched: 0,
    productsPending: 0,
    pricesUpdated: 0,
    productsInvalid: 0,
    pricesHeld: 0,
    productsConflicting: 0,
    duplicateOffers: 0,
    linksKept: 0,
    invalidEans: 0,
    offerSwitches: 0,
    conflicts: [],
  };

  const [catalog, known, publishedPrices] = await Promise.all([
    repository.loadCatalog(),
    repository.listStoreProducts(store.id),
    repository.listPublishedPrices(store.id),
  ]);
  const previousById = new Map(known.map((product) => [product.externalId, product]));
  const publishedByRacket = new Map(publishedPrices.map((price) => [price.racketId, price]));
  // Qué producto daba el precio publicado de cada pala: el mejor de la ejecución anterior.
  const previousOffers = offersFor(adapter, known);
  const current = new Map(previousById);
  const affectedRackets = new Set<string>();
  const seen = new Set<string>();

  for (const listing of listings) {
    const normalized = normalizeListing(listing, adapter.shipping, now);
    if (!normalized.ok) {
      counts.productsInvalid++;
      continue;
    }
    seen.add(listing.externalId);
    if (hasInvalidEan(listing)) counts.invalidEans++;

    const previous = previousById.get(listing.externalId);
    const resolved = resolveMatch(listing, previous, catalog);
    const { kept } = resolved;
    let { match } = resolved;
    const gtin = normalizeGtin(listing.ean);
    const accepted = acceptPrice(normalized.offer, previous, {
      racketId: match.racketId,
      publishedPrice: match.racketId === null ? null : (publishedByRacket.get(match.racketId)?.price ?? null),
      publishedBy: match.racketId === null ? undefined : previousOffers.get(match.racketId)?.[0]?.product,
      listing: { title: listing.title, brand: listing.brand, gtin, matchingMethod: match.method },
    });
    // Una bajada extrema sin identidad demostrada no se publica: el producto queda para una persona.
    if (accepted.review !== null) match = { status: "pending_review", racketId: null, method: null, note: accepted.review };

    if (kept) counts.linksKept++;
    if (accepted.held) counts.pricesHeld++;
    if (previous?.racketId) affectedRackets.add(previous.racketId);
    if (match.racketId) affectedRackets.add(match.racketId);
    // La pala a la que iba a ir el producto se reevalúa igual: un precio publicado sin producto que lo sostenga se retira.
    if (resolved.match.racketId) affectedRackets.add(resolved.match.racketId);

    const product: StoreProduct = {
      storeId: store.id,
      externalId: listing.externalId,
      racketId: match.racketId,
      title: listing.title,
      brand: listing.brand,
      gtin,
      url: listing.url,
      matchingStatus: match.status,
      matchingMethod: match.method,
      matchingNote: match.note,
      listingStatus: normalized.offer.available ? "active" : "out_of_stock",
      price: accepted.price,
      listPrice: normalized.offer.listPrice,
      pendingPrice: accepted.pendingPrice,
      checkedAt: accepted.checkedAt,
      firstSeenAt: previous?.firstSeenAt ?? startedAt,
      lastSeenAt: startedAt,
      missedRuns: 0,
    };
    // Si la tienda repite un producto en la misma lectura, vale el último.
    current.set(product.externalId, product);
  }

  // Productos que la tienda ya no devuelve. A la primera ausencia se conserva
  // su precio (sin avanzar checked_at); a la segunda se dan por desaparecidos.
  for (const product of known) {
    if (seen.has(product.externalId)) continue;

    const missedRuns = product.missedRuns + 1;
    const updated: StoreProduct = {
      ...product,
      missedRuns,
      listingStatus: missedRuns >= MISSING_AFTER_RUNS ? "missing" : product.listingStatus,
    };
    current.set(updated.externalId, updated);
    if (updated.racketId) affectedRackets.add(updated.racketId);
  }

  // `current` contiene todos los productos de la tienda, vistos o no, una vez cada uno.
  const products = [...current.values()];

  // Varios productos de la tienda en la misma pala: duplicados se publican; conflictos, a revisión.
  const { conflicts, duplicates } = resolveConflicts(products, previousById);
  counts.conflicts = conflicts;
  counts.duplicateOffers = duplicates;
  counts.productsConflicting = conflicts.reduce((sum, conflict) => sum + conflict.review.length, 0);
  for (const product of products) {
    if (product.lastSeenAt !== startedAt) continue;
    if (product.matchingStatus === "matched") counts.productsMatched++;
    if (product.matchingStatus === "pending_review") counts.productsPending++;
  }

  const plan = planPrices(adapter, store.id, products, known, affectedRackets, publishedPrices, startedAt);
  counts.pricesUpdated = plan.updated;
  counts.offerSwitches = plan.switches;

  await repository.saveStoreProducts(products);
  await repository.unpublishPrices(store.id, plan.unpublish);
  await repository.publishPrices(plan.publish);
  await repository.recordHistory(plan.history);
  // Los agregados se recalculan una sola vez, con todo ya escrito.
  await repository.refreshStats(now);

  return counts;
}

/** Ya hay otra ingestión en marcha: esta no ha empezado ni ha escrito nada. */
export class IngestionLockedError extends Error {
  constructor() {
    super("Ya hay una ingestión de precios en marcha. Esta ejecución se ha cancelado sin cambiar nada.");
    this.name = "IngestionLockedError";
  }
}

/** Duración de las dos fases de una ejecución, para medirla desde fuera. */
export interface RunTimings {
  /** Descarga del catálogo de la tienda */
  fetchMs?: number;
  /** Emparejamiento y escritura en la base de datos */
  applyMs?: number;
}

/**
 * Ejecuta la ingestión de una tienda: obtiene sus productos, los empareja con
 * el catálogo, normaliza precios y actualiza productos de tienda, precios
 * publicados, histórico y agregados.
 *
 * Todos los datos se escriben en una única transacción: si algo falla, no
 * queda ningún precio a medio actualizar. El registro de la ejecución se
 * escribe fuera de ella, para que el fallo quede anotado. Con los precios sin
 * tocar, `checked_at` deja de avanzar y la web los irá marcando como «último
 * precio conocido» y «sin confirmar» por sí sola.
 *
 * Nunca hay dos ingestiones a la vez: toda la ejecución ocurre con el bloqueo
 * global tomado. Si otra lo tiene, lanza IngestionLockedError sin haber escrito
 * nada, ni siquiera el registro de la ejecución.
 */
export async function runIngestion(
  adapter: StoreAdapter,
  repository: IngestionRepository,
  now: Date = new Date(),
  timings: RunTimings = {},
): Promise<RunSummary> {
  const locked = await repository.withIngestionLock(() =>
    runLocked(adapter, repository, now, timings),
  );
  if (!locked.acquired) throw new IngestionLockedError();
  return locked.value;
}

async function runLocked(
  adapter: StoreAdapter,
  repository: IngestionRepository,
  now: Date,
  timings: RunTimings,
): Promise<RunSummary> {
  const startedAt = now.toISOString();
  // Con el bloqueo tomado, una ejecución «en marcha» es de un proceso que murió.
  await repository.failInterruptedRuns(startedAt);

  const store = await repository.ensureStore(adapter.store);
  const runId = await repository.startRun(store.id, startedAt);

  const summary: RunSummary = {
    runId,
    storeSlug: store.slug,
    status: "success",
    finishedAt: startedAt,
    productsSeen: 0,
    productsMatched: 0,
    productsPending: 0,
    pricesUpdated: 0,
    productsInvalid: 0,
    pricesHeld: 0,
    productsConflicting: 0,
    duplicateOffers: 0,
    linksKept: 0,
    invalidEans: 0,
    offerSwitches: 0,
    conflicts: [],
    errorMessage: null,
  };

  try {
    // La descarga ocurre antes de abrir la transacción: nada de red con ella abierta.
    const fetchStarted = performance.now();
    const listings = await adapter.fetchProducts();
    timings.fetchMs = performance.now() - fetchStarted;
    summary.productsSeen = listings.length;

    const applyStarted = performance.now();
    const counts = await repository.transaction((tx) =>
      applyListings(tx, adapter, store, listings, now),
    );
    timings.applyMs = performance.now() - applyStarted;
    Object.assign(summary, counts);
  } catch (error) {
    summary.status = "failed";
    summary.errorMessage = error instanceof Error ? error.message : String(error);
  }

  summary.finishedAt = new Date().toISOString();
  await repository.finishRun(runId, summary);
  return summary;
}
