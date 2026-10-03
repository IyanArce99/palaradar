import { cn } from "@/lib/cn";

interface DisclosureMarkerProps {
  className?: string;
}

/** Indicador +/− de un <details>. El <details> debe llevar la clase `group`. */
export function DisclosureMarker({ className }: DisclosureMarkerProps) {
  return (
    <span aria-hidden="true" className={cn("text-lg", className)}>
      <span className="group-open:hidden">+</span>
      <span className="hidden group-open:inline">−</span>
    </span>
  );
}
