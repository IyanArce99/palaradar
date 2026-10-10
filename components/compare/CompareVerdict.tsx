import { cn } from "@/lib/cn";
import { MAX_COMPARED, SLOT_IDS } from "@/lib/compare";
import type { Verdict } from "@/lib/compare-insights";
import type { Pala } from "@/types/catalog";
import { SlotBadge } from "./Badges";

export const resultTitleClass =
  "text-2xl leading-[1.1] font-black tracking-[-0.025em] text-balance lg:text-3xl";

interface CompareVerdictProps {
  palas: Pala[];
  verdict: Verdict;
}

/**
 * «¿Cuál elegir?»: una tarjeta por pala con lo que la distingue y una tarjeta
 * oscura de resumen. Todo sale de datos (lib/compare-insights.ts); si no hay
 * ninguna diferencia que contar, el bloque no aparece.
 */
export function CompareVerdict({ palas, verdict }: CompareVerdictProps) {
  if (verdict.advantages.every((lines) => lines.length === 0)) return null;
  const three = palas.length === MAX_COMPARED;

  return (
    <section aria-labelledby="cual-elegir">
      <h2 id="cual-elegir" className={cn(resultTitleClass, "lg:text-3xl")}>
        ¿Cuál elegir?
      </h2>
      <p className="mt-1.5 hidden text-base leading-normal text-pretty text-muted lg:block">
        Las diferencias entre ellas, en pocas líneas.
      </p>

      <div className="mt-4 grid gap-3 lg:mt-6 lg:grid-cols-3 lg:items-stretch lg:gap-4">
        {palas.map((pala, i) => (
          <article key={pala.id} className="rounded-3xl border border-line bg-white p-5">
            <header className="flex items-center gap-2.5">
              <SlotBadge slot={SLOT_IDS[i]} className="size-[30px] text-sm" />
              <div className="min-w-0">
                <p className="text-xs text-muted">{pala.brand.name}</p>
                <h3 className="text-lg leading-[1.1] font-black">{pala.model}</h3>
              </div>
            </header>
            {verdict.advantages[i].length > 0 ? (
              <ul className="mt-4 grid gap-2.5">
                {verdict.advantages[i].map((line) => (
                  <li key={line} className="grid grid-cols-[24px_1fr] items-start gap-2.5 text-base leading-normal">
                    <span
                      aria-hidden="true"
                      className="grid size-[22px] place-items-center rounded-full bg-lime text-xs font-black"
                    >
                      ✓
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-base leading-normal text-muted">
                Los datos no marcan ninguna ventaja clara frente a {three ? "las otras" : "la otra"}.
              </p>
            )}
          </article>
        ))}

        <aside
          aria-label="En resumen"
          className={cn("rounded-3xl bg-carbon px-6 py-[22px] text-white", three && "lg:col-span-3")}
        >
          <p className="font-mono text-xs leading-none font-bold tracking-[0.08em] text-lime">EN RESUMEN</p>
          {verdict.summary.length > 0 ? (
            <ul className="mt-3.5 grid gap-3">
              {verdict.summary.map(({ index, text }) => (
                <li
                  key={index}
                  className="grid grid-cols-[auto_1fr] items-center gap-3 text-base leading-snug lg:text-base"
                >
                  <SlotBadge slot={SLOT_IDS[index]} />
                  <span>
                    {text}{" "}
                    <span aria-hidden="true" className="text-lime">
                      →
                    </span>{" "}
                    <strong>{palas[index].model}</strong>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3.5 text-base leading-snug lg:text-base">
              Los datos no inclinan la balanza hacia ninguna: mira la ficha técnica y el precio.
            </p>
          )}
          <p className="mt-4 text-xs leading-normal text-[#9a9f95]">
            Basado solo en {verdict.source ? `las puntuaciones técnicas de ${verdict.source} y en ` : ""}las
            características declaradas y el precio de cada pala. No es una opinión de PalaRadar.
          </p>
        </aside>
      </div>
    </section>
  );
}
