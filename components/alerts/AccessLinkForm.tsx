"use client";

import { useActionState } from "react";
import { requestAccessLinkAction } from "@/app/alertas/actions";

/** «Mis alertas»: pide por correo el enlace para ver las alertas. No hay cuentas ni contraseñas. */
export function AccessLinkForm() {
  const [state, submit, pending] = useActionState(requestAccessLinkAction, { status: "idle" });

  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-[14px] bg-mist p-4 text-[15px] leading-normal">
        <strong className="block">Revisa tu correo.</strong>
        Si ese correo tiene alertas, te hemos enviado un enlace para verlas. Puede tardar un par de
        minutos.
      </p>
    );
  }

  const message =
    state.status === "invalid"
      ? state.message
      : state.status === "unavailable"
        ? "Ahora mismo no podemos enviarte el enlace. Inténtalo de nuevo más tarde."
        : null;

  return (
    <form action={submit}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <label>
          <span className="sr-only">Tu correo electrónico</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="tu@email.com"
            className="h-[50px] w-full rounded-[14px] border-[1.5px] border-line bg-white px-4 text-[15px] placeholder:text-muted focus:border-carbon focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex h-[50px] items-center rounded-[14px] bg-carbon px-[18px] text-[15px] font-extrabold text-white disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Enviar enlace"}
        </button>
      </div>
      {/* Campo trampa para programas automáticos: una persona no lo ve ni lo rellena. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          No rellenes este campo
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {message && (
        <p role="alert" className="mt-3 rounded-xl bg-mist px-3.5 py-2.5 text-sm font-bold">
          {message}
        </p>
      )}
    </form>
  );
}
