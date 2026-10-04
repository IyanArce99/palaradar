// Acceso a `price_alerts`. Dos implementaciones: PostgreSQL (la real) y memoria (pruebas).
import type { Sql } from "@/data/db/client";

export type AlertStatus = "pending" | "active" | "notified" | "cancelled";

export interface AlertRacket {
  id: string;
  slug: string;
  /** Marca y modelo */
  name: string;
  year: number;
}

export interface Alert {
  id: string;
  racket: AlertRacket;
  email: string;
  /** null: alerta de disponibilidad */
  targetPrice: number | null;
  status: AlertStatus;
  token: string;
  confirmationSentAt: string | null;
}

/** Alerta activa cuya condición se cumple con el precio de hoy */
export interface DueAlert extends Alert {
  price: number;
  storeName: string;
  storeCount: number;
}

export interface NewAlert {
  racketId: string;
  email: string;
  targetPrice: number | null;
  token: string;
  consentAt: string;
  ipHash: string | null;
}

export interface AlertRepository {
  /** Alerta abierta (pendiente o activa) de ese correo para esa pala. */
  findOpen(racketId: string, email: string): Promise<Alert | null>;
  findByToken(token: string): Promise<Alert | null>;
  /** Alertas creadas desde `since` por ese correo o desde esa huella de IP. */
  countRecent(by: { email?: string; ipHash?: string }, since: string): Promise<number>;
  create(alert: NewAlert): Promise<Alert>;
  /** Borra una alerta recién creada cuyo correo de confirmación no se pudo enviar. */
  remove(id: string): Promise<void>;
  /** Cambia el precio objetivo de una alerta aún sin confirmar. */
  updateTarget(id: string, targetPrice: number | null): Promise<void>;
  markConfirmationSent(id: string, at: string): Promise<void>;
  confirm(id: string, at: string): Promise<void>;
  cancel(id: string, at: string): Promise<void>;
  /**
   * Alertas activas que hay que avisar: la pala tiene un precio comprobado después
   * de `staleBefore`, en tiendas reales, igual o inferior al objetivo (o cualquier
   * precio, si la alerta es de disponibilidad).
   */
  listDue(staleBefore: string): Promise<DueAlert[]>;
  markNotified(id: string, at: string, price: number): Promise<void>;
  /**
   * Borra las alertas que ya no hacen falta: las cerradas (avisadas o dadas de
   * baja) antes de `closedBefore` y las nunca confirmadas creadas antes de
   * `pendingBefore`. Devuelve cuántas ha borrado.
   */
  purge(closedBefore: string, pendingBefore: string): Promise<number>;
}

interface AlertRow {
  id: string;
  racket_id: string;
  slug: string;
  brand_name: string;
  model: string;
  year: number;
  email: string;
  target_price: number | null;
  status: AlertStatus;
  token: string;
  confirmation_sent_at: string | null;
}

function toAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    racket: { id: row.racket_id, slug: row.slug, name: `${row.brand_name} ${row.model}`, year: row.year },
    email: row.email,
    targetPrice: row.target_price,
    status: row.status,
    token: row.token,
    confirmationSentAt: row.confirmation_sent_at,
  };
}

export function createPostgresAlertRepository(sql: Sql): AlertRepository {
  const select = sql`
    select a.id, a.racket_id, r.slug, b.name as brand_name, r.model, r.year, a.email,
           a.target_price, a.status, a.token, a.confirmation_sent_at
    from price_alerts a
    join rackets r on r.id = a.racket_id
    join brands b on b.id = r.brand_id`;

  async function byId(id: string): Promise<Alert> {
    const [row] = await sql<AlertRow[]>`${select} where a.id = ${id}`;
    return toAlert(row);
  }

  return {
    async findOpen(racketId, email) {
      const [row] = await sql<AlertRow[]>`
        ${select} where a.racket_id = ${racketId} and a.email = ${email}
          and a.status in ('pending', 'active')`;
      return row ? toAlert(row) : null;
    },

    async findByToken(token) {
      const [row] = await sql<AlertRow[]>`${select} where a.token = ${token}`;
      return row ? toAlert(row) : null;
    },

    async countRecent({ email, ipHash }, since) {
      const [{ total }] = await sql<{ total: number }[]>`
        select count(*)::int as total from price_alerts
        where created_at > ${since}
          and (${email ? sql`email = ${email}` : sql`false`} or ${ipHash ? sql`ip_hash = ${ipHash}` : sql`false`})`;
      return total;
    },

    async create(alert) {
      const [{ id }] = await sql<{ id: string }[]>`
        insert into price_alerts (racket_id, email, target_price, token, consent_at, ip_hash, created_at)
        values (${alert.racketId}, ${alert.email}, ${alert.targetPrice}, ${alert.token},
                ${alert.consentAt}, ${alert.ipHash}, ${alert.consentAt})
        returning id`;
      return byId(id);
    },

    async remove(id) {
      await sql`delete from price_alerts where id = ${id} and status = 'pending'`;
    },

    async updateTarget(id, targetPrice) {
      await sql`update price_alerts set target_price = ${targetPrice} where id = ${id} and status = 'pending'`;
    },

    async markConfirmationSent(id, at) {
      await sql`update price_alerts set confirmation_sent_at = ${at} where id = ${id}`;
    },

    async confirm(id, at) {
      await sql`
        update price_alerts set status = 'active', confirmed_at = ${at}
        where id = ${id} and status = 'pending'`;
    },

    async cancel(id, at) {
      await sql`
        update price_alerts set status = 'cancelled', cancelled_at = ${at}
        where id = ${id} and status in ('pending', 'active')`;
    },

    async listDue(staleBefore) {
      // `racket_price_stats` solo agrega las tiendas que cuentan como fuente de precios.
      const rows = await sql<(AlertRow & { price: number; store_name: string; store_count: number })[]>`
        select d.*, s.best_price as price, st.name as store_name, s.store_count
        from (${select} where a.status = 'active') d
        join racket_price_stats s on s.racket_id = d.racket_id
        join stores st on st.id = s.best_store_id
        where s.price_checked_at > ${staleBefore}
          and (d.target_price is null or s.best_price <= d.target_price)`;
      return rows.map((row) => ({
        ...toAlert(row),
        price: row.price,
        storeName: row.store_name,
        storeCount: row.store_count,
      }));
    },

    async markNotified(id, at, price) {
      await sql`
        update price_alerts set status = 'notified', notified_at = ${at}, notified_price = ${price}
        where id = ${id} and status = 'active'`;
    },

    async purge(closedBefore, pendingBefore) {
      const deleted = await sql`
        delete from price_alerts
        where (status in ('notified', 'cancelled')
               and coalesce(notified_at, cancelled_at, created_at) < ${closedBefore})
           or (status = 'pending' and created_at < ${pendingBefore})`;
      return deleted.count;
    },
  };
}
