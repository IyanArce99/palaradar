// Palas relacionadas con una ficha, calculadas con datos declarados: las
// «parecidas» (misma forma y, cuanto más mejor, mismo balance, estilo y nivel) y
// las otras temporadas del mismo modelo. No hay valoración detrás: solo se
// comparan atributos que las dos palas declaran.
import type { Pala, PalaBalance, PalaShape, PalaSummary, PlayerLevel, PlayStyle } from "@/types/catalog";

/** Atributos, además de la forma, en los que dos palas coinciden */
export type SharedTrait = "balance" | "style" | "level";

export interface SimilarPala {
  pala: PalaSummary;
  /** En qué coincide con la pala de la ficha, además de la forma */
  shared: SharedTrait[];
}

/** Lo que se necesita de la pala de la ficha para buscarle parecidas */
export interface SimilarityTarget {
  id: string;
  shape: PalaShape;
  balance: PalaBalance | null;
  levels: PlayerLevel[];
  playStyle: PlayStyle | null;
  /** Precio vigente, para preferir palas de precio cercano; null si no tiene */
  price: number | null;
}

export function similarityTarget(pala: Pala): SimilarityTarget {
  return {
    id: pala.id,
    shape: pala.shape,
    balance: pala.balance,
    levels: pala.levels,
    playStyle: pala.playStyle,
    price: pala.price && pala.price.freshness !== "stale" ? pala.price.current : null,
  };
}

/** En qué coincide una candidata con la pala de la ficha; un dato que falta en cualquiera de las dos no cuenta. */
export function sharedTraits(
  target: SimilarityTarget,
  candidate: { balance: PalaBalance | null; levels: PlayerLevel[]; playStyle: PlayStyle | null },
): SharedTrait[] {
  const shared: SharedTrait[] = [];
  if (target.balance !== null && candidate.balance === target.balance) shared.push("balance");
  if (target.playStyle !== null && candidate.playStyle === target.playStyle) shared.push("style");
  if (candidate.levels.some((level) => target.levels.includes(level))) shared.push("level");
  return shared;
}

const TRAIT_NAMES: Record<SharedTrait, string> = { balance: "balance", style: "estilo", level: "nivel" };

/** «Misma forma», «Misma forma y balance», «Misma forma, balance y estilo»… */
export function similarityReason(shared: SharedTrait[]): string {
  const names = ["forma", ...shared.map((trait) => TRAIT_NAMES[trait])];
  if (names.length === 1) return "Misma forma";
  return `Misma ${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

/**
 * Otras temporadas del mismo modelo: misma marca y mismo nombre de modelo, otro
 * año. De la más reciente a la más antigua.
 */
export function sameModelSeasons(
  pala: Pick<Pala, "slug" | "model" | "year"> & { brand: { slug: string } },
  candidates: PalaSummary[],
): PalaSummary[] {
  const model = pala.model.trim().toLowerCase();
  return candidates
    .filter(
      (other) =>
        other.slug !== pala.slug &&
        other.brand.slug === pala.brand.slug &&
        other.year !== pala.year &&
        other.model.trim().toLowerCase() === model,
    )
    .sort((a, b) => b.year - a.year);
}
