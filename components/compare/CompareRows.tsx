import { cn } from "@/lib/cn";
import type { CompareRow } from "@/lib/compare";

interface ValueProps {
  /** Modelo al que pertenece el valor, para lectores de pantalla */
  model: string;
  value: string | null;
  className?: string;
}

function Value({ model, value, className }: ValueProps) {
  return (
    <p className={cn("text-base", value ? "font-extrabold" : "text-muted", className)}>
      <span className="sr-only">{model}: </span>
      {value ?? "Sin datos"}
    </p>
  );
}

/** Atributos declarados de las dos palas, fila a fila. Sin puntuaciones. */
export function CompareRows({ rows, models }: { rows: CompareRow[]; models: [string, string] }) {
  return (
    <div>
      {rows.map((row) => (
        <div key={row.label} className="border-t border-line py-3.5">
          <h3 className="text-center text-[13px] font-normal text-muted">{row.label}</h3>
          <div className="mt-1 grid grid-cols-2 gap-3">
            <Value model={models[0]} value={row.a} />
            <Value model={models[1]} value={row.b} className="text-right" />
          </div>
        </div>
      ))}
    </div>
  );
}
