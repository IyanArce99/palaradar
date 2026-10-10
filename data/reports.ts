// Los datos de cada informe, leídos del catálogo del día. El cálculo y los textos
// están en lib/reports.ts; aquí solo se decide qué se consulta.
import {
  coverageReport,
  methodology,
  seasonPairs,
  spreadReport,
  type CoverageReport,
  type Methodology,
  type SeasonPair,
  type SpreadReport,
} from "@/lib/reports";
import { compareSeasons, type SeasonComparison } from "@/lib/seasons";
import type { PalaShape } from "@/types/catalog";
import {
  countPalas,
  getBrandCoverage,
  getMultiStoreOffers,
  getPalaBySlug,
  getPriceSources,
  getSeasonGroups,
} from "./index";

export async function getMethodology(now: Date = new Date()): Promise<Methodology> {
  return methodology(await getPriceSources(), now);
}

export async function getSpreadReport(now: Date = new Date()): Promise<SpreadReport> {
  return spreadReport(await getMultiStoreOffers(), now);
}

export interface SeasonOpportunity extends SeasonPair {
  /** Qué cambia y qué se mantiene entre las dos ediciones; null si no se ha cargado el detalle */
  comparison: SeasonComparison | null;
}

/** Parejas de las que se carga la comparación de características: cada una son dos fichas completas */
const DETAILED_PAIRS = 8;

/**
 * Ediciones anteriores frente a la más reciente de su modelo, con precio vigente
 * en las dos. De las primeras se carga además qué características cambian.
 */
export async function getSeasonOpportunities(): Promise<{ pairs: SeasonOpportunity[]; cheaper: number }> {
  const pairs = seasonPairs(await getSeasonGroups());
  const detailed = pairs.slice(0, DETAILED_PAIRS);
  const full = await Promise.all(
    detailed.map(async (pair) => {
      const [newer, older] = await Promise.all([getPalaBySlug(pair.newer.slug), getPalaBySlug(pair.older.slug)]);
      return newer && older ? compareSeasons(newer, older) : null;
    }),
  );
  return {
    pairs: pairs.map((pair, i) => ({ ...pair, comparison: full[i] ?? null })),
    cheaper: pairs.filter((pair) => pair.difference < 0).length,
  };
}

export async function getCoverageReport(): Promise<CoverageReport> {
  return coverageReport(await getBrandCoverage());
}

export const BUDGET_TIERS = [100, 150, 200] as const;
const SHAPES: PalaShape[] = ["redonda", "lagrima", "diamante", "hibrida"];

export interface BudgetReport {
  /** Palas con precio vigente, sin tope */
  priced: number;
  tiers: { max: number; total: number; byShape: { shape: PalaShape; count: number }[] }[];
}

/** Cuántas palas con precio vigente hay por debajo de cada tope, en total y por forma. */
export async function getBudgetReport(): Promise<BudgetReport> {
  const [priced, tiers] = await Promise.all([
    countPalas({ coverage: ["con-precio"] }),
    Promise.all(
      BUDGET_TIERS.map(async (max) => ({
        max,
        total: await countPalas({ maxPrice: max }),
        byShape: await Promise.all(
          SHAPES.map(async (shape) => ({ shape, count: await countPalas({ maxPrice: max, shapes: [shape] }) })),
        ),
      })),
    ),
  ]);
  return { priced, tiers };
}
