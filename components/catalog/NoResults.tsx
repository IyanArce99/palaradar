import Link from "next/link";
import { ScannerBanner } from "@/components/pala/ScannerBanner";
import { ButtonLink } from "@/components/ui/Button";
import { catalogHref } from "@/lib/catalog/query";
import { routes } from "@/lib/routes";

interface NoResultsProps {
  /** Texto buscado, si la búsqueda venía del buscador */
  searchTerm: string;
  popularSearches: string[];
}

/** Estado vacío del catálogo: búsqueda o filtros sin resultados. */
export function NoResults({ searchTerm, popularSearches }: NoResultsProps) {
  return (
    <div className="max-w-[560px]">
      <h2 className="text-2xl leading-[1.08] font-black tracking-[-0.025em] text-balance">
        {searchTerm ? `No encontramos «${searchTerm}»` : "Ninguna pala cumple esos filtros"}
      </h2>
      <p className="mt-2 text-[15px] leading-[1.6] text-pretty text-ink">
        {searchTerm
          ? "Puede que esté mal escrito o que todavía no la tengamos en el catálogo."
          : "Prueba a quitar algún filtro o a subir el precio máximo."}
      </p>

      <ButtonLink href={routes.catalog} variant="outline" className="mt-5">
        Ver todas las palas
      </ButtonLink>

      {popularSearches.length > 0 && (
        <>
          <h3 className="mt-7 mb-2.5 text-sm font-extrabold">Búsquedas populares</h3>
          <ul className="flex flex-wrap gap-1.5">
            {popularSearches.map((term) => (
              <li key={term}>
                <Link
                  href={catalogHref({ q: term })}
                  className="flex h-10 items-center rounded-full bg-mist px-3.5 text-sm font-semibold whitespace-nowrap hover:bg-line"
                >
                  {term}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <ScannerBanner variant="compact" className="mt-7" />
    </div>
  );
}
