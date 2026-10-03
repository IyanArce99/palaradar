import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { RadarRings } from "@/components/ui/RadarRings";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Escanear mi pala",
  description: "Hazle una foto a una pala de pádel y descubre qué modelo es y dónde está más barata.",
  path: routes.scan,
  index: false,
});

// Punto de entrada del escáner IA. El flujo (foto → identificación → ficha)
// se construirá aquí; hoy solo explica la función y deriva al buscador.
export default function ScanPage() {
  return (
    <section className="relative overflow-hidden bg-carbon text-white">
      <div className="relative mx-auto flex min-h-[70vh] max-w-[720px] flex-col items-center justify-center px-5 py-16 text-center">
        <RadarRings className="relative size-[220px] lg:size-[300px]" />
        <p className="mt-8 text-sm font-bold text-lime">Escáner PalaRadar · en preparación</p>
        <h1 className="mt-2 text-[32px] leading-none font-black tracking-[-0.035em] text-balance lg:text-5xl">
          Hazle una foto y te decimos qué pala es
        </h1>
        <p className="mt-4 max-w-[480px] text-base leading-[1.6] text-pretty text-ash">
          Estamos entrenando el escáner para reconocer el modelo y el año exactos. Mientras
          tanto, puedes buscar tu pala por nombre.
        </p>
        <ButtonLink href={`${routes.catalog}#buscar`} size="lg" className="mt-7">
          Buscarla por nombre
        </ButtonLink>
      </div>
    </section>
  );
}
