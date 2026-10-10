import { ButtonLink } from "@/components/ui/Button";
import { routes } from "@/lib/routes";

interface ComingSoonProps {
  children: React.ReactNode;
}

/** Bloque para secciones cuya funcionalidad llega en una fase posterior. */
export function ComingSoon({ children }: ComingSoonProps) {
  return (
    <div className="max-w-[560px] rounded-3xl bg-mist p-5 lg:p-7">
      <p className="text-sm font-bold text-muted">En preparación</p>
      <p className="mt-2 text-base leading-normal text-pretty text-ink">{children}</p>
      <ButtonLink href={routes.catalog} variant="dark" className="mt-5">
        Explorar palas
      </ButtonLink>
    </div>
  );
}
