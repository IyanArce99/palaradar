import { normalizeGtin } from "./gtin";
import { matchProduct } from "./matcher";
import { normalizeListing, shippingFor } from "./normalizer";
import type { HistoryEntry, IngestionRepository, IngestionStore } from "./repository";
import type {
  CatalogRacket,
  MatchResult,
  NormalizedOffer,
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Las decisiones manuales no se recalculan; el resto se reevalúa en cada ejecución. */
function resolveMatch(
  listing: StoreListing,
  previous: StoreProduct | undefined,
  catalog: CatalogRacket[],
): MatchResult {
  if (previous?.matchingMethod === "manual") {
    return {
      status: previous.matchingStatus,
      racketId: previous.racketId,
      method: "manual",
      note: previous.matchingNote,
    };
  }
  return matchProduct(listing, catalog);
}

interface AcceptedPrice {
  price: number;
  pendingPrice: number | null;
  checkedAt: string;
  held: boolean;
}

/**
 * Decide qué precio se acepta. Una bajada de más del 40 % suele ser un error
 * del origen: se retiene y solo se acepta si la ejecución siguiente la repite.
 * Mientras está retenida, el precio anterior no se da por comprobado.
 */
function acceptPrice(offer: NormalizedOffer, previous: StoreProduct | undefined): AcceptedPrice {
  const last = previous?.price ?? null;
  const isAnomalousDrop = last !== null && offer.price < last * (1 - ANOMALOUS_DROP);
  const alreadyReported = previous?.pendingPrice != null;

  if (previous && last !== null && isAnomalousDrop && !alreadyReported) {
    return {
      price: last,
      pendingPrice: offer.price,
      checkedAt: previous.checkedAt ?? offer.checkedAt,
      held: true,
    };
  }
  return { price: offer.price, pendingPrice: null, checkedAt: offer.checkedAt, held: false };
}

interface PricePlan {
  publish: PublishedPrice[];
  /** Palas que dejan de publicarse en la tienda */
  unpublish: string[];
  history: HistoryEntry[];
  /** Cuántos precios han cambiado */
  updated: number;
}

/**
 * Decide, sin tocar la base de datos, qué se publica en `store_prices` y qué se
 * anota en el histórico: el mejor producto disponible de cada pala en esta tienda.
 */
function planPrices(
  adapter: StoreAdapter,
  storeId: string,
  products: StoreProduct[],
  racketIds: Set<string>,
  publishedPrices: PublishedPrice[],
  runStartedAt: string,
): PricePlan {
  const plan: PricePlan = { publish: [], unpublish: [], history: [], updated: 0 };
  const publishedByRacket = new Map(publishedPrices.map((price) => [price.racketId, price]));

  const productsByRacket = new Map<string, StoreProduct[]>();
  for (const product of products) {
    if (product.racketId === null) continue;
    const group = productsByRacket.get(product.racketId) ?? [];
    group.push(product);
    productsByRacket.set(product.racketId, group);
  }

  for (const racketId of racketIds) {
    const offers = (productsByRacket.get(racketId) ?? [])
      .filter(
        (product) =>
          product.matchingStatus === "matched" &&
          product.listingStatus === "active" &&
          product.price !== null &&
          product.checkedAt !== null,
      )
      .map((product) => {
        const price = product.price as number;
        const shipping = shippingFor(price, adapter.shipping);
        return { product, price, shipping, total: round2(price + shipping) };
      })
      .sort((a, b) => a.total - b.total);

    const best = offers[0];
    const published = publishedByRacket.get(racketId);

    if (!best) {
      // Agotada, desaparecida o ya sin emparejar: deja de publicarse. El histórico se conserva.
      if (published) plan.unpublish.push(racketId);
      continue;
    }

    const checkedAt = best.product.checkedAt as string;
    const priceChanged = !published || published.price !== best.price;
    if (priceChanged) plan.updated++;

    // Nuestro propio precio anterior: el que teníamos publicado antes del cambio.
    let previousPrice: number | null = null;
    if (published) previousPrice = priceChanged ? published.price : published.previousPrice;

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

type Counts = Pick<
  RunSummary,
  "productsMatched" | "productsPending" | "pricesUpdated" | "productsInvalid" | "pricesHeld"
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
  };

  const [catalog, known, publishedPrices] = await Promise.all([
    repository.loadCatalog(),
    repository.listStoreProducts(store.id),
    repository.listPublishedPrices(store.id),
  ]);
  const previousById = new Map(known.map((product) => [product.externalId, product]));
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

    const previous = previousById.get(listing.externalId);
    const match = resolveMatch(listing, previous, catalog);
    const accepted = acceptPrice(normalized.offer, previous);

    if (match.status === "matched") counts.productsMatched++;
    if (match.status === "pending_review") counts.productsPending++;
    if (accepted.held) counts.pricesHeld++;
    if (previous?.racketId) affectedRackets.add(previous.racketId);
    if (match.racketId) affectedRackets.add(match.racketId);

    const product: StoreProduct = {
      storeId: store.id,
      externalId: listing.externalId,
      racketId: match.racketId,
      title: listing.title,
      brand: listing.brand,
      gtin: normalizeGtin(listing.ean),
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
  const plan = planPrices(adapter, store.id, products, affectedRackets, publishedPrices, startedAt);
  counts.pricesUpdated = plan.updated;

  await repository.saveStoreProducts(products);
  await repository.unpublishPrices(store.id, plan.unpublish);
  await repository.publishPrices(plan.publish);
  await repository.recordHistory(plan.history);
  // Los agregados se recalculan una sola vez, con todo ya escrito.
  await repository.refreshStats(now);

  return counts;
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
 */
export async function runIngestion(
  adapter: StoreAdapter,
  repository: IngestionRepository,
  now: Date = new Date(),
  timings: RunTimings = {},
): Promise<RunSummary> {
  const store = await repository.ensureStore(adapter.store);
  const startedAt = now.toISOString();
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
