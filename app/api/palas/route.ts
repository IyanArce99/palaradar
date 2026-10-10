import { NextResponse, type NextRequest } from "next/server";
import { getPalaSummaries, searchCatalog } from "@/data";
import { DEFAULT_QUERY, PARAMS } from "@/lib/catalog/query";
import { toPalaSuggestion } from "@/lib/compare";
import { parseSlugList, SLUGS_PARAM } from "@/lib/favorites";
import type { PalaSuggestion } from "@/types/catalog";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;
const SUGGESTION_COUNT = 6;
const HEADERS = { "X-Robots-Tag": "noindex" };

/**
 * Datos públicos de palas en JSON, siempre desde el catálogo:
 *  · `?q=`     sugerencias del buscador (comparador): la misma búsqueda del
 *              catálogo, limitada a unas pocas palas;
 *  · `?slugs=` las palas indicadas con su precio de hoy (favoritas guardadas en
 *              el navegador). Las que no existen no se devuelven.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  if (params.has(SLUGS_PARAM)) {
    const slugs = parseSlugList(params.get(SLUGS_PARAM));
    const palas = await getPalaSummaries(slugs);
    return NextResponse.json<PalaSuggestion[]>(palas.map(toPalaSuggestion), { headers: HEADERS });
  }

  const q = (params.get(PARAMS.q) ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (q.length < MIN_QUERY_LENGTH) return NextResponse.json<PalaSuggestion[]>([]);

  const { items } = await searchCatalog({ ...DEFAULT_QUERY, q }, { pageSize: SUGGESTION_COUNT });
  return NextResponse.json(items.map(toPalaSuggestion), { headers: HEADERS });
}
