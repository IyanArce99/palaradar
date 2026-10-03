"use client";

import { useEffect, useRef } from "react";

interface AutoSubmitProps {
  children: React.ReactNode;
}

/**
 * Mejora progresiva: envía el formulario que contiene en cuanto cambia un
 * filtro. Sin JavaScript, el formulario sigue funcionando con su botón.
 */
export function AutoSubmit({ children }: AutoSubmitProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = ref.current;
    if (!wrapper) return;

    // `change` nativo: en el deslizador de precio solo se dispara al soltarlo.
    const onChange = (event: Event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        event.target.form?.requestSubmit();
      }
    };

    wrapper.addEventListener("change", onChange);
    return () => wrapper.removeEventListener("change", onChange);
  }, []);

  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}
