import type { Metadata } from "next";
import Form from "next/form";
import { PalaCard } from "@/components/pala/PalaCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { buttonClass } from "@/components/ui/Button";
import { EmptyNote } from "@/components/ui/EmptyNote";
import { PageHeading } from "@/components/ui/PageHeading";
import { recommendPalas } from "@/data";
import { formatEuroCompact } from "@/lib/format";
import { BALANCE_LABELS, LEVEL_LABELS, SHAPE_LABELS, STYLE_LABELS } from "@/lib/labels";
import {
  answeredCriteria,
  BUDGETS,
  CRITERION_LABELS,
  hasAnswers,
  parseRecommenderPrefs,
  RECOMMENDER_PARAMS,
  WEIGHT_BANDS,
} from "@/lib/recommender";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

const RESULT_COUNT = 3;

export const metadata: Metadata = pageMetadata({
  title: "Encuentra tu pala ideal",
  description:
    "Responde seis preguntas sobre cómo juegas y te recomendamos tres palas de pádel con su mejor precio.",
  path: routes.idealPala,
  index: false,
});

interface Option {
  value: string;
  label: string;
}

function toOptions<T extends string>(labels: Record<T, string>): Option[] {
  return Object.entries<string>(labels).map(([value, label]) => ({ value, label }));
}

interface QuestionProps {
  title: string;
  name: string;
  options: Option[];
  selected: string;
}

/** Una pregunta: opciones excluyentes, con «Me da igual» por defecto. */
function Question({ title, name, options, selected }: QuestionProps) {
  return (
    <fieldset className="border-t border-line py-5">
      <legend className="float-left mb-3 w-full text-[17px] font-extrabold">{title}</legend>
      <div className="clear-both flex flex-wrap gap-2">
        {[{ value: "", label: "Me da igual" }, ...options].map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={option.value === selected}
              className="peer sr-only"
            />
            <span className="inline-flex h-11 items-center rounded-full border border-line px-4 text-sm font-bold peer-checked:border-carbon peer-checked:bg-carbon peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-carbon">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface IdealPalaPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Primer recomendador: compara las respuestas con los datos declarados de cada
// pala (lib/recommender.ts). Es un formulario GET, así que el resultado es enlazable.
export default async function IdealPalaPage({ searchParams }: IdealPalaPageProps) {
  const prefs = parseRecommenderPrefs(await searchParams);
  const answered = hasAnswers(prefs);
  const results = answered ? await recommendPalas(prefs, RESULT_COUNT) : [];
  const criteriaCount = answeredCriteria(prefs).length;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Pala ideal", href: routes.idealPala },
        ]}
      />
      <div className="mx-auto max-w-[1280px] pb-10 lg:pb-[72px]">
        <PageHeading
          title="Encuentra tu pala ideal"
          lead="Seis preguntas sobre cómo juegas. Con tus respuestas te recomendamos tres palas que están a la venta ahora, con su mejor precio."
        />

        {answered && (
          <section aria-labelledby="resultado" className="px-5 pt-8 lg:px-12 lg:pt-10">
            <h2
              id="resultado"
              className="text-2xl leading-[1.08] font-black tracking-[-0.025em] lg:text-[34px]"
            >
              Tus tres palas
            </h2>
            {results.length === 0 ? (
              <EmptyNote className="mt-4">
                Ahora mismo no hay ninguna pala a la venta dentro de ese presupuesto. Prueba a
                subirlo o a quitar el límite.
              </EmptyNote>
            ) : (
              <>
                <p className="mt-1.5 text-sm leading-[1.45] text-pretty text-muted lg:mt-2 lg:text-[15px]">
                  Ordenadas por cuántas de tus respuestas cumplen, según los datos que declara cada
                  pala. A igualdad, primero las que venden más tiendas.
                </p>
                <ul className="mt-4 grid grid-cols-2 gap-x-3.5 gap-y-6 lg:mt-6 lg:grid-cols-3 lg:gap-6">
                  {results.map(({ pala, matched }) => (
                    <li key={pala.id}>
                      <PalaCard pala={pala} />
                      {criteriaCount > 0 && (
                        <p className="mt-2 text-[13px] leading-[1.4] text-ink">
                          <strong>
                            Cumple {matched.length} de {criteriaCount}
                          </strong>
                          {matched.length > 0 &&
                            `: ${matched.map((criterion) => CRITERION_LABELS[criterion].toLowerCase()).join(", ")}`}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        <Form
          action={routes.idealPala}
          aria-label="Preguntas para recomendarte una pala"
          className="max-w-[760px] px-5 pt-8 lg:px-12 lg:pt-10"
        >
          {answered && <h2 className="mb-4 text-xl font-black">Cambia tus respuestas</h2>}
          <Question
            title="1. ¿Qué nivel tienes?"
            name={RECOMMENDER_PARAMS.level}
            options={toOptions(LEVEL_LABELS)}
            selected={prefs.level ?? ""}
          />
          <Question
            title="2. ¿Qué buscas en tu juego?"
            name={RECOMMENDER_PARAMS.style}
            options={toOptions(STYLE_LABELS)}
            selected={prefs.style ?? ""}
          />
          <Question
            title="3. ¿Qué forma prefieres?"
            name={RECOMMENDER_PARAMS.shape}
            options={toOptions(SHAPE_LABELS)}
            selected={prefs.shape ?? ""}
          />
          <Question
            title="4. ¿Qué balance prefieres?"
            name={RECOMMENDER_PARAMS.balance}
            options={toOptions(BALANCE_LABELS)}
            selected={prefs.balance ?? ""}
          />
          <Question
            title="5. ¿Qué peso te va mejor?"
            name={RECOMMENDER_PARAMS.weight}
            options={Object.entries(WEIGHT_BANDS).map(([value, band]) => ({
              value,
              label: band.label,
            }))}
            selected={prefs.weight ?? ""}
          />
          <Question
            title="6. ¿Cuánto quieres gastar como máximo?"
            name={RECOMMENDER_PARAMS.maxPrice}
            options={BUDGETS.map((budget) => ({
              value: String(budget),
              label: `Hasta ${formatEuroCompact(budget)}`,
            }))}
            selected={prefs.maxPrice === null ? "" : String(prefs.maxPrice)}
          />
          <div className="border-t border-line pt-5">
            <button type="submit" className={buttonClass({ variant: "dark", size: "lg" })}>
              Ver mis tres palas
            </button>
          </div>
        </Form>
      </div>
    </>
  );
}
