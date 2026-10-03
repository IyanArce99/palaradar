import Link from "next/link";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import type { Brand } from "@/types/catalog";

interface BrandLinksProps {
  /** id del titular, para etiquetar la navegación */
  id: string;
  title: string;
  brands: Brand[];
  /** Añade un acceso final a todo el catálogo */
  withCatalogLink?: boolean;
  className?: string;
}

const pillClass = "flex h-11 items-center rounded-full px-4 text-sm font-bold lg:h-10";

/** Enlaces a las páginas de marca (/palas-padel/[marca]/). */
export function BrandLinks({ id, title, brands, withCatalogLink = false, className }: BrandLinksProps) {
  if (brands.length === 0) return null;

  return (
    <nav aria-labelledby={id} className={className}>
      <h2 id={id} className="mb-3 text-[15px] font-extrabold">
        {title}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {brands.map((brand) => (
          <li key={brand.id}>
            <Link
              href={routes.brand(brand.slug)}
              className={cn(pillClass, "border border-line hover:bg-mist")}
            >
              {brand.name}
            </Link>
          </li>
        ))}
        {withCatalogLink && (
          <li>
            <Link href={routes.catalog} className={cn(pillClass, "bg-carbon text-white")}>
              Todas las palas
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
