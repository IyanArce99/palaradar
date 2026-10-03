import { ButtonLink } from "@/components/ui/Button";
import { routes } from "@/lib/routes";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-16 lg:px-12 lg:py-24">
      <h1 className="text-[32px] leading-none font-black tracking-[-0.035em] text-balance lg:text-[52px]">
        No encontramos esta página
      </h1>
      <p className="mt-3 max-w-[520px] text-base leading-[1.6] text-pretty text-ink">
        Puede que el enlace esté mal escrito o que la pala ya no esté en el catálogo.
      </p>
      <div className="mt-6 flex flex-wrap gap-2.5">
        <ButtonLink href={routes.catalog} variant="dark">
          Ver todas las palas
        </ButtonLink>
        <ButtonLink href={routes.home} variant="outline">
          Ir al inicio
        </ButtonLink>
      </div>
    </div>
  );
}
