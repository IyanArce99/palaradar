// Las guías resueltas con los datos del día: qué pala sale en cada apartado y
// qué foto ilustra cada guía. El texto vive en content/guides.ts.
import { guides, type GuideDoc, type GuidePick } from "@/content/guides";
import { isProductPhoto } from "@/lib/media";
import type { Pala } from "@/types/catalog";
import { getPalaBySlug, getTopPalas, getTopRatedPalas } from "./index";

/** Candidatas que se piden por apartado: las suficientes para no repetir pala entre apartados */
const CANDIDATES = 6;

export interface ResolvedPick {
  pick: GuidePick;
  pala: Pala;
  /** Puntuación técnica total en la fuente externa; null si el origen de datos no tiene puntuaciones */
  score: number | null;
}

/**
 * La pala de cada apartado de una guía: la mejor puntuada que cumple su filtro,
 * tiene precio hoy y no ha salido ya en un apartado anterior. Un apartado sin
 * ninguna pala que lo cumpla no se devuelve.
 */
export async function resolveGuidePicks(guide: GuideDoc): Promise<ResolvedPick[]> {
  const candidates = await Promise.all(guide.picks.map((pick) => getTopRatedPalas(pick.query, CANDIDATES)));

  const used = new Set<string>();
  const chosen = guide.picks.flatMap((pick, i) => {
    const candidate = candidates[i].find(({ pala }) => !used.has(pala.slug));
    if (!candidate) return [];
    used.add(candidate.pala.slug);
    return [{ pick, slug: candidate.pala.slug, score: candidate.score }];
  });

  const palas = await Promise.all(chosen.map(({ slug }) => getPalaBySlug(slug)));
  return chosen.flatMap(({ pick, score }, i) => {
    const pala = palas[i];
    return pala ? [{ pick, pala, score }] : [];
  });
}

export interface GuideCover {
  guide: GuideDoc;
  /** Foto real de una pala de la guía; null si no hay ninguna */
  image: string | null;
}

/** Las guías con la foto que las ilustra: la de la pala de su primer apartado o, si no tiene, una del catálogo. */
export async function getGuideCovers(): Promise<GuideCover[]> {
  const [firsts, top] = await Promise.all([
    Promise.all(guides.map((guide) => (guide.picks[0] ? getTopRatedPalas(guide.picks[0].query, CANDIDATES) : []))),
    getTopPalas(guides.length * 3),
  ]);
  const spare = top.flatMap((pala) => (pala.image && isProductPhoto(pala.image) ? [pala.image] : []));

  // Cada guía con una foto distinta: la de su primera candidata que no ilustre ya otra guía.
  const used = new Set<string>();
  return guides.map((guide, i) => {
    const own = firsts[i].flatMap(({ pala }) => (pala.image ? [pala.image] : []));
    const image = [...own, ...spare].find((candidate) => !used.has(candidate)) ?? own[0] ?? null;
    if (image) used.add(image);
    return { guide, image };
  });
}
