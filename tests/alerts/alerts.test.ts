// Alertas de precio: creación con doble confirmación, límites, baja y avisos.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { confirmationEmail, createMailerFromEnv, notificationEmail, type Email, type Mailer } from "@/alerts/email";
import { createMemoryAlertRepository, type MemoryPrice } from "@/alerts/memory-repository";
import type { AlertRacket } from "@/alerts/repository";
import {
  cancelAlert,
  CLOSED_RETENTION_DAYS,
  confirmAlert,
  createAlert,
  hashIp,
  MAX_PER_EMAIL,
  maxTarget,
  normalizeEmail,
  notifyDueAlerts,
  purgeOldAlerts,
  suggestedTarget,
  UNCONFIRMED_RETENTION_DAYS,
  type AlertRequest,
} from "@/alerts/service";

const RACKET: AlertRacket = { id: "r1", slug: "adidas-metalbone-2026", name: "Adidas Metalbone", year: 2026 };
const OTHER: AlertRacket = { id: "r2", slug: "nox-at10-2026", name: "Nox AT10", year: 2026 };
const NOW = new Date("2026-10-04T10:00:00Z");

function setup(prices: [string, MemoryPrice][] = []) {
  const { repository, alerts } = createMemoryAlertRepository([RACKET, OTHER], new Map(prices));
  const sent: Email[] = [];
  const mailer: Mailer = { send: async (email) => void sent.push(email) };
  let clock = NOW.getTime();
  const deps = { repository, mailer, now: () => new Date(clock) };
  return { repository, alerts, sent, deps, advance: (ms: number) => (clock += ms) };
}

const request = (extra: Partial<AlertRequest> = {}): AlertRequest => ({
  racket: RACKET,
  currentPrice: 239.95,
  email: " Ana@Example.com ",
  targetPrice: "220",
  consent: true,
  honeypot: "",
  ip: "203.0.113.7",
  ...extra,
});

describe("precio objetivo", () => {
  it("propone algo por debajo del precio actual, redondeado a 5 €", () => {
    assert.equal(suggestedTarget(239.95), 220);
    assert.equal(suggestedTarget(102.95), 90);
    assert.ok(suggestedTarget(12) < 12);
  });

  it("el tope del selector queda siempre por debajo del precio actual", () => {
    assert.equal(maxTarget(239.95), 235);
    assert.equal(maxTarget(240), 235);
    assert.equal(maxTarget(102.95), 100);
  });
});

describe("crear una alerta", () => {
  it("la deja pendiente y envía el correo de confirmación con baja", async () => {
    const { alerts, sent, deps } = setup();
    assert.deepEqual(await createAlert(request(), deps), { status: "pending" });

    assert.deepEqual([alerts.length, alerts[0].status, alerts[0].email, alerts[0].targetPrice], [1, "pending", "ana@example.com", 220]);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "ana@example.com");
    assert.match(sent[0].text, /alertas\/confirmar\/\?token=/);
    assert.match(sent[0].text, /alertas\/baja\/\?token=/);
    assert.match(sent[0].text, /Política de privacidad: \S+\/privacidad\//);
    assert.match(sent[0].unsubscribeUrl, /api\/alertas\/baja\/\?token=/);
    assert.match(sent[0].text, /239|220,00/);
  });

  it("valida el correo, el consentimiento y el precio", async () => {
    const { alerts, sent, deps } = setup();
    assert.equal(normalizeEmail("sin-arroba"), null);
    assert.equal(normalizeEmail(" A@B.es "), "a@b.es");

    const invalid = async (extra: Partial<AlertRequest>) => {
      const result = await createAlert(request(extra), deps);
      return result.status === "invalid" ? result.field : result.status;
    };
    assert.equal(await invalid({ email: "sin-arroba" }), "email");
    assert.equal(await invalid({ consent: false }), "consent");
    assert.equal(await invalid({ targetPrice: "" }), "targetPrice");
    assert.equal(await invalid({ targetPrice: "239.95" }), "targetPrice");
    assert.equal(await invalid({ targetPrice: "300" }), "targetPrice");
    assert.deepEqual([alerts.length, sent.length], [0, 0]);
  });

  it("sin precio actual crea una alerta de disponibilidad, sin umbral", async () => {
    const { alerts, sent, deps } = setup();
    await createAlert(request({ currentPrice: null, targetPrice: "999" }), deps);

    assert.equal(alerts[0].targetPrice, null);
    assert.match(sent[0].text, /vuelva a estar a la venta/);
  });

  it("descarta en silencio a quien rellena el campo trampa", async () => {
    const { alerts, sent, deps } = setup();
    assert.deepEqual(await createAlert(request({ honeypot: "http://spam" }), deps), { status: "pending" });
    assert.deepEqual([alerts.length, sent.length], [0, 0]);
  });

  it("limita las alertas por correo en una hora", async () => {
    const { repository, deps } = setup();
    // Cinco alertas del mismo correo en la última hora, ya dadas de baja: cuentan igual.
    for (let i = 0; i < MAX_PER_EMAIL; i++) {
      const alert = await repository.create({ racketId: "r1", email: "ana@example.com", targetPrice: 100 + i, token: `t${i}`, consentAt: NOW.toISOString(), ipHash: null });
      await repository.cancel(alert.id, NOW.toISOString());
    }
    assert.deepEqual(await createAlert(request({ racket: OTHER }), deps), { status: "rate-limited" });
    assert.deepEqual(await createAlert(request({ racket: OTHER, email: "otro@example.com", ip: null }), deps), { status: "pending" });
  });

  it("una alerta sin confirmar se actualiza sin reenviar el correo enseguida", async () => {
    const { alerts, sent, deps, advance } = setup();
    await createAlert(request(), deps);
    await createAlert(request({ targetPrice: "200" }), deps);
    assert.deepEqual([alerts.length, alerts[0].targetPrice, sent.length], [1, 200, 1]);

    advance(6 * 60_000);
    await createAlert(request({ targetPrice: "210" }), deps);
    assert.deepEqual([alerts.length, alerts[0].targetPrice, sent.length], [1, 210, 2]);
  });

  it("no toca una alerta ya activa del mismo correo", async () => {
    const { alerts, sent, deps } = setup();
    await createAlert(request(), deps);
    await confirmAlert(alerts[0].token, deps);
    assert.deepEqual(await createAlert(request({ targetPrice: "150" }), deps), { status: "exists" });
    assert.deepEqual([alerts[0].targetPrice, sent.length], [220, 1]);
  });

  it("sin envío de correo configurado no crea nada", async () => {
    const { alerts, deps } = setup();
    assert.deepEqual(await createAlert(request(), { ...deps, mailer: null }), { status: "unavailable" });
    assert.equal(alerts.length, 0);
    assert.equal(createMailerFromEnv({} as NodeJS.ProcessEnv), null);
    assert.equal(createMailerFromEnv({ RESEND_API_KEY: "re_x" } as unknown as NodeJS.ProcessEnv), null);
  });

  it("si el correo de confirmación falla, no deja una alerta huérfana", async () => {
    const { alerts, deps } = setup();
    const failing: Mailer = { send: async () => { throw new Error("proveedor caído"); } };
    const error = console.error;
    console.error = () => {};
    try {
      assert.deepEqual(await createAlert(request(), { ...deps, mailer: failing }), { status: "unavailable" });
    } finally {
      console.error = error;
    }
    assert.equal(alerts.length, 0);
  });

  it("la huella de IP no es la IP y depende de la clave", () => {
    assert.equal(hashIp(null), null);
    assert.notEqual(hashIp("203.0.113.7", "a"), "203.0.113.7");
    assert.notEqual(hashIp("203.0.113.7", "a"), hashIp("203.0.113.7", "b"));
    assert.equal(hashIp("203.0.113.7", "a"), hashIp("203.0.113.7", "a"));
  });
});

describe("confirmar y darse de baja", () => {
  it("la confirmación activa la alerta una sola vez", async () => {
    const { alerts, deps } = setup();
    await createAlert(request(), deps);
    const { token } = alerts[0];

    const first = await confirmAlert(token, deps);
    assert.deepEqual([first.status, first.status === "ok" && first.changed, alerts[0].status], ["ok", true, "active"]);
    const second = await confirmAlert(token, deps);
    assert.deepEqual([second.status, second.status === "ok" && second.changed], ["ok", false]);
    assert.equal((await confirmAlert("no-existe", deps)).status, "not-found");
  });

  it("la baja cancela la alerta y ya no se puede confirmar", async () => {
    const { alerts, deps } = setup();
    await createAlert(request(), deps);
    const { token } = alerts[0];

    assert.equal((await cancelAlert(token, deps)).status, "ok");
    assert.equal(alerts[0].status, "cancelled");
    assert.equal((await confirmAlert(token, deps)).status, "closed");
    assert.equal((await cancelAlert("no-existe", deps)).status, "not-found");
  });
});

describe("conservación", () => {
  const DAY = 24 * 3_600_000;

  it("borra las alertas sin confirmar y las cerradas cuando vence su plazo, nunca las activas", async () => {
    const { repository, alerts, deps, advance } = setup();
    await createAlert(request(), deps);
    await createAlert(request({ racket: OTHER }), deps);
    await createAlert(request({ email: "luis@example.com" }), deps);
    await createAlert(request({ email: "eva@example.com" }), deps);
    const [unconfirmed, active, cancelled, cancelledLate] = alerts.map((alert) => alert.token);
    await confirmAlert(active, deps);
    await cancelAlert(cancelled, deps);

    // Dentro de plazo no se borra nada.
    advance(UNCONFIRMED_RETENTION_DAYS * DAY - 1);
    assert.equal(await purgeOldAlerts(deps), 0);

    // Vence la que nadie confirmó; la baja reciente y la activa siguen.
    advance(2);
    await confirmAlert(cancelledLate, deps);
    await cancelAlert(cancelledLate, deps);
    assert.equal(await purgeOldAlerts(deps), 1);
    assert.equal(await repository.findByToken(unconfirmed), null);

    // El plazo de una alerta cerrada cuenta desde la baja, no desde que se creó.
    advance((CLOSED_RETENTION_DAYS - UNCONFIRMED_RETENTION_DAYS) * DAY);
    assert.equal(await purgeOldAlerts(deps), 1);
    assert.equal(await repository.findByToken(cancelled), null);

    advance(365 * DAY);
    assert.equal(await purgeOldAlerts(deps), 1);
    assert.deepEqual(alerts.map((alert) => [alert.token, alert.status]), [[active, "active"]]);
  });

  it("borra una alerta avisada cuando vence su plazo", async () => {
    const { alerts, deps, advance } = setup([["r1", { price: 200, storeName: "Padel Nuestro", storeCount: 1, checkedAt: NOW.toISOString() }]]);
    await createAlert(request(), deps);
    await confirmAlert(alerts[0].token, deps);
    await notifyDueAlerts(deps);
    assert.equal(alerts[0].status, "notified");

    advance(CLOSED_RETENTION_DAYS * DAY - 1);
    assert.equal(await purgeOldAlerts(deps), 0);
    advance(2);
    assert.equal(await purgeOldAlerts(deps), 1);
    assert.equal(alerts.length, 0);
  });
});

describe("avisos tras la ingestión", () => {
  const today = (price: number, checkedAt = NOW.toISOString()): MemoryPrice => ({ price, storeName: "Padel Nuestro", storeCount: 2, checkedAt });

  async function activeAlert(prices: [string, MemoryPrice][], extra: Partial<AlertRequest> = {}) {
    const context = setup(prices);
    await createAlert(request(extra), context.deps);
    await confirmAlert(context.alerts[0].token, context.deps);
    context.sent.length = 0;
    return context;
  }

  it("avisa cuando el precio alcanza el objetivo, y solo una vez", async () => {
    const { alerts, sent, deps } = await activeAlert([["r1", today(219.95)]]);

    assert.deepEqual(await notifyDueAlerts(deps), { due: 1, sent: 1, failed: 0 });
    assert.equal(alerts[0].status, "notified");
    assert.match(sent[0].subject, /ha bajado a 219,95/);
    assert.match(sent[0].text, /Padel Nuestro/);
    assert.match(sent[0].text, /pala\/adidas-metalbone-2026\/#tiendas/);
    assert.match(sent[0].text, /alertas\/baja\/\?token=/);

    assert.deepEqual(await notifyDueAlerts(deps), { due: 0, sent: 0, failed: 0 });
    assert.equal(sent.length, 1);
  });

  it("no avisa si el precio sigue por encima del objetivo", async () => {
    const { deps, sent } = await activeAlert([["r1", today(229.95)]]);
    assert.deepEqual(await notifyDueAlerts(deps), { due: 0, sent: 0, failed: 0 });
    assert.equal(sent.length, 0);
  });

  it("no avisa con un precio caducado", async () => {
    const old = new Date(NOW.getTime() - 72 * 3_600_000).toISOString();
    const { deps } = await activeAlert([["r1", today(199, old)]]);
    assert.equal((await notifyDueAlerts(deps)).due, 0);
  });

  it("no avisa a una alerta sin confirmar ni a una dada de baja", async () => {
    const { repository, alerts, sent, deps } = setup([["r1", today(100)]]);
    await createAlert(request(), deps);
    sent.length = 0;
    assert.equal((await notifyDueAlerts(deps)).due, 0);

    await confirmAlert(alerts[0].token, deps);
    await repository.cancel(alerts[0].id, NOW.toISOString());
    assert.equal((await notifyDueAlerts(deps)).due, 0);
    assert.equal(sent.length, 0);
  });

  it("la alerta de disponibilidad avisa en cuanto la pala tiene precio", async () => {
    const { sent, deps } = await activeAlert([["r1", today(260)]], { currentPrice: null });
    assert.deepEqual(await notifyDueAlerts(deps), { due: 1, sent: 1, failed: 0 });
    assert.match(sent[0].subject, /vuelve a estar a la venta/);
  });

  it("si el envío falla, la alerta sigue activa para el siguiente intento", async () => {
    const { alerts, deps } = await activeAlert([["r1", today(200)]]);
    const error = console.error;
    console.error = () => {};
    try {
      const failing: Mailer = { send: async () => { throw new Error("proveedor caído"); } };
      assert.deepEqual(await notifyDueAlerts({ ...deps, mailer: failing }), { due: 1, sent: 0, failed: 1 });
    } finally {
      console.error = error;
    }
    assert.equal(alerts[0].status, "active");
    assert.deepEqual(await notifyDueAlerts({ ...deps, mailer: null }), { due: 1, sent: 0, failed: 1 });
  });

  it("los correos llevan versión de texto y HTML sin datos de otras personas", () => {
    const alert = { id: "1", racket: RACKET, email: "ana@example.com", targetPrice: 220, status: "pending" as const, token: "tok<1>", confirmationSentAt: null };
    const confirm = confirmationEmail(alert);
    const notify = notificationEmail({ ...alert, status: "active", price: 219.95, storeName: "Padel & Co", storeCount: 1 });

    assert.match(confirm.subject, /Confirma tu alerta de precio: Adidas Metalbone 2026/);
    assert.match(confirm.html, /token=tok%3C1%3E/);
    assert.match(notify.html, /Padel &amp; Co/);
    assert.match(notify.text, /El envío puede no estar incluido/);
  });
});
