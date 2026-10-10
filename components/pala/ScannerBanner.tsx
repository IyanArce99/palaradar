import { ButtonLink } from "@/components/ui/Button";
import { ScanIcon } from "@/components/ui/icons";
import { RadarRings } from "@/components/ui/RadarRings";
import { cn } from "@/lib/cn";
import { formatEuro, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";

interface ScannerBannerProps {
  /** full: bloque a todo el ancho de la portada · compact: tarjeta dentro de otra página */
  variant?: "full" | "compact";
  /** Pala que ilustra el resultado del escáner en la variante full (escritorio) */
  example?: { name: string; price: number; storeCount: number } | null;
  className?: string;
}

/**
 * Llamada al escáner IA, la herramienta diferencial de PalaRadar.
 *
 * NO se usa en ninguna página mientras el escáner no exista: enlaza a una función
 * que hoy solo dice «en preparación». Se conserva para cuando esté construido.
 */
export function ScannerBanner({ variant = "full", example, className }: ScannerBannerProps) {
  if (variant === "compact") {
    return (
      <aside className={cn("rounded-3xl bg-carbon p-5 text-white", className)}>
        <h2 className="text-lg font-black">¿La tienes delante?</h2>
        <p className="mt-1.5 text-sm leading-normal text-ash">
          Hazle una foto y la identificamos por ti.
        </p>
        <ButtonLink href={routes.scan} className="mt-3.5 w-full sm:w-auto">
          <ScanIcon size={20} />
          Escanear mi pala
        </ButtonLink>
      </aside>
    );
  }

  return (
    <section className={cn("relative overflow-hidden bg-carbon text-white", className)}>
      <div className="relative mx-auto max-w-[1280px] px-5 py-8 lg:grid lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-12 lg:py-[72px]">
        <RadarRings className="absolute -top-[120px] -right-[120px] size-[300px] opacity-60 lg:hidden" />
        <div className="relative">
          <p className="text-sm font-bold text-lime lg:text-sm">Escáner PalaRadar</p>
          <h2 className="mt-2 text-3xl leading-[1.1] font-black tracking-[-0.03em] lg:mt-2.5 lg:text-5xl lg:leading-none lg:tracking-[-0.04em]">
            ¿Tienes una pala delante y no sabes cuál es?
          </h2>
          <p className="mt-3 mb-[18px] max-w-[480px] text-base leading-normal text-ash lg:mt-5 lg:mb-[26px] lg:text-lg">
            Hazle una foto: te decimos qué pala es y dónde está más barata.{" "}
            <span className="lg:hidden">También puedes fotografiar dos y compararlas.</span>
            <span className="hidden lg:inline">O fotografía dos y compáralas.</span>
          </p>
          <div className="flex gap-2.5">
            <ButtonLink href={routes.scan} size="lg" className="w-full lg:w-auto">
              <ScanIcon />
              Escanear mi pala
            </ButtonLink>
            <ButtonLink href={routes.scan} size="lg" variant="inverse" className="max-lg:hidden">
              Escanear dos palas
            </ButtonLink>
          </div>
        </div>
        <div className="relative hidden h-[380px] place-items-center lg:grid">
          <RadarRings className="absolute size-[380px]" />
          <div
            aria-hidden="true"
            className="relative h-[270px] w-[180px] rounded-3xl border-[3px] border-lime bg-[repeating-linear-gradient(135deg,#1c1f1a_0_10px,#22261f_10px_20px)]"
          />
          {/* Resultado de ejemplo: una pala real del catálogo con su precio de hoy. */}
          {example && (
            <div className="absolute right-5 bottom-[30px] w-[250px] rounded-2xl bg-white px-4 py-3.5 text-carbon">
              <p className="text-sm font-extrabold text-forest">
                <span aria-hidden="true">✓ </span>Es una {example.name}
              </p>
              <p className="mt-1 text-sm">
                desde{" "}
                <strong className="text-xl whitespace-nowrap tabular-nums">
                  {formatEuro(example.price)}
                </strong>{" "}
                · {pluralize(example.storeCount, "tienda", "tiendas")}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
