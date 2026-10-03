import { buttonClass } from "@/components/ui/Button";
import { formatEuro, pluralize } from "@/lib/format";
import type { PriceSummary } from "@/types/pricing";

interface StickyPriceBarProps {
  price: PriceSummary;
  storesHref: string;
}

/** Barra inferior de la ficha en móvil: el precio siempre a mano. */
export function StickyPriceBar({ price, storesHref }: StickyPriceBarProps) {
  return (
    <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t border-line bg-white px-4 pt-2.5 pb-[calc(16px+env(safe-area-inset-bottom))] lg:hidden">
      <div>
        <p className="text-xs text-muted">
          Mejor precio · {pluralize(price.storeCount, "tienda", "tiendas")}
        </p>
        <p className="text-[22px] font-black whitespace-nowrap tabular-nums">
          {formatEuro(price.current)}
        </p>
      </div>
      <a href={storesHref} className={buttonClass({})}>
        Ver precios
      </a>
    </div>
  );
}
