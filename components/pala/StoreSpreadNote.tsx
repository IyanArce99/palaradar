import { cn } from "@/lib/cn";
import { formatEuro, formatEuroCompact, formatTimeAgo } from "@/lib/format";
import { NEGLIGIBLE_SPREAD_EUROS, type StoreSpread } from "@/lib/store-spread";

interface StoreSpreadNoteProps {
  /** null: no hay dos tiendas con precio vigente; el bloque no aparece */
  spread: StoreSpread | null;
  /** Fecha respecto a la que se dice la antigüedad de los precios (ISO con hora) */
  asOf: string;
  /** line: una frase, para listados y comparador · box: recuadro con el detalle, para la ficha */
  variant?: "line" | "box";
  className?: string;
}

const percentText = (value: number) => `${String(value).replace(".", ",")} %`;

function names(stores: { name: string }[]): string {
  const list = stores.map((store) => store.name);
  return list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} y ${list.at(-1)}`;
}

/** La diferencia entre tiendas en una frase, con su base (precio de la pala o total con envío). */
export function spreadSentence(spread: StoreSpread): string {
  if (spread.difference < NEGLIGIBLE_SPREAD_EUROS) {
    return `Las ${spread.stores} tiendas piden prácticamente lo mismo por esta pala.`;
  }
  const saving = `${formatEuro(spread.difference)} (${percentText(spread.percent)})`;
  return spread.basis === "total"
    ? `En ${spread.cheapest.store.name} cuesta ${saving} menos que en ${spread.priciest.store.name}, con el envío incluido.`
    : `El precio de la pala es ${saving} más bajo en ${spread.cheapest.store.name} que en ${spread.priciest.store.name}.`;
}

/**
 * Cuánto cambia hoy el precio de una pala de una tienda a otra (lib/store-spread.ts).
 * Solo existe con dos o más precios vigentes. Si falta algún envío por
 * verificar, se compara el precio de la pala y se dice: no se afirma cuál es el
 * coste final más bajo.
 */
export function StoreSpreadNote({ spread, asOf, variant = "box", className }: StoreSpreadNoteProps) {
  if (!spread) return null;

  const caveat =
    spread.basis === "producto"
      ? `No incluye el envío de ${names(spread.unverifiedShipping)}, que no hemos verificado: el coste final puede ser otro.`
      : null;
  const checked = `Precios comprobados ${formatTimeAgo(spread.oldestCheck, asOf)} o después.`;

  if (variant === "line") {
    return (
      <p className={cn("text-[13px] leading-[1.45] text-pretty text-ink", className)}>
        {spreadSentence(spread)}
        {caveat && <span className="text-muted"> Envío no verificado en {names(spread.unverifiedShipping)}.</span>}
      </p>
    );
  }

  const meaningful = spread.difference >= NEGLIGIBLE_SPREAD_EUROS;

  return (
    <div className={cn("rounded-[18px] border border-line p-4", className)}>
      <h3 className="text-[15px] font-extrabold">Diferencia entre tiendas</h3>
      {meaningful && (
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-[28px] leading-none font-medium tabular-nums">{formatEuroCompact(spread.difference)}</span>
          <span className="text-sm text-muted">
            entre {spread.stores} tiendas · {percentText(spread.percent)} sobre el precio más alto
          </span>
        </p>
      )}
      <p className="mt-2 text-sm leading-[1.5] text-pretty text-ink">{spreadSentence(spread)}</p>
      {caveat && <p className="mt-1 text-[13px] leading-[1.45] text-pretty text-ink">{caveat}</p>}
      <p className="mt-1.5 text-xs text-muted">{checked}</p>
    </div>
  );
}
