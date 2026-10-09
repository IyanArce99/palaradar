"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveResultsAction, type SaveResultsFormState } from "@/app/alertas/actions";
import { routes } from "@/lib/routes";

interface SaveResultsProps {
  /** Las respuestas del quiz, como cadena de consulta: el servidor recalcula con ellas */
  answers: string;
}

const MESSAGES: Partial<Record<SaveResultsFormState["status"], string>> = {
  exists: "Ese correo ya tiene un aviso activo para estas palas.",
  "rate-limited": "Has hecho muchas peticiones en poco tiempo. Inténtalo de nuevo dentro de un rato.",
  unavailable: "Ahora mismo no podemos enviarte el correo. Inténtalo de nuevo más tarde.",
};

/**
 * «Guarda tus resultados»: correo con las palas recomendadas y aviso si alguna
 * baja de precio. El aviso no se activa hasta confirmar el enlace del correo.
 */
export function SaveResults({ answers }: SaveResultsProps) {
  const [state, submit, pending] = useActionState(saveResultsAction, { status: "idle" });
  const message = state.status === "invalid" ? state.message : MESSAGES[state.status];

  return (
    <section aria-labelledby="guardar" className="mt-7 rounded-[22px] bg-carbon p-[22px] text-white">
      <h2 id="guardar" className="text-xl font-black">
        Guarda tus resultados
      </h2>
      <p className="mt-1.5 text-sm leading-normal text-ash">
        Te enviamos estas palas por email y te avisamos si alguna baja de precio.
      </p>

      {state.status === "pending" ? (
        <p role="status" className="mt-3.5 rounded-[14px] bg-white/10 p-4 text-[15px] leading-normal">
          <strong className="block">Revisa tu correo.</strong>
          Te hemos enviado tus palas. Para que te avisemos cuando bajen de precio, confirma el enlace
          del correo.
        </p>
      ) : (
        <form action={submit}>
          <input type="hidden" name="answers" value={answers} />
          <div className="mt-3.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <label>
              <span className="sr-only">Tu correo electrónico</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="tu@email.com"
                className="h-[50px] w-full rounded-[14px] bg-white px-4 text-[15px] text-carbon outline-offset-2 placeholder:text-muted focus-visible:outline-2 focus-visible:outline-lime"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="flex h-[50px] items-center rounded-[14px] bg-lime px-[18px] font-extrabold text-carbon hover:bg-[#bde52f] disabled:opacity-60"
            >
              {pending ? "Enviando…" : "Enviar"}
            </button>
          </div>

          {/* Campo trampa para programas automáticos: una persona no lo ve ni lo rellena. */}
          <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
            <label>
              No rellenes este campo
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <label className="mt-3 flex items-start gap-2.5 text-[13px] leading-[1.45] text-ash">
            <input type="checkbox" name="consent" required className="mt-0.5 size-[18px] flex-none accent-lime" />
            <span>
              He leído la{" "}
              <Link href={routes.privacy} target="_blank" className="font-bold text-white underline">
                política de privacidad
              </Link>{" "}
              y acepto que PalaRadar use mi correo para enviarme estas palas y, si lo confirmo, un
              aviso cuando alguna baje de precio. Podrás darte de baja en cualquier momento.
            </span>
          </label>

          {message && (
            <p role="alert" className="mt-3 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm font-bold">
              {message}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
