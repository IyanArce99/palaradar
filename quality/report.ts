// Informe interno de calidad de datos: métricas de cobertura del catálogo e
// incidencias que alguien debería mirar. Todo se calcula con datos leídos; aquí
// no se escribe ni se corrige nada (ver scripts/quality/report.ts).
//
// Una incidencia no es siempre un error. Cada una lleva su naturaleza:
//   · error-confirmado: los datos se contradicen (el mismo EAN en dos palas)
//   · posible-error:    algo no cuadra, pero puede ser correcto (un peso raro)
//   · dato-ausente:     falta un dato; no se da por incorrecto el resto
//   · dato-antiguo:     el dato existe, pero lleva tiempo sin comprobarse
//   · ambiguo:          necesita que una persona decida (un emparejamiento dudoso)
import { normalizeBrand, normalizeText } from "@/ingestion/title";
import { COMPARABLE_STORES } from "@/lib/catalog/query";
import { priceState, readiness, READINESS_LABELS, type ReadinessKey } from "@/lib/data-confidence";
import { median } from "@/lib/price-stats";
import { priceFreshness } from "@/lib/pricing";
import { MAX_RACKET_GRAMS, MIN_RACKET_GRAMS } from "@/lib/vocabulary";
import type { PalaBalance, PlayerLevel, PlayStyle } from "@/types/catalog";
import { suggestMatches, type CatalogCandidate, type MatchReview } from "./matching";

export type IssueNature = "error-confirmado" | "posible-error" | "dato-ausente" | "dato-antiguo" | "ambiguo";
export type IssueSeverity = "alta" | "media" | "baja";

export const NATURE_LABELS: Record<IssueNature, string> = {
  "error-confirmado": "Error confirmado",
  "posible-error": "Posible error",
  "dato-ausente": "Dato ausente",
  "dato-antiguo": "Dato antiguo",
  ambiguo: "Necesita revisión",
};

export const ISSUE_TYPES = {
  "ean-compartido": "El mismo EAN en dos palas",
  "posible-duplicado": "Posible pala duplicada",
  "peso-fuera-de-rango": "Peso fuera de lo habitual",
  "precio-sobre-pvpr": "Precio muy por encima del PVPR",
  "conflicto-fuentes": "Las fuentes no coinciden",
  "emparejamiento-pendiente": "Producto de tienda sin emparejar",
  "precio-antiguo": "Precio sin comprobar recientemente",
  "sin-precio": "Sin precio en ninguna tienda",
  "sin-foto": "Sin foto real",
  "datos-incompletos": "Datos técnicos incompletos",
  "sin-identificador": "Sin EAN ni referencia",
  "ingestion-fallida": "Ingestión con fallos",
  "ingestion-atrasada": "Tienda sin actualizar",
} as const;
export type IssueType = keyof typeof ISSUE_TYPES;

export interface Issue {
  type: IssueType;
  nature: IssueNature;
  severity: IssueSeverity;
  /** Marca y modelo, o el título del producto de tienda */
  subject: string;
  brand: string | null;
  /** Slug de la pala, si la incidencia es de una pala del catálogo */
  slug: string | null;
  /** Tienda, si la incidencia es de una tienda o de un producto suyo */
  store: string | null;
  /** Fuente del dato técnico, si se conoce */
  source: string | null;
  /** Antigüedad del dato en días, si aplica */
  ageDays: number | null;
  detail: string;
  /** Estado de revisión: hoy todo está sin revisar o en la cola de emparejamiento */
  review: "sin-revisar" | "en-cola";
  /** Sugerencias de emparejamiento, solo en productos de tienda */
  match?: MatchReview;
  /** Enlace externo para comprobarlo (la página del producto en la tienda) */
  url?: string;
}

export interface RacketQualityRow {
  id: string;
  slug: string;
  brand: string;
  model: string;
  year: number;
  shape: CatalogCandidate["shape"];
  hasPhoto: boolean;
  bestPrice: number | null;
  priceCheckedAt: string | null;
  storeCount: number;
  weightMin: number | null;
  weightMax: number | null;
  balance: PalaBalance | null;
  playStyle: PlayStyle | null;
  levels: PlayerLevel[];
  hasTouch: boolean;
  hasCore: boolean;
  hasFaces: boolean;
  hasRatings: boolean;
  gtins: string[];
  hasManufacturerRef: boolean;
  msrp: number | null;
  /** Atributos en los que las fuentes no coinciden */
  conflicts: number;
  /** Dominio de la fuente de las especificaciones */
  source: string | null;
}

export interface PendingStoreProduct {
  store: string;
  title: string;
  brand: string | null;
  gtin: string | null;
  url: string;
  note: string | null;
  price: number | null;
  lastSeenAt: string | null;
}

export interface StoreHealth {
  store: string;
  /** Última ejecución correcta (ISO con hora); null si nunca ha habido una */
  lastSuccessAt: string | null;
  /** Ejecuciones fallidas en los últimos 7 días */
  recentFailures: number;
  lastError: string | null;
  /** Productos de la tienda enlazados a una pala y pendientes de revisión */
  matched: number;
  pending: number;
}

export interface QualityInput {
  rackets: RacketQualityRow[];
  pending: PendingStoreProduct[];
  stores: StoreHealth[];
}

/** Horas sin una ingestión correcta a partir de las cuales una tienda está atrasada (se ejecuta cada 6) */
export const INGESTION_LATE_HOURS = 13;
/** Un precio por encima de este múltiplo del PVPR es sospechoso */
export const MSRP_SUSPICIOUS_RATIO = 1.25;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const name = (row: Pick<RacketQualityRow, "brand" | "model" | "year">) => `${row.brand} ${row.model} ${row.year}`;
const ageInDays = (iso: string, now: Date) => Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / DAY_MS));

function racketIssue(row: RacketQualityRow, issue: Pick<Issue, "type" | "nature" | "severity" | "detail"> & Partial<Issue>): Issue {
  return {
    subject: name(row),
    brand: row.brand,
    slug: row.slug,
    store: null,
    source: row.source,
    ageDays: null,
    review: "sin-revisar",
    ...issue,
  };
}

/** Datos técnicos habituales que una pala no declara. */
export function missingFields(row: RacketQualityRow): string[] {
  const checks: [string, boolean][] = [
    ["peso", row.weightMin !== null],
    ["balance", row.balance !== null],
    ["nivel", row.levels.length > 0],
    ["estilo de juego", row.playStyle !== null],
    ["tacto o dureza", row.hasTouch],
    ["núcleo", row.hasCore],
    ["caras", row.hasFaces],
  ];
  return checks.filter(([, present]) => !present).map(([label]) => label);
}

function issuesOfRacket(row: RacketQualityRow, now: Date): Issue[] {
  const issues: Issue[] = [];
  const freshness = row.priceCheckedAt === null || row.bestPrice === null ? null : priceFreshness(row.priceCheckedAt, now);
  const state = priceState(freshness);

  if (state === "sin-precio") {
    issues.push(racketIssue(row, { type: "sin-precio", nature: "dato-ausente", severity: "baja", detail: "Ninguna tienda seguida la tiene a la venta. No es un error: puede no venderse ya." }));
  } else if (state !== "reciente" && row.priceCheckedAt !== null) {
    issues.push(
      racketIssue(row, {
        type: "precio-antiguo",
        nature: "dato-antiguo",
        severity: state === "sin-confirmar" ? "alta" : "media",
        ageDays: ageInDays(row.priceCheckedAt, now),
        detail:
          state === "sin-confirmar"
            ? "El precio está sin confirmar: no se usa en ofertas ni en recomendaciones."
            : "El precio no se ha comprobado en las últimas horas; se presenta como último precio conocido.",
      }),
    );
  }

  if (!row.hasPhoto) {
    issues.push(
      racketIssue(row, {
        type: "sin-foto",
        nature: "dato-ausente",
        // Una pala que se puede comprar y no tiene foto es lo primero que hay que arreglar.
        severity: state === "sin-precio" ? "baja" : "alta",
        detail: state === "sin-precio" ? "Se muestra con su ilustración." : "Tiene precio hoy y se muestra con una ilustración, no con su foto.",
      }),
    );
  }

  const missing = missingFields(row);
  if (missing.length > 0) {
    issues.push(
      racketIssue(row, {
        type: "datos-incompletos",
        nature: "dato-ausente",
        severity: missing.length >= 4 && state !== "sin-precio" ? "media" : "baja",
        detail: `La fuente no declara: ${missing.join(", ")}.`,
      }),
    );
  }

  if (row.gtins.length === 0 && !row.hasManufacturerRef) {
    issues.push(racketIssue(row, { type: "sin-identificador", nature: "dato-ausente", severity: "baja", detail: "Sin EAN ni referencia del fabricante: sus productos de tienda solo se pueden emparejar por nombre." }));
  }

  if (row.conflicts > 0) {
    issues.push(
      racketIssue(row, {
        type: "conflicto-fuentes",
        nature: "ambiguo",
        severity: "media",
        detail: `${row.conflicts} ${row.conflicts === 1 ? "atributo en el que" : "atributos en los que"} las fuentes dan valores distintos.`,
      }),
    );
  }

  const outOfRange = (grams: number | null) => grams !== null && (grams < MIN_RACKET_GRAMS || grams > MAX_RACKET_GRAMS);
  if (outOfRange(row.weightMin) || outOfRange(row.weightMax) || (row.weightMin !== null && row.weightMax !== null && row.weightMin > row.weightMax)) {
    issues.push(
      racketIssue(row, {
        type: "peso-fuera-de-rango",
        nature: "posible-error",
        severity: "media",
        detail: `Peso declarado: ${row.weightMin}–${row.weightMax} g. Lo habitual está entre ${MIN_RACKET_GRAMS} y ${MAX_RACKET_GRAMS} g: puede ser una pala junior o un error de unidad.`,
      }),
    );
  }

  if (state !== "sin-precio" && row.bestPrice !== null && row.msrp !== null && row.msrp > 0 && row.bestPrice > row.msrp * MSRP_SUSPICIOUS_RATIO) {
    issues.push(
      racketIssue(row, {
        type: "precio-sobre-pvpr",
        nature: "posible-error",
        severity: "media",
        detail: `Su mejor precio (${row.bestPrice} €) supera en más de un ${Math.round((MSRP_SUSPICIOUS_RATIO - 1) * 100)} % su PVPR (${row.msrp} €): puede ser un emparejamiento equivocado o un PVPR mal recogido.`,
      }),
    );
  }

  return issues;
}

/**
 * Nombre de modelo para buscar duplicados: sin mayúsculas, acentos, espacios ni
 * guiones. El «+» no es un signo cualquiera, nombra otro modelo («Pro» y «Pro+»
 * son palas distintas), así que se conserva como «plus», igual que al leer títulos.
 */
export function duplicateKey(model: string): string {
  return normalizeText(model).replace(/\+/g, " plus ").replace(/[^a-z0-9]+/g, "");
}

/** Palas que parecen la misma: misma marca, mismo nombre (sin mayúsculas ni signos) y mismo año. */
function duplicateIssues(rackets: RacketQualityRow[]): Issue[] {
  const groups = new Map<string, RacketQualityRow[]>();
  for (const row of rackets) {
    const key = `${normalizeBrand(row.brand)}|${duplicateKey(row.model)}|${row.year}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .flatMap((group) =>
      group.map((row) =>
        racketIssue(row, {
          type: "posible-duplicado",
          nature: "posible-error",
          severity: "media",
          detail: `Mismo nombre y año que ${group.filter((other) => other.slug !== row.slug).map((other) => other.slug).join(", ")}. Pueden ser dos colores de la misma pala (correcto) o un duplicado.`,
        }),
      ),
    );
}

/** El mismo EAN en dos palas: un EAN identifica un solo producto. */
function sharedGtinIssues(rackets: RacketQualityRow[]): Issue[] {
  const owners = new Map<string, RacketQualityRow[]>();
  for (const row of rackets) {
    for (const gtin of row.gtins) owners.set(gtin, [...(owners.get(gtin) ?? []), row]);
  }
  return [...owners.entries()]
    .filter(([, group]) => group.length > 1)
    .flatMap(([gtin, group]) =>
      group.map((row) =>
        racketIssue(row, {
          type: "ean-compartido",
          nature: "error-confirmado",
          severity: "alta",
          detail: `El EAN ${gtin} figura también en ${group.filter((other) => other.slug !== row.slug).map((other) => other.slug).join(", ")}. Un EAN identifica un solo producto.`,
        }),
      ),
    );
}

function storeIssues(stores: StoreHealth[], now: Date): Issue[] {
  return stores.flatMap((store) => {
    const issues: Issue[] = [];
    const base = { subject: store.store, brand: null, slug: null, store: store.store, source: null, review: "sin-revisar" as const };
    if (store.recentFailures > 0) {
      issues.push({
        ...base,
        type: "ingestion-fallida",
        nature: "error-confirmado",
        severity: store.recentFailures >= 3 ? "alta" : "media",
        ageDays: null,
        detail: `${store.recentFailures} ${store.recentFailures === 1 ? "ejecución fallida" : "ejecuciones fallidas"} en los últimos 7 días.${store.lastError ? ` Último error: ${store.lastError}` : ""}`,
      });
    }
    const hours = store.lastSuccessAt === null ? null : (now.getTime() - Date.parse(store.lastSuccessAt)) / HOUR_MS;
    if (hours === null || hours > INGESTION_LATE_HOURS) {
      issues.push({
        ...base,
        type: "ingestion-atrasada",
        nature: "dato-antiguo",
        severity: hours === null || hours > 24 ? "alta" : "media",
        ageDays: store.lastSuccessAt === null ? null : ageInDays(store.lastSuccessAt, now),
        detail:
          hours === null
            ? "No consta ninguna ingestión correcta."
            : `La última ingestión correcta fue hace ${Math.round(hours)} horas; lo normal es una cada 6.`,
      });
    }
    return issues;
  });
}

function pendingIssues(pending: PendingStoreProduct[], rackets: RacketQualityRow[], now: Date): Issue[] {
  const catalog: CatalogCandidate[] = rackets.map((row) => ({
    id: row.id,
    slug: row.slug,
    brand: row.brand,
    model: row.model,
    year: row.year,
    shape: row.shape,
    gtins: row.gtins,
  }));
  return pending.map((product) => {
    const match = suggestMatches(product, catalog);
    return {
      type: "emparejamiento-pendiente",
      nature: "ambiguo",
      // Con una coincidencia clara es trabajo rápido que publica un precio: va antes.
      // Si varias palas empatan no es trabajo rápido: hay que distinguirlas a mano.
      severity: !match.ambiguous && match.suggestions[0]?.confidence === "alta" ? "alta" : "media",
      subject: product.title,
      brand: product.brand,
      slug: null,
      store: product.store,
      source: null,
      ageDays: product.lastSeenAt === null ? null : ageInDays(product.lastSeenAt, now),
      detail: product.note ?? "En la cola de revisión.",
      review: "en-cola",
      match,
      url: product.url,
    };
  });
}

export interface QualityMetrics {
  total: number;
  /** Recuento y tanto por ciento de cada indicador */
  indicators: { label: string; count: number; percent: number }[];
  /** Antigüedad de los precios vigentes, en horas */
  priceAgeHours: { newest: number | null; oldest: number | null; median: number | null };
  /** Para qué funciones tiene información suficiente cada pala */
  readiness: { key: ReadinessKey; label: string; count: number; percent: number }[];
  stores: StoreHealth[];
  pendingMatches: number;
  /** Incidencias por naturaleza y por gravedad */
  byNature: Record<IssueNature, number>;
  bySeverity: Record<IssueSeverity, number>;
}

export interface QualityReport {
  generatedAt: string;
  metrics: QualityMetrics;
  issues: Issue[];
}

const percent = (count: number, total: number) => (total === 0 ? 0 : Math.round((count / total) * 1000) / 10);

const SEVERITY_ORDER: Record<IssueSeverity, number> = { alta: 0, media: 1, baja: 2 };
const NATURE_ORDER: Record<IssueNature, number> = { "error-confirmado": 0, "posible-error": 1, ambiguo: 2, "dato-antiguo": 3, "dato-ausente": 4 };

/** El informe completo: métricas e incidencias ordenadas por gravedad. No escribe nada. */
export function buildQualityReport(input: QualityInput, now: Date): QualityReport {
  const { rackets } = input;
  const total = rackets.length;
  const stateOf = (row: RacketQualityRow) =>
    priceState(row.bestPrice === null || row.priceCheckedAt === null ? null : priceFreshness(row.priceCheckedAt, now));
  const states = rackets.map(stateOf);
  const count = (predicate: (row: RacketQualityRow, index: number) => boolean) => rackets.filter(predicate).length;
  const indicator = (label: string, value: number) => ({ label, count: value, percent: percent(value, total) });

  const ages = rackets
    .filter((row, i) => states[i] !== "sin-precio" && row.priceCheckedAt !== null)
    .map((row) => (now.getTime() - Date.parse(row.priceCheckedAt as string)) / HOUR_MS)
    .sort((a, b) => a - b);
  const round1 = (value: number | undefined) => (value === undefined ? null : Math.round(value * 10) / 10);

  const ready = rackets.map((row, i) =>
    readiness({
      hasUsablePrice: states[i] === "reciente" || states[i] === "antiguo",
      storeCount: states[i] === "sin-precio" ? 0 : row.storeCount,
      balance: row.balance,
      playStyle: row.playStyle,
      levels: row.levels,
      hasWeight: row.weightMin !== null,
      hasTouch: row.hasTouch,
      hasRatings: row.hasRatings,
    }),
  );

  const issues = [
    ...sharedGtinIssues(rackets),
    ...duplicateIssues(rackets),
    ...rackets.flatMap((row) => issuesOfRacket(row, now)),
    ...pendingIssues(input.pending, rackets, now),
    ...storeIssues(input.stores, now),
  ].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      NATURE_ORDER[a.nature] - NATURE_ORDER[b.nature] ||
      a.type.localeCompare(b.type) ||
      a.subject.localeCompare(b.subject, "es"),
  );

  const tally = <K extends string>(keys: K[], pick: (issue: Issue) => K) =>
    Object.fromEntries(keys.map((key) => [key, issues.filter((issue) => pick(issue) === key).length])) as Record<K, number>;

  return {
    generatedAt: now.toISOString(),
    metrics: {
      total,
      indicators: [
        indicator("Con foto real", count((row) => row.hasPhoto)),
        indicator("Con precio reciente", count((_, i) => states[i] === "reciente")),
        indicator("Con precio conocido, pero antiguo", count((_, i) => states[i] === "antiguo")),
        indicator("Con precio sin confirmar", count((_, i) => states[i] === "sin-confirmar")),
        indicator("Sin precio", count((_, i) => states[i] === "sin-precio")),
        indicator(`Con precio en ${COMPARABLE_STORES} tiendas o más`, count((row, i) => (states[i] === "reciente" || states[i] === "antiguo") && row.storeCount >= COMPARABLE_STORES)),
        indicator("Con datos técnicos incompletos", count((row) => missingFields(row).length > 0)),
        indicator("Con EAN", count((row) => row.gtins.length > 0)),
        indicator("Sin EAN ni referencia del fabricante", count((row) => row.gtins.length === 0 && !row.hasManufacturerRef)),
        indicator("Con fuentes que no coinciden", count((row) => row.conflicts > 0)),
        indicator("Con posible duplicado", new Set(duplicateIssues(rackets).map((issue) => issue.slug)).size),
      ],
      priceAgeHours: { newest: round1(ages[0]), oldest: round1(ages.at(-1)), median: round1(median(ages) ?? undefined) },
      readiness: (Object.keys(READINESS_LABELS) as ReadinessKey[]).map((key) => {
        const value = ready.filter((item) => item[key].ready).length;
        return { key, label: READINESS_LABELS[key], count: value, percent: percent(value, total) };
      }),
      stores: input.stores,
      pendingMatches: input.pending.length,
      byNature: tally(Object.keys(NATURE_LABELS) as IssueNature[], (issue) => issue.nature),
      bySeverity: tally(["alta", "media", "baja"], (issue) => issue.severity),
    },
    issues,
  };
}
