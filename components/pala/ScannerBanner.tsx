import { ButtonLink } from "@/components/ui/Button";
import { ScanIcon } from "@/components/ui/icons";
import { RadarRings } from "@/components/ui/RadarRings";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";

interface ScannerBannerProps {
  /** full: bloque a todo el ancho de la portada · compact: tarjeta dentro de otra página */
  variant?: "full" | "compact";
  className?: string;
}

/** Llamada al escáner IA, la herramienta diferencial de PalaRadar. */
export function ScannerBanner({ variant = "full", className }: ScannerBannerProps) {
  if (variant === "compact") {
    return (
      <aside className={cn("rounded-[20px] bg-carbon p-5 text-white", className)}>
        <h2 className="text-lg font-black">¿La tienes delante?</h2>
        <p className="mt-1.5 text-sm leading-[1.45] text-ash">
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
          <p className="text-[13px] font-bold text-lime lg:text-sm">Escáner PalaRadar</p>
          <h2 className="mt-2 text-[28px] leading-[1.05] font-black tracking-[-0.03em] lg:mt-2.5 lg:text-5xl lg:leading-none lg:tracking-[-0.04em]">
            ¿Tienes una pala delante y no sabes cuál es?
          </h2>
          <p className="mt-3 mb-[18px] max-w-[480px] text-[15px] leading-[1.55] text-ash lg:mt-[18px] lg:mb-[26px] lg:text-lg">
            Hazle una foto: te decimos qué pala es, qué opinan otros jugadores y dónde está más
            barata.
          </p>
          <ButtonLink href={routes.scan} size="lg" className="w-full lg:w-auto">
            <ScanIcon />
            Escanear mi pala
          </ButtonLink>
        </div>
        <div className="relative hidden h-[380px] place-items-center lg:grid">
          <RadarRings className="absolute size-[380px]" />
          <div
            aria-hidden="true"
            className="relative h-[270px] w-[180px] rounded-[20px] border-[3px] border-lime bg-[repeating-linear-gradient(135deg,#1c1f1a_0_10px,#22261f_10px_20px)]"
          />
        </div>
      </div>
    </section>
  );
}
