// Alertas de precio contra PostgreSQL, en transacciones que se deshacen. Solo se
// ejecuta con `npm run test:db` (necesita DATABASE_URL).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Email, Mailer } from "@/alerts/email";
import { createPostgresAlertRepository } from "@/alerts/repository";
import {
  cancelAlert,
  CLOSED_RETENTION_DAYS,
  confirmAlert,
  createAlert,
  notifyDueAlerts,
  purgeOldAlerts,
  UNCONFIRMED_RETENTION_DAYS,
} from "@/alerts/service";
import { createSql, getDatabaseUrl, type Sql } from "@/data/db/client";

const url = getDatabaseUrl();
const ROLLBACK = new Error("rollback");
const NOW = new Date();
const EMAIL = "alerta-de-test@example.com";

async function rolledBack(work: (tx: Sql) => Promise<void>): Promise<void> {
  const sql = createSql(url as string, 1);
  try {
    await sql.begin(async (transaction) => {
      await work(transaction as unknown as Sql);
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  } finally {
    await sql.end();
  }
}

interface PricedRacket {
  id: string;
  slug: string;
  name: string;
  year: number;
  price: number;
}

/** Una pala disponible con precio, que la prueba da por comprobado ahora mismo. */
async function pricedRacket(tx: Sql): Promise<PricedRacket> {
  const [row] = await tx<PricedRacket[]>`
    select c.id, c.slug, c.brand_name || ' ' || c.model as name, c.year, c.best_price as price
    from racket_catalog c
    where c.best_price > 50
    order by c.slug limit 1`;
  assert.ok(row, "Hace falta una pala con precio");
  await tx`update racket_price_stats set price_checked_at = ${NOW.toISOString()} where racket_id = ${row.id}`;
  return row;
}

function fakeMailer() {
  const sent: Email[] = [];
  const mailer: Mailer = { send: async (email) => void sent.push(email) };
  return { sent, mailer };
}

describe("alertas de precio en PostgreSQL", { skip: !url && "DATABASE_URL no configurada" }, () => {
  it("crea, confirma y avisa cuando el precio de hoy cumple el objetivo", async () => {
    await rolledBack(async (tx) => {
      const racket = await pricedRacket(tx);
      const repository = createPostgresAlertRepository(tx);
      const { sent, mailer } = fakeMailer();
      const deps = { repository, mailer, now: () => NOW };
      const request = {
        racket, currentPrice: racket.price, email: EMAIL, targetPrice: String(racket.price - 1),
        consent: true, honeypot: "", ip: "203.0.113.9",
      };

      assert.deepEqual(await createAlert(request, deps), { status: "pending" });
      const alert = await repository.findOpen(racket.id, EMAIL);
      assert.deepEqual([alert?.status, alert?.targetPrice, alert?.racket.slug], ["pending", racket.price - 1, racket.slug]);
      assert.ok(alert);

      // Sin confirmar no se vigila; con el objetivo por debajo del precio, tampoco.
      assert.equal((await notifyDueAlerts(deps)).due, 0);
      assert.equal((await confirmAlert(alert.token, deps)).status, "ok");
      assert.equal((await notifyDueAlerts(deps)).due, 0);

      // El precio «baja» hasta el objetivo: se avisa una vez y la alerta se cierra.
      await tx`update racket_price_stats set best_price = ${racket.price - 2} where racket_id = ${racket.id}`;
      assert.deepEqual(await notifyDueAlerts(deps), { due: 1, sent: 1, failed: 0 });
      assert.equal((await repository.findByToken(alert.token))?.status, "notified");
      assert.equal((await notifyDueAlerts(deps)).due, 0);
      assert.equal(sent.length, 2);
      assert.equal(sent[1].to, EMAIL);
    });
  });

  it("una sola alerta abierta por pala y correo, y la baja la cierra", async () => {
    await rolledBack(async (tx) => {
      const racket = await pricedRacket(tx);
      const repository = createPostgresAlertRepository(tx);
      const { sent, mailer } = fakeMailer();
      const deps = { repository, mailer, now: () => NOW };
      const request = {
        racket, currentPrice: racket.price, email: EMAIL, targetPrice: String(racket.price - 5),
        consent: true, honeypot: "", ip: null,
      };

      await createAlert(request, deps);
      await createAlert({ ...request, targetPrice: String(racket.price - 10) }, deps);
      const [{ total }] = await tx<{ total: number }[]>`
        select count(*)::int as total from price_alerts where email = ${EMAIL}`;
      assert.deepEqual([total, sent.length], [1, 1]);

      const alert = await repository.findOpen(racket.id, EMAIL);
      assert.equal(alert?.targetPrice, racket.price - 10);
      assert.ok(alert);
      assert.equal((await cancelAlert(alert.token, deps)).status, "ok");
      assert.equal(await repository.findOpen(racket.id, EMAIL), null);
      assert.equal(await repository.countRecent({ email: EMAIL }, new Date(NOW.getTime() - 3_600_000).toISOString()), 1);

      // No se guarda la IP, solo su huella (o nada si no se conoce).
      const [row] = await tx<{ ip_hash: string | null; consent_at: string }[]>`
        select ip_hash, consent_at from price_alerts where email = ${EMAIL}`;
      assert.equal(row.ip_hash, null);
      assert.ok(row.consent_at);
    });
  });

  it("borra las alertas cerradas y las sin confirmar cuando vence su plazo, no las activas", async () => {
    await rolledBack(async (tx) => {
      const racket = await pricedRacket(tx);
      const repository = createPostgresAlertRepository(tx);
      const { mailer } = fakeMailer();
      const deps = { repository, mailer, now: () => NOW };
      const DAY = 24 * 3_600_000;
      const later = (days: number) => ({ repository, now: () => new Date(NOW.getTime() + days * DAY) });
      const create = (email: string) =>
        createAlert(
          { racket, currentPrice: racket.price, email, targetPrice: String(racket.price - 5), consent: true, honeypot: "", ip: null },
          deps,
        );
      const tokenOf = async (email: string) => (await repository.findOpen(racket.id, email))?.token as string;
      const emails = ["sin-confirmar", "activa", "baja"].map((name) => `${name}-de-test@example.com`);
      for (const email of emails) await create(email);
      const [unconfirmed, active, cancelled] = await Promise.all(emails.map(tokenOf));
      await confirmAlert(active, deps);
      await cancelAlert(cancelled, deps);

      // La purga solo cuenta lo que borra de estas tres: la tabla puede tener otras alertas.
      const left = async () =>
        (await tx<{ token: string }[]>`select token from price_alerts where email = any(${emails})`).map((row) => row.token).sort();

      await purgeOldAlerts(later(UNCONFIRMED_RETENTION_DAYS - 1));
      assert.deepEqual(await left(), [unconfirmed, active, cancelled].sort());

      await purgeOldAlerts(later(UNCONFIRMED_RETENTION_DAYS + 1));
      assert.deepEqual(await left(), [active, cancelled].sort());

      await purgeOldAlerts(later(CLOSED_RETENTION_DAYS + 1));
      assert.deepEqual(await left(), [active]);
    });
  });
});
