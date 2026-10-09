// «Mis alertas»: acceso por enlace firmado, sin cuentas.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACCESS_LINK_DAYS, accessSecret, createAccessToken, readAccessToken } from "@/alerts/access";
import type { Email, Mailer } from "@/alerts/email";
import { createMemoryAlertRepository } from "@/alerts/memory-repository";
import type { AlertRacket } from "@/alerts/repository";
import { cancelAlert, confirmAlert, createAlert, requestAccessLink } from "@/alerts/service";

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;
const SECRET = "clave-de-prueba";
const NOW = new Date("2026-10-09T10:00:00Z");
const DAY_MS = 86_400_000;
const RACKET: AlertRacket = { id: "r1", slug: "adidas-metalbone-2026", name: "Adidas Metalbone", year: 2026 };
const OTHER: AlertRacket = { id: "r2", slug: "nox-at10-2026", name: "Nox AT10", year: 2026 };

describe("enlace de acceso", () => {
  it("devuelve el correo mientras no caduque", () => {
    const token = createAccessToken("ana@example.com", NOW, SECRET);
    assert.equal(readAccessToken(token, NOW, SECRET), "ana@example.com");
    assert.equal(readAccessToken(token, new Date(NOW.getTime() + (ACCESS_LINK_DAYS - 1) * DAY_MS), SECRET), "ana@example.com");
    assert.equal(readAccessToken(token, new Date(NOW.getTime() + (ACCESS_LINK_DAYS + 1) * DAY_MS), SECRET), null);
  });

  it("no acepta un token manipulado, de otra clave o mal formado", () => {
    const token = createAccessToken("ana@example.com", NOW, SECRET);
    const [, expires, signature] = token.split(".");
    const forged = `${Buffer.from("otra@example.com").toString("base64url")}.${expires}.${signature}`;
    assert.equal(readAccessToken(forged, NOW, SECRET), null);
    assert.equal(readAccessToken(token, NOW, "otra-clave"), null);
    // Alargar la caducidad invalida la firma.
    assert.equal(readAccessToken(token.replace(`.${expires}.`, `.${Number(expires) + DAY_MS}.`), NOW, SECRET), null);
    for (const bad of ["", "a.b", "a.b.c.d", "...", token.slice(0, -2)]) {
      assert.equal(readAccessToken(bad, NOW, SECRET), null, bad);
    }
  });

  it("sin ALERTS_SECRET no hay enlaces, salvo en el buzón de desarrollo", () => {
    assert.equal(accessSecret(env({ ALERTS_SECRET: "x" })), "x");
    assert.equal(accessSecret(env({ NODE_ENV: "production", RESEND_API_KEY: "re_x", ALERTS_FROM_EMAIL: "a@b.es" })), null);
    assert.equal(accessSecret(env({ NODE_ENV: "production" })), null);
    assert.ok(accessSecret(env({ NODE_ENV: "development" })));
  });
});

describe("pedir el enlace de «Mis alertas»", () => {
  async function setup() {
    const { repository, alerts } = createMemoryAlertRepository([RACKET, OTHER]);
    const sent: Email[] = [];
    const mailer: Mailer = { send: async (email) => void sent.push(email) };
    let clock = NOW.getTime();
    const deps = { repository, mailer, now: () => new Date(clock) };
    const request = (racket: AlertRacket, email: string) =>
      createAlert(
        { racket, currentPrice: 240, email, targetPrice: "220", consent: true, honeypot: "", ip: null },
        deps,
      );
    return { repository, alerts, sent, deps, request, advance: (ms: number) => (clock += ms) };
  }

  it("responde igual tenga o no alertas, y solo envía el enlace a quien las tiene", async () => {
    const { sent, deps, request } = await setup();
    await request(RACKET, "ana@example.com");
    sent.length = 0;

    assert.deepEqual(await requestAccessLink("nadie@example.com", { ...deps, secret: SECRET }), { status: "sent" });
    assert.equal(sent.length, 0);

    assert.deepEqual(await requestAccessLink(" Ana@Example.com ", { ...deps, secret: SECRET }), { status: "sent" });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "ana@example.com");
    const token = decodeURIComponent(/mis-alertas\/\?acceso=([^\s]+)/.exec(sent[0].text)?.[1] ?? "");
    assert.equal(readAccessToken(token, NOW, SECRET), "ana@example.com");
  });

  it("no reenvía el enlace al mismo correo hasta pasados unos minutos", async () => {
    const { sent, deps, request, advance } = await setup();
    await request(RACKET, "bea@example.com");
    sent.length = 0;

    await requestAccessLink("bea@example.com", { ...deps, secret: SECRET });
    await requestAccessLink("bea@example.com", { ...deps, secret: SECRET });
    assert.equal(sent.length, 1);
    advance(6 * 60_000);
    await requestAccessLink("bea@example.com", { ...deps, secret: SECRET });
    assert.equal(sent.length, 2);
  });

  it("sin clave, sin envío de correo o con un correo no válido no envía nada", async () => {
    const { sent, deps, request } = await setup();
    await request(RACKET, "cris@example.com");
    sent.length = 0;

    assert.deepEqual(await requestAccessLink("cris@example.com", { ...deps, secret: null }), { status: "unavailable" });
    assert.deepEqual(await requestAccessLink("cris@example.com", { ...deps, mailer: null, secret: SECRET }), { status: "unavailable" });
    assert.equal((await requestAccessLink("cris@", { ...deps, secret: SECRET })).status, "invalid");
    assert.equal(sent.length, 0);
  });

  it("la lista enseña las alertas vivas del correo: no las dadas de baja ni las de otros", async () => {
    const { repository, alerts, deps, request } = await setup();
    await request(RACKET, "dani@example.com");
    await request(OTHER, "dani@example.com");
    await request(RACKET, "otra@example.com");
    const mine = alerts.filter((alert) => alert.email === "dani@example.com");
    await confirmAlert(mine[0].token, deps);

    const listed = await repository.listByEmail("dani@example.com");
    // Primero las activas; después, las pendientes de confirmar.
    assert.deepEqual(listed.map((alert) => [alert.racket.id, alert.status]), [["r1", "active"], ["r2", "pending"]]);

    await cancelAlert(mine[0].token, deps);
    assert.deepEqual((await repository.listByEmail("dani@example.com")).map((alert) => alert.racket.id), ["r2"]);
  });
});
