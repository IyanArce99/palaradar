import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { cn } from "@/lib/cn";
import { breadcrumbJsonLd } from "@/lib/seo";

export interface Crumb {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  /** Ruta completa desde el inicio; el último elemento es la página actual */
  items: Crumb[];
  /** Destino del enlace de vuelta en móvil; por defecto, el nivel anterior */
  mobileBack?: Crumb;
  /** Acciones de la página (p. ej. «Comparar»), a la derecha de la barra */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Migas de pan y su JSON-LD, a partir de una sola lista. En escritorio muestra
 * la ruta completa; en móvil, solo el enlace de vuelta (‹ Palas), como en el diseño.
 */
export function Breadcrumbs({ items, mobileBack, actions, className }: BreadcrumbsProps) {
  const parent = mobileBack ?? items.at(-2);

  return (
    <div
      className={cn(
        "mx-auto flex max-w-[1280px] items-center justify-between px-3 py-2 lg:px-12 lg:pt-5 lg:pb-0",
        className,
      )}
    >
      <nav aria-label="Migas de pan">
        <JsonLd data={breadcrumbJsonLd(items)} />
        {parent && (
          <Link
            href={parent.href}
            className="inline-flex h-11 items-center px-2 text-[15px] font-bold lg:hidden"
          >
            <span aria-hidden="true">‹&nbsp;</span>
            {parent.label}
          </Link>
        )}
        <ol className="hidden flex-wrap gap-x-1.5 text-[13px] text-muted lg:flex">
          {items.map((item, i) => (
            <li key={item.href} className="flex gap-x-1.5">
              {i > 0 && <span aria-hidden="true">›</span>}
              {i < items.length - 1 ? (
                <Link href={item.href} className="hover:text-carbon hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page">{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {actions && <div className="flex gap-1.5">{actions}</div>}
    </div>
  );
}
