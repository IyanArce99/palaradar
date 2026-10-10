import { cn } from "@/lib/cn";

interface EmptyNoteProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Estado vacío de un bloque del diseño: el bloque se mantiene y dice con
 * claridad que todavía no hay contenido. Nunca se rellena con datos inventados.
 */
export function EmptyNote({ children, className }: EmptyNoteProps) {
  return (
    <p className={cn("rounded-3xl bg-mist p-5 text-base leading-normal text-pretty text-ink", className)}>
      {children}
    </p>
  );
}
