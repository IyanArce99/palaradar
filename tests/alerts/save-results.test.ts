// «Guarda tus resultados» del quiz y el buzón de desarrollo de las alertas.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { usesConsoleMailer, type Email, type Mailer } from "@/alerts/email";
import { createMemoryAlertRepository } from "@/alerts/memory-repository";
import type { AlertRacket } from "@/alerts/repository";
import { anyDropTarget, confirmAlert, saveResults, type SaveResultsRequest } from "@/alerts/service";

const RACKET: AlertRacket = { id: "r1", slug: "adidas-metalbone-2026", name: "Adidas Metalbone", year: 2026 };
const OTHER: AlertRacket = { id: "r2", slug: "nox-at10-2026", name: "Nox AT10", year: 2026 };
const NOW = new Date("2026-10-09T10:00:00Z");

function setup() {
  const { repository, alerts } = createMemoryAlertRepository([RACKET, OTHER], new Map());
  const sent: Email[] = [];
  const mailer: Mailer = { send: async (email) => void sent.push(email) };
  return { alerts, sent, deps: { repository, mailer, now: () => NOW } };
}

const save = (extra: Partial<SaveResultsRequest> = {}): SaveResultsRequest => ({
  items: [
    { racket: RACKET, currentPrice: 239.95, affinity: 93 },
    { racket: OTHER, currentPrice: 180, affinity: 85 },
  ],
  resultsPath: "/pala-ideal/?nivel=intermedio",
  email: " Ana@Example.com ",
  consent: true,
  honeypot: "",
  ip: "203.0.113.7",
  ...extra,
});

describe("«Guarda tus resultados»", () => {
  it("envía un solo correo con las palas y deja un aviso sin confirmar por cada una", async () => {
    const { alerts, sent, deps } = setup();
    assert.deepEqual(await saveResults(save(), deps), { status: "pending" });

    assert.deepEqual(
      alerts.map((alert) => [alert.status, alert.email, alert.targetPrice]),
      [
        ["pending", "ana@example.com", 239.94],
        ["pending", "ana@example.com", 179.99],
      ],
    );
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /Adidas Metalbone 2026 · 93 % de afinidad · hoy desde 239,95/);
    assert.match(sent[0].text, /pala-ideal\/\?nivel=intermedio/);
    // Un único enlace confirma todos los avisos, y cada pala tiene su baja.
    assert.equal((sent[0].text.match(/alertas\/confirmar\/\?token=[^&\s]+&token=/g) ?? []).length, 1);
    assert.equal((sent[0].text.match(/Dejar de vigilar la /g) ?? []).length, 2);
  });

  it("el aviso salta con cualquier bajada, no con el mismo precio", () => {
    assert.equal(anyDropTarget(239.95), 239.94);
    assert.ok(anyDropTarget(100) < 100);
  });

  it("sin consentimiento o con un correo no válido no guarda ni envía nada", async () => {
    const { alerts, sent, deps } = setup();
    assert.equal((await saveResults(save({ consent: false }), deps)).status, "invalid");
    assert.equal((await saveResults(save({ email: "ana@" }), deps)).status, "invalid");
    assert.deepEqual([alerts.length, sent.length], [0, 0]);
  });

  it("un bot que rellena el campo trampa recibe la misma respuesta, sin efecto", async () => {
    const { alerts, sent, deps } = setup();
    assert.deepEqual(await saveResults(save({ honeypot: "http://spam" }), deps), { status: "pending" });
    assert.deepEqual([alerts.length, sent.length], [0, 0]);
  });

  it("sin envío de correo no deja avisos huérfanos", async () => {
    const { alerts, deps } = setup();
    assert.deepEqual(await saveResults(save(), { ...deps, mailer: null }), { status: "unavailable" });
    const failing: Mailer = { send: () => Promise.reject(new Error("caído")) };
    assert.deepEqual(await saveResults(save(), { ...deps, mailer: failing }), { status: "unavailable" });
    assert.equal(alerts.length, 0);
  });

  it("no duplica el aviso de una pala que ese correo ya vigila", async () => {
    const { alerts, deps } = setup();
    await saveResults(save(), deps);
    for (const alert of [...alerts]) await confirmAlert(alert.token, deps);
    assert.deepEqual(await saveResults(save(), deps), { status: "exists" });
    assert.equal(alerts.length, 2);
  });
});

describe("buzón de desarrollo", () => {
  const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

  it("solo en local, sin Resend y nunca en el despliegue", () => {
    assert.equal(usesConsoleMailer(env({ NODE_ENV: "development" })), true);
    assert.equal(usesConsoleMailer(env({ NODE_ENV: "production" })), false);
    assert.equal(usesConsoleMailer(env({ NODE_ENV: "production", ALERTS_MAILER: "console" })), true);
    assert.equal(usesConsoleMailer(env({ NODE_ENV: "development", VERCEL: "1" })), false);
    assert.equal(usesConsoleMailer(env({ ALERTS_MAILER: "console", VERCEL: "1" })), false);
    assert.equal(
      usesConsoleMailer(env({ NODE_ENV: "development", RESEND_API_KEY: "re_x", ALERTS_FROM_EMAIL: "a@example.com" })),
      false,
    );
  });
});
