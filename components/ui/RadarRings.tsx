import { cn } from "@/lib/cn";

interface RadarRingsProps {
  /** Tamaño y posición del radar */
  className?: string;
}

/** Radar de marca: círculos concéntricos + barrido. Solo en hero y escáner. */
export function RadarRings({ className }: RadarRingsProps) {
  return (
    <div aria-hidden="true" className={cn("overflow-hidden rounded-full", className)}>
      <svg viewBox="0 0 300 300" className="absolute inset-0 size-full">
        {[149, 107, 65].map((r) => (
          <circle key={r} cx="150" cy="150" r={r} fill="none" stroke="rgb(198 239 58 / 0.25)" />
        ))}
      </svg>
      <div className="radar-sweep absolute inset-0 animate-radar-sweep rounded-full" />
    </div>
  );
}
