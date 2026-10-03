import { cn } from "@/lib/cn";

interface CheckListProps {
  title: string;
  items: string[];
  tone: "positive" | "negative";
  className?: string;
}

/** Lista de puntos a favor (✓) o en contra (×) con su título. */
export function CheckList({ title, items, tone, className }: CheckListProps) {
  if (items.length === 0) return null;

  return (
    <div className={className}>
      <h3 className="mb-2.5 text-sm font-extrabold">{title}</h3>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li
            key={item}
            className="grid grid-cols-[24px_1fr] items-start gap-2.5 text-[15px] leading-[1.45]"
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-[22px] place-items-center rounded-full font-black",
                tone === "positive"
                  ? "bg-lime text-xs"
                  : "bg-line-soft text-[13px] text-muted",
              )}
            >
              {tone === "positive" ? "✓" : "×"}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
