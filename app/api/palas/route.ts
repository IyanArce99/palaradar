import { NextResponse, type NextRequest } from "next/server";
import { searchCatalog } from "@/data";
import { DEFAULT_QUERY, PARAMS } from "@/lib/catalog/query";
import type { PalaSuggestion } from "@/types/catalog";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;
const SUGGESTION_COUNT = 6;

/**
 * Sugerencias del buscador de palas (comparador). Es la misma búsqueda del
 * catálogo, limitada a unas pocas palas; no es una fuente de datos aparte.
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get(PARAMS.q) ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (q.length < MIN_QUERY_LENGTH) return NextResponse.json<PalaSuggestion[]>([]);

  const { items } = await searchCatalog({ ...DEFAULT_QUERY, q }, { pageSize: SUGGESTION_COUNT });
  const suggestions: PalaSuggestion[] = items.map((pala) => ({
    slug: pala.slug,
    brand: pala.brand.name,
    model: pala.model,
    year: pala.year,
    image: pala.image,
  }));

  return NextResponse.json(suggestions, { headers: { "X-Robots-Tag": "noindex" } });
}
