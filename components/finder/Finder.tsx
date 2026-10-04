"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { isProductPhoto } from "@/lib/media";
import {
  FINDER_QUESTIONS,
  finderPath,
  NO_ANSWERS,
  type FinderAnswers,
} from "@/lib/recommender";
import { routes } from "@/lib/routes";
import { FinderIcon } from "./FinderIcon";

// Tiempos del diseño (ms): la respuesta se marca, la pregunta sale y entra la siguiente.
const FADE_AT = 260;
const NEXT_AT = 440;
const STEP_EVERY = 650;
/** Lo mínimo que se ve la pantalla de búsqueda, aunque la respuesta llegue antes */
const MIN_LOADING = 2300;

const EYEBROW = "font-mono text-[11px] leading-none font-bold tracking-[0.08em] text-muted";
const RING = "absolute rounded-full border border-[#dfe2da]";

export interface FinderShowcase {
  name: string;
  image: string;
}

interface FinderActions {
  /** Vuelve a la primera pregunta conservando las respuestas */
  edit: () => void;
  /** Vuelve a la entrada y borra las respuestas */
  restart: () => void;
  /** Cambia respuestas concretas y vuelve a buscar */
  recalculate: (patch: Record<number, number>) => void;
}

const FinderContext = createContext<FinderActions | null>(null);

interface FinderActionProps {
  action: "edit" | "restart" | "recalculate";
  /** Para `recalculate`: posición de la pregunta → opción nueva */
  patch?: Record<number, number>;
  className?: string;
  children: ReactNode;
}

/** Botón de la pantalla de resultados que actúa sobre el quiz (rehacer, cambiar, relajar una respuesta). */
export function FinderAction({ action, patch, className, children }: FinderActionProps) {
  const actions = useContext(FinderContext);
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (action === "recalculate") actions?.recalculate(patch ?? {});
        else actions?.[action]();
      }}
    >
      {children}
    </button>
  );
}

function Sweep({ seconds, alpha }: { seconds: number; alpha: number }) {
  return (
    <div
      className="absolute inset-0 rounded-full"
      style={{
        background: `conic-gradient(from 0deg, rgb(198 239 58 / 0) 0deg, rgb(198 239 58 / 0) 290deg, rgb(198 239 58 / ${alpha}) 360deg)`,
        animation: `radar-sweep ${seconds}s linear infinite`,
      }}
    />
  );
}

function RacketImage({ src, sizes, className }: { src: string; sizes: string; className?: string }) {
  return (
    // El fundido va en el contenedor: si está girado, forma su propio contexto y
    // la imagen de dentro ya no se mezclaría con el fondo.
    <div className={cn("relative", isProductPhoto(src) && "mix-blend-multiply", className)}>
      <Image src={src} alt="" fill sizes={sizes} className="object-contain" />
    </div>
  );
}

interface IntroProps {
  showcase: FinderShowcase[];
  onStart: () => void;
}

function Intro({ showcase, onStart }: IntroProps) {
  const [left, center, right] = [showcase[1], showcase[0], showcase[2]];

  return (
    <div className="grid flex-1 lg:grid-cols-[1fr_1.05fr]">
      <div className="relative -order-1 flex min-h-[470px] items-center justify-center overflow-hidden rounded-b-[32px] bg-mist lg:order-2 lg:min-h-0 lg:rounded-none">
        <div aria-hidden="true" className="absolute size-[440px] overflow-hidden rounded-full opacity-90 lg:size-[640px]">
          <div className={cn(RING, "inset-0")} />
          <div className={cn(RING, "inset-[18%]")} />
          <div className={cn(RING, "inset-[36%]")} />
          <Sweep seconds={7} alpha={0.35} />
        </div>
        {/* Las fotos son cuadradas y la pala ocupa su centro: se solapan para que
            el abanico quede tan junto como en el diseño. */}
        <div aria-hidden="true" className="relative flex items-end">
          {left && (
            <RacketImage
              src={left.image}
              sizes="(min-width: 1024px) 260px, 180px"
              className="-mr-11 size-[130px] translate-y-2.5 -rotate-12 lg:-mr-14 lg:size-[210px]"
            />
          )}
          {center && (
            <RacketImage
              src={center.image}
              sizes="(min-width: 1024px) 360px, 250px"
              className="z-10 size-[200px] lg:size-[310px]"
            />
          )}
          {right && (
            <RacketImage
              src={right.image}
              sizes="(min-width: 1024px) 260px, 180px"
              className="-ml-11 size-[130px] translate-y-2.5 rotate-12 lg:-ml-14 lg:size-[210px]"
            />
          )}
        </div>
        {center && (
          <div className="absolute bottom-[22px] left-5 flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_10px_30px_rgb(21_23_26/0.12)] lg:bottom-16 lg:left-12">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-lime shadow-[0_0_0_4px_#eefbc9]" />
            <div>
              <p className="text-[13px] font-extrabold whitespace-nowrap">{center.name}</p>
              <p className="text-xs whitespace-nowrap text-muted">Encaja con tu juego · ejemplo</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center px-6 pt-6 pb-[22px] lg:px-[72px] lg:py-14">
        <p className={EYEBROW}>PALA IDEAL</p>
        <h1 className="mt-3 text-[44px] leading-[0.98] font-black tracking-[-0.04em] text-balance lg:text-[76px]">
          Encuentra tu pala ideal
        </h1>
        <p className="mt-3.5 max-w-[440px] text-[17px] leading-normal text-pretty text-ink lg:text-xl">
          Responde unas preguntas y descubre las palas que mejor encajan contigo.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="mt-[26px] flex h-[60px] items-center justify-center gap-2.5 rounded-[30px] bg-lime text-[17px] font-extrabold shadow-[0_2px_0_#9fc21f] transition-transform duration-[120ms] hover:-translate-y-px active:scale-[0.98] lg:max-w-[360px]"
        >
          Encontrar mi pala
          <span aria-hidden="true" className="text-xl">
            →
          </span>
        </button>
        <p className="mt-3.5 text-[13px] leading-normal text-balance text-muted">
          Solo te llevará 30 segundos · {FINDER_QUESTIONS.length} preguntas · Sin registro
        </p>
      </div>
    </div>
  );
}

interface QuestionProps {
  index: number;
  selected: number | null;
  fading: boolean;
  racket: FinderShowcase | undefined;
  onPick: (option: number) => void;
  onBack: () => void;
}

function Question({ index, selected, fading, racket, onPick, onBack }: QuestionProps) {
  const question = FINDER_QUESTIONS[index];
  const total = FINDER_QUESTIONS.length;

  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_480px]">
      <div className="mx-auto flex w-full max-w-[600px] flex-col px-5 pt-3.5 pb-2.5 lg:max-w-none lg:px-16 lg:py-8">
        <div className="flex h-12 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={index === 0 ? "Volver al inicio" : "Pregunta anterior"}
            className="grid size-11 flex-none place-items-center rounded-full bg-mist text-xl font-bold hover:bg-line-soft"
          >
            <span aria-hidden="true">←</span>
          </button>
          <div aria-hidden="true" className="grid flex-1 grid-cols-6 gap-1">
            {FINDER_QUESTIONS.map((item, i) => (
              <div
                key={item.id}
                className={cn(
                  "h-1.5 rounded-[3px] transition-colors duration-[250ms]",
                  i < index || (i === index && selected !== null)
                    ? "bg-carbon"
                    : i === index
                      ? "bg-[#9a9f95]"
                      : "bg-line",
                )}
              />
            ))}
          </div>
          <span className="flex-none font-mono text-xs font-bold whitespace-nowrap text-muted">
            <span className="sr-only">Pregunta </span>
            {index + 1} de {total}
          </span>
        </div>

        <div
          className={cn(
            "flex flex-1 flex-col pt-7 transition-[opacity,transform] duration-[180ms] ease-[ease] lg:pt-12",
            fading ? "-translate-x-6 opacity-0" : "opacity-100",
          )}
        >
          <p className={EYEBROW}>{question.eyebrow}</p>
          <h1 className="mt-2.5 text-[32px] leading-[1.02] font-black tracking-[-0.035em] text-balance lg:text-5xl">
            {question.title}
          </h1>
          <p className="mt-2.5 text-sm leading-normal text-pretty text-muted lg:hidden">{question.why}</p>

          <div
            role="radiogroup"
            aria-label={question.title}
            className={cn("mt-[22px] grid gap-2.5", question.options.length >= 4 && "lg:grid-cols-2")}
          >
            {question.options.map((option, i) => {
              const on = selected === i;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onPick(i)}
                  className={cn(
                    "grid min-h-[76px] grid-cols-[44px_minmax(0,1fr)_26px] items-center gap-3.5 rounded-[18px] border-2 px-4 py-3.5 text-left transition-[border-color,background-color,transform,box-shadow] duration-150 hover:border-carbon active:scale-[0.98] lg:min-h-24",
                    on
                      ? "scale-[1.01] border-carbon bg-lime-tint shadow-[0_6px_18px_rgb(21_23_26/0.08)]"
                      : "border-line bg-white",
                  )}
                >
                  <FinderIcon question={index} option={i} selected={on} />
                  <span>
                    <span className="block text-[17px] leading-[1.15] font-extrabold">{option.label}</span>
                    <span className="mt-[3px] block text-[13px] leading-[1.35] text-muted">
                      {option.description}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-[26px] place-items-center rounded-full border-2 text-[13px] font-black transition-colors duration-150",
                      on ? "border-carbon bg-lime" : "border-[#d6d9d0] bg-white",
                    )}
                  >
                    {on && "✓"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex-1" />
          <p className="pt-4 pb-2 text-center text-[13px] text-muted">
            {selected === null
              ? "Toca una respuesta para continuar"
              : "Puedes cambiar tu respuesta tocando otra"}
          </p>
        </div>
      </div>

      <div className="relative hidden flex-col justify-end overflow-hidden bg-mist p-10 lg:flex">
        <div aria-hidden="true" className="absolute -top-[120px] -right-[120px] size-[520px] overflow-hidden rounded-full opacity-80">
          <div className={cn(RING, "inset-0")} />
          <div className={cn(RING, "inset-[18%]")} />
          <div className={cn(RING, "inset-[36%]")} />
        </div>
        {racket && (
          <RacketImage
            src={racket.image}
            sizes="420px"
            className="!absolute top-[50px] left-1/2 size-[420px] -translate-x-1/2 -rotate-[8deg]"
          />
        )}
        <div className="relative rounded-[20px] bg-white px-[22px] py-5 shadow-[0_10px_30px_rgb(21_23_26/0.08)]">
          <p className="text-[13px] font-extrabold">Por qué lo preguntamos</p>
          <p className="mt-1.5 text-base leading-[1.55] text-pretty text-ink">{question.why}</p>
        </div>
      </div>
    </div>
  );
}

function Loading({ step, catalogCount }: { step: number; catalogCount: number }) {
  const steps = [
    "Analizando tu estilo de juego",
    `Buscando entre ${formatCount(catalogCount)} palas`,
    "Comparando los precios de hoy",
  ];

  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center px-7 py-8 text-center">
      <div aria-hidden="true" className="relative size-60 overflow-hidden rounded-full">
        <div className={cn(RING, "inset-0")} />
        <div className={cn(RING, "inset-[20%]")} />
        <div className={cn(RING, "inset-[40%]")} />
        <Sweep seconds={1.6} alpha={0.6} />
        <div className="absolute top-1/2 left-1/2 -mt-[7px] -ml-[7px] size-3.5 rounded-full border-2 border-carbon bg-lime" />
      </div>
      <h2 className="mt-[30px] text-[26px] font-black tracking-[-0.025em]">Buscando tu pala…</h2>
      <ul className="mt-5 flex min-w-[260px] flex-col gap-3 text-left">
        {steps.map((text, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li
              key={text}
              className={cn(
                "flex items-center gap-3 text-[15px] transition-colors duration-200",
                done || current ? "text-carbon" : "text-[#9a9f95]",
                current ? "font-extrabold" : "font-semibold",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-[22px] flex-none place-items-center rounded-full border-2 text-[11px] font-black text-carbon",
                  done ? "border-carbon bg-lime" : current ? "border-carbon bg-white" : "border-[#d6d9d0] bg-white",
                )}
              >
                {done && "✓"}
              </span>
              {text}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Mode = "auto" | "intro" | "question" | "loading";

interface FinderProps {
  /** Respuestas que trae la URL */
  initialAnswers: FinderAnswers;
  /** La URL trae las seis respuestas: `children` es el resultado de esa búsqueda */
  resultReady: boolean;
  /** Palas del catálogo que ilustran la entrada y las preguntas */
  showcase: FinderShowcase[];
  /** Palas del catálogo, para el texto de la búsqueda */
  catalogCount: number;
  /** Resultado renderizado en servidor (o el estado «sin resultados») */
  children: ReactNode;
}

/**
 * Quiz «Encuentra tu pala ideal»: entrada → seis preguntas → búsqueda →
 * resultado. Las respuestas viajan en la URL y el resultado se renderiza en
 * servidor; este componente solo lleva el recorrido y sus transiciones.
 */
export function Finder({ initialAnswers, resultReady, showcase, catalogCount, children }: FinderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("auto");
  const [answers, setAnswers] = useState<FinderAnswers>(initialAnswers);
  const [question, setQuestion] = useState(0);
  const [fading, setFading] = useState(false);
  const [step, setStep] = useState(0);
  const [minElapsed, setMinElapsed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = useCallback((task: () => void, ms: number) => {
    timers.current.push(setTimeout(task, ms));
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const search = useCallback(
    (next: FinderAnswers) => {
      setAnswers(next);
      setMode("loading");
      setStep(0);
      setMinElapsed(false);
      [1, 2, 3].forEach((k) => later(() => setStep(k), k * STEP_EVERY));
      later(() => setMinElapsed(true), MIN_LOADING);
      // El resultado lo calcula el servidor con las respuestas de la URL.
      startTransition(() => router.push(finderPath(next)));
    },
    [later, router],
  );

  const actions = useMemo<FinderActions>(
    () => ({
      edit: () => {
        setQuestion(0);
        setFading(false);
        setMode("question");
        window.scrollTo({ top: 0 });
      },
      restart: () => {
        setAnswers(NO_ANSWERS);
        setQuestion(0);
        setMode("intro");
        router.replace(routes.idealPala);
      },
      recalculate: (patch) => {
        search(answers.map((answer, i) => patch[i] ?? answer));
        window.scrollTo({ top: 0 });
      },
    }),
    [answers, router, search],
  );

  function pick(option: number) {
    // Mientras dura la transición se ignoran nuevos toques.
    if (fading) return;
    const next = answers.map((answer, i) => (i === question ? option : answer));
    const isLast = question === FINDER_QUESTIONS.length - 1;
    setAnswers(next);
    later(() => setFading(true), FADE_AT);
    later(() => {
      setFading(false);
      if (isLast) search(next);
      else setQuestion(question + 1);
    }, NEXT_AT);
  }

  function back() {
    if (fading) return;
    if (question === 0) setMode("intro");
    else setQuestion(question - 1);
  }

  const searching = mode === "loading" && (!minElapsed || isPending);
  const phase =
    mode === "question" || mode === "intro"
      ? mode
      : searching
        ? "loading"
        : resultReady
          ? "result"
          : "intro";

  return (
    <FinderContext.Provider value={actions}>
      <div
        data-finder={phase}
        className={cn(
          "flex flex-col bg-white",
          // En móvil ocupa la pantalla; en escritorio, lo que deja la cabecera.
          phase !== "result" && "min-h-[100svh] lg:min-h-[calc(100svh-77px)]",
        )}
      >
        {phase === "intro" && (
          <Intro
            showcase={showcase}
            onStart={() => {
              setQuestion(0);
              setMode("question");
            }}
          />
        )}
        {phase === "question" && (
          <Question
            index={question}
            selected={answers[question] ?? null}
            fading={fading}
            racket={showcase[0]}
            onPick={pick}
            onBack={back}
          />
        )}
        {phase === "loading" && <Loading step={step} catalogCount={catalogCount} />}
        {phase === "result" && children}
      </div>
    </FinderContext.Provider>
  );
}
