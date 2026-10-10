import { cn } from "@/lib/cn";
import { formatEuro, formatEuroCompact } from "@/lib/format";
import { NEGLIGIBLE_SPREAD_EUROS, type StoreSpread } from "@/lib/store-spread";

interface StoreSpreadNoteProps {
  /** null: no hay dos tiendas con precio vigente; el bloque no aparece */
  spread: StoreSpread | null;
  /** line: una frase, para listados y comparador · box: recuadro con la cifra, para la ficha */
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
 * La frase del recuadro de la ficha. La cifra y el porcentaje ya van encima, en
 * grande: aquí solo se dice entre qué tiendas es y, si falta algún envío por
 * verificar, que al sumarlo el orden puede cambiar.
 */
export function spreadBoxSentence(spread: StoreSpread): string {
  if (spread.difference < NEGLIGIBLE_SPREAD_EUROS) return spreadSentence(spread);
  const where = `en ${spread.cheapest.store.name} que en ${spread.priciest.store.name}`;
  return spread.basis === "total"
    ? `Con el envío incluido, cuesta menos ${where}.`
    : `La pala cuesta menos ${where}. Falta sumar el envío de ${names(spread.unverifiedShipping)}, que no hemos verificado y puede cambiar el orden.`;
}

/**
 * Cuánto cambia hoy el precio de una pala de una tienda a otra (lib/store-spread.ts).
 * Solo existe con dos o más precios vigentes. Si falta algún envío por
 * verificar, se compara el precio de la pala y se dice: no se afirma cuál es el
 * coste final más bajo.
 */
export function StoreSpreadNote({ spread, variant = "box", className }: StoreSpreadNoteProps) {
  if (!spread) return null;

  if (variant === "line") {
    return (
      <p className={cn("text-sm leading-normal text-pretty text-ink", className)}>
        {spreadSentence(spread)}
        {spread.basis === "producto" && (
          <span className="text-muted"> Envío no verificado en {names(spread.unverifiedShipping)}.</span>
        )}
      </p>
    );
  }

  const meaningful = spread.difference >= NEGLIGIBLE_SPREAD_EUROS;

  return (
    <div className={cn("rounded-2xl bg-mist p-4", className)}>
      <h3 className="text-sm font-bold text-muted">Diferencia entre tiendas</h3>
      {meaningful && (
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-2xl leading-[1.1] font-black whitespace-nowrap tabular-nums">
            {formatEuroCompact(spread.difference)}
          </span>
          <span className="text-sm text-muted">{percentText(spread.percent)}</span>
        </p>
      )}
      <p className="mt-1 text-sm leading-normal text-pretty text-ink">{spreadBoxSentence(spread)}</p>
    </div>
  );
}
