"use client";

import { routes } from "@/lib/routes";

interface FinderErrorProps {
  reset: () => void;
}

// No se han podido cargar los resultados. Las respuestas siguen en la URL, así
// que «Intentar de nuevo» repite la misma búsqueda.
export default function FinderError({ reset }: FinderErrorProps) {
  return (
    <div
      data-finder="error"
      className="mx-auto flex min-h-[100svh] w-full max-w-[520px] flex-col justify-center px-6 py-8 lg:min-h-[calc(100svh-77px)]"
    >
      <div aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-mist text-[28px] font-black">
        !
      </div>
      <h1 className="mt-[22px] text-[28px] leading-[1.05] font-black tracking-[-0.03em]">Algo ha fallado</h1>
      <p className="mt-3 text-base leading-[1.55] text-pretty text-ink">
        No hemos podido cargar tus resultados. No te preocupes: tus respuestas siguen guardadas.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 flex h-14 items-center justify-center rounded-[28px] bg-lime text-base font-extrabold"
      >
        Intentar de nuevo
      </button>
      {/* Enlace normal: recarga la página y deja el quiz en su entrada. */}
      <a href={routes.idealPala} className="mt-4 flex min-h-11 items-center justify-center text-sm font-bold underline">
        Volver a empezar
      </a>
    </div>
  );
}
