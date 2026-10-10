import { cn } from "@/lib/cn";

interface SectionTitleProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
}

/** Titular de sección de la ficha, formulado como la pregunta del lector. */
export function SectionTitle({ children, id, className }: SectionTitleProps) {
  return (
    <h2
      id={id}
      className={cn("text-2xl leading-[1.1] font-black tracking-[-0.025em] text-balance lg:text-3xl", className)}
    >
      {children}
    </h2>
  );
}
