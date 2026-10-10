import Link from "next/link";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { cn } from "@/lib/cn";
import type { CardPala, ComparisonCard } from "@/lib/compare-insights";
import { VsBadge } from "./Badges";

/** Miniatura de una pala en una tarjeta de comparación: su foto real sobre blanco. */
function Thumb({ pala, className }: { pala: CardPala; className: string }) {
  return (
    <PalaPhoto
      src={pala.image}
      alt=""
      sizes="64px"
      className={cn("flex-none rounded-2xl border-2 border-white !bg-white", className)}
    />
  );
}

/** Dos miniaturas con la insignia «VS» en medio. */
export function PairThumbs({ a, b, size }: { a: CardPala; b: CardPala; size: "card" | "row" }) {
  const thumb = size === "card" ? "h-[77px] w-16" : "h-[41px] w-[34px]";

  return (
    <span className="flex flex-none items-center">
      <Thumb pala={a} className={thumb} />
      <VsBadge className="-mx-2.5 size-7 text-xs shadow-[0_0_0_3px_#fff]" />
      <Thumb pala={b} className={thumb} />
    </span>
  );
}

function Card({ card }: { card: ComparisonCard }) {
  const { a, b } = card;

  return (
    <Link
      href={card.href}
      className="group flex h-full flex-col gap-3.5 rounded-3xl border border-line bg-white p-4 hover:border-carbon"
    >
      <span className="flex justify-center rounded-2xl bg-mist py-1.5">
        <PairThumbs a={a} b={b} size="card" />
      </span>
      <span className="block">
        <span className="block text-base leading-snug font-extrabold">
          {a.brand} {a.model}
        </span>
        <span className="block text-base leading-snug font-extrabold">
          <span className="mr-1 font-mono text-xs font-bold text-muted">VS</span>
          {b.brand} {b.model}
        </span>
        <span className="mt-1.5 block text-sm text-muted">{card.meta}</span>
      </span>
      <span className="mt-auto flex items-center justify-between text-sm font-extrabold">
        Comparar
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-full bg-lime group-hover:bg-[#bde52f]"
        >
          →
        </span>
      </span>
    </Link>
  );
}

interface ComparisonCardsProps {
  cards: ComparisonCard[];
  className?: string;
}

/**
 * Tarjetas de comparaciones: carrusel con ajuste en móvil y cuadrícula de tres
 * columnas en escritorio. Cada tarjeta enlaza a su comparación.
 */
export function ComparisonCards({ cards, className }: ComparisonCardsProps) {
  return (
    <ul
      className={cn(
        "scrollbar-none -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0",
        className,
      )}
    >
      {cards.map((card) => (
        <li key={card.href} className="w-60 flex-none snap-start lg:w-auto">
          <Card card={card} />
        </li>
      ))}
    </ul>
  );
}
