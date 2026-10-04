// Repositorio de alertas en memoria, con las mismas reglas que el de PostgreSQL. Para pruebas.
import type { Alert, AlertRacket, AlertRepository, AlertStatus, DueAlert, NewAlert } from "./repository";

interface StoredAlert extends Alert {
  ipHash: string | null;
  createdAt: string;
  notifiedPrice: number | null;
  /** Cuándo se avisó o se dio de baja */
  closedAt: string | null;
}

/** Precio de hoy de una pala, tal y como lo vería la consulta de alertas */
export interface MemoryPrice {
  price: number;
  storeName: string;
  storeCount: number;
  checkedAt: string;
}

export function createMemoryAlertRepository(rackets: AlertRacket[], prices: Map<string, MemoryPrice> = new Map()) {
  const alerts: StoredAlert[] = [];
  let next = 1;
  const byId = (id: string) => alerts.find((alert) => alert.id === id);
  const setStatus = (id: string, from: AlertStatus[], to: AlertStatus) => {
    const alert = byId(id);
    if (alert && from.includes(alert.status)) alert.status = to;
  };

  const repository: AlertRepository = {
    async findOpen(racketId, email) {
      return (
        alerts.find(
          (alert) =>
            alert.racket.id === racketId && alert.email === email && ["pending", "active"].includes(alert.status),
        ) ?? null
      );
    },
    async findByToken(token) {
      return alerts.find((alert) => alert.token === token) ?? null;
    },
    async countRecent({ email, ipHash }, since) {
      return alerts.filter(
        (alert) =>
          alert.createdAt > since &&
          ((email !== undefined && alert.email === email) || (ipHash !== undefined && alert.ipHash === ipHash)),
      ).length;
    },
    async create(alert: NewAlert) {
      const racket = rackets.find((item) => item.id === alert.racketId);
      if (!racket) throw new Error("La pala no existe");
      const stored: StoredAlert = {
        id: String(next++),
        racket,
        email: alert.email,
        targetPrice: alert.targetPrice,
        status: "pending",
        token: alert.token,
        confirmationSentAt: null,
        ipHash: alert.ipHash,
        createdAt: alert.consentAt,
        notifiedPrice: null,
        closedAt: null,
      };
      alerts.push(stored);
      return stored;
    },
    async remove(id) {
      const index = alerts.findIndex((alert) => alert.id === id && alert.status === "pending");
      if (index >= 0) alerts.splice(index, 1);
    },
    async updateTarget(id, targetPrice) {
      const alert = byId(id);
      if (alert?.status === "pending") alert.targetPrice = targetPrice;
    },
    async markConfirmationSent(id, at) {
      const alert = byId(id);
      if (alert) alert.confirmationSentAt = at;
    },
    async confirm(id) {
      setStatus(id, ["pending"], "active");
    },
    async cancel(id, at) {
      const alert = byId(id);
      if (alert && ["pending", "active"].includes(alert.status)) Object.assign(alert, { status: "cancelled", closedAt: at });
    },
    async listDue(staleBefore) {
      return alerts.flatMap((alert): DueAlert[] => {
        const today = prices.get(alert.racket.id);
        if (alert.status !== "active" || !today || today.checkedAt <= staleBefore) return [];
        if (alert.targetPrice !== null && today.price > alert.targetPrice) return [];
        return [{ ...alert, price: today.price, storeName: today.storeName, storeCount: today.storeCount }];
      });
    },
    async markNotified(id, at, price) {
      const alert = byId(id);
      if (alert?.status === "active") Object.assign(alert, { status: "notified", notifiedPrice: price, closedAt: at });
    },
    async purge(closedBefore, pendingBefore) {
      const expired = (alert: StoredAlert) =>
        alert.status === "pending"
          ? alert.createdAt < pendingBefore
          : alert.status !== "active" && (alert.closedAt ?? alert.createdAt) < closedBefore;
      const before = alerts.length;
      for (let i = alerts.length - 1; i >= 0; i--) if (expired(alerts[i])) alerts.splice(i, 1);
      return before - alerts.length;
    },
  };

  return { repository, alerts, prices };
}
