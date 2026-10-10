import Link from "next/link";
import { catalogHref, type CatalogQuery } from "@/lib/catalog/query";
import { appliedCriteria, unappliedCriteria, type SearchIntent } from "@/lib/catalog/search-intent";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import type { PalaSummary } from "@/types/catalog";

interface SearchInterpretationProps {
  /** Lo que se escribió en el buscador */
  original: string;
  intent: SearchIntent;
  /** La consulta que se ha ejecutado, con los criterios ya aplicados */
  query: CatalogQuery;
  /** Lo elegido a mano, antes de sumarle la interpretación; sirve para decir por qué un criterio no rige */
  explicit?: CatalogQuery;
  /** La pala a la que apunta «alternativas a …», si la búsqueda la encuentra */
  reference: PalaSummary | null;
  /** Cuántas palas coinciden con el modelo de referencia */
  referenceMatches: number;
  className?: string;
}

/**
 * Lo que el buscador ha entendido de un texto libre: «He interpretado: hasta
 * 120 €, forma redonda». Los criterios pasan a ser filtros normales del
 * catálogo, así que se editan y se quitan como cualquier otro; desde aquí se
 * puede, además, deshacer la interpretación y buscar el texto tal cual.
 */
export function SearchInterpretation({
  original,
  intent,
  query,
  explicit,
  reference,
  referenceMatches,
  className,
}: SearchInterpretationProps) {
  if (intent.detected.length === 0 && intent.reference === null && intent.notes.length === 0) return null;

  // Solo se enseña como interpretado lo que rige de verdad: un filtro fijado a mano manda sobre lo deducido.
  const applied = appliedCriteria(intent, query);
  const unapplied = unappliedCriteria(intent, query, explicit ?? query);
  const byHand = unapplied.filter((item) => item.reason === "fijado-a-mano").map((item) => item.criterion.label);
  const noEffect = unapplied.filter((item) => item.reason === "sin-efecto").map((item) => item.criterion.label);
  const overridden = unapplied.length > 0;

  return (
    <div role="status" className={cn("rounded-[18px] bg-mist px-4 py-3.5 text-sm leading-[1.5]", className)}>
      {applied.length > 0 && (
        <>
          <p>
            <span className="font-extrabold">He interpretado «{original}» como: </span>
            {applied.map((criterion) => criterion.label).join(" · ")}
            {query.q !== "" && ` · texto «${query.q}»`}.
          </p>
          <p className="mt-1 text-[13px] text-muted">
            Son los filtros de abajo: puedes quitarlos o cambiarlos uno a uno.{" "}
            <Link href={catalogHref({ ...query, page: 1 })} className="font-bold text-carbon underline">
              Fijar estos filtros
            </Link>
          </p>
        </>
      )}
      {byHand.length > 0 && (
        <p className={cn("text-[13px] text-muted", applied.length > 0 && "mt-1")}>
          No aplicado, porque ya habías fijado ese filtro a mano: {byHand.join(" · ")}.
        </p>
      )}
      {noEffect.length > 0 && (
        <p className={cn("text-[13px] text-muted", (applied.length > 0 || byHand.length > 0) && "mt-1")}>
          No aplicado: {noEffect.join(" · ")} no deja fuera ninguna pala del catálogo.
        </p>
      )}

      {intent.reference !== null && (
        <p className={intent.detected.length > 0 || overridden ? "mt-2" : undefined}>
          {reference && referenceMatches === 1 ? (
            <>
              ¿Buscas alternativas a la {reference.brand.name} {reference.model}?{" "}
              <Link href={`${routes.pala(reference.slug)}#alternativas`} className="font-bold underline">
                Ver sus alternativas
              </Link>
            </>
          ) : (
            <>
              Para ver alternativas a una pala, abre su ficha: están en «¿Buscas algo parecido?».
              {referenceMatches > 1 && ` Hay ${referenceMatches} palas que coinciden con «${intent.reference}»; elige la tuya.`}
              {referenceMatches === 0 && ` No encontramos ninguna pala con «${intent.reference}».`}
            </>
          )}
        </p>
      )}

      {intent.notes.map((note) => (
        <p key={note} className="mt-1 text-[13px] text-muted">
          {note}
        </p>
      ))}
    </div>
  );
}
