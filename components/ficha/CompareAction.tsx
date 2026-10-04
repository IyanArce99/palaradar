import Link from "next/link";
import { cn } from "@/lib/cn";
import { compareSelectPath } from "@/lib/compare";

interface CompareActionProps {
  /** Pala desde la que se empieza la comparación */
  slug: string;
  className?: string;
}

/**
 * «Comparar» de la barra superior de la ficha (solo móvil en el diseño V3):
 * lleva al comparador con esta pala ya elegida.
 */
export function CompareAction({ slug, className }: CompareActionProps) {
  return (
    <Link
      href={compareSelectPath({ a: slug })}
      className={cn(
        "inline-flex h-11 items-center rounded-full border border-line px-3.5 text-[13px] font-bold",
        className,
      )}
    >
      Comparar
    </Link>
  );
}
