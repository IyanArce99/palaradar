"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createAlertAction, type AlertFormState } from "@/app/alertas/actions";
import { formatEuroCompact } from "@/lib/format";
import { routes } from "@/lib/routes";

const STEP = 5;

interface AlertFormProps {
  slug: string;
  /** Precio objetivo propuesto y tope del selector; null: alerta de disponibilidad, sin selector */
  target: { suggested: number; max: number } | null;
}

const MESSAGES: Partial<Record<AlertFormState["status"], string>> = {
  exists: "Ya tienes una alerta activa para esta pala con este correo.",
  "rate-limited": "Has creado muchas alertas en poco tiempo. Inténtalo de nuevo dentro de un rato.",
  unavailable: "Ahora mismo no podemos crear la alerta. Inténtalo de nuevo más tarde.",
};

/** Formulario de la alerta: precio objetivo, correo y consentimiento. */
export function AlertForm({ slug, target }: AlertFormProps) {
  const [state, submit, pending] = useActionState(createAlertAction, { status: "idle" });
  const [price, setPrice] = useState(target?.suggested ?? 0);

  if (state.status === "pending") {
    return (
      <p role="status" className="mt-3.5 rounded-[14px] bg-white/10 p-4 text-[15px] leading-normal">
        <strong className="block">Revisa tu correo.</strong>
        Te hemos enviado un enlace para confirmar la alerta. Hasta que lo pulses no estará activa.
      </p>
    );
  }

  const message = state.status === "invalid" ? state.message : MESSAGES[state.status];

  return (
    <form action={submit} className="mt-3.5">
      <input type="hidden" name="slug" value={slug} />
      {target && (
        <>
          <input type="hidden" name="targetPrice" value={price} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={`Bajar ${STEP} euros el precio objetivo`}
              disabled={price - STEP < STEP}
              onClick={() => setPrice(price - STEP)}
              className="grid size-12 flex-none place-items-center rounded-xl bg-white/10 text-xl disabled:opacity-40"
            >
              −
            </button>
            <output
              aria-label="Precio objetivo"
              className="grid h-14 flex-1 place-items-center rounded-[14px] bg-white text-[28px] font-black whitespace-nowrap text-carbon tabular-nums"
            >
              {formatEuroCompact(price)}
            </output>
            <button
              type="button"
              aria-label={`Subir ${STEP} euros el precio objetivo`}
              disabled={price + STEP > target.max}
              onClick={() => setPrice(price + STEP)}
              className="grid size-12 flex-none place-items-center rounded-xl bg-white/10 text-xl disabled:opacity-40"
            >
              +
            </button>
          </div>
          <p className="mt-2.5 text-sm leading-[1.45] text-ash">
            Te avisaremos cuando encontremos este precio o uno inferior en cualquier tienda.
          </p>
        </>
      )}

      <label className="mt-3.5 block">
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
          y acepto que PalaRadar use mi correo para enviarme este aviso. Solo recibirás un correo
          de confirmación y otro cuando se cumpla, y podrás darte de baja en cualquier momento.
        </span>
      </label>

      {message && (
        <p role="alert" className="mt-3 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm font-bold">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-3.5 flex h-[52px] w-full items-center justify-center rounded-[14px] bg-lime text-[15px] font-extrabold text-carbon disabled:opacity-60"
      >
        {pending ? "Creando la alerta…" : "Crear alerta"}
      </button>
    </form>
  );
}
