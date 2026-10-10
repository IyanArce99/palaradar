// Estadísticas del histórico por periodo e índice de oportunidad: de un periodo
// solo se habla si el seguimiento lo cubre, y un histórico corto nunca obtiene
// la misma confianza que uno completo.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  historyCoverage,
  INDEX_BASE,
  median,
  MIN_COVERAGE,
  opportunityIndex,
  periodStats,
} from "@/lib/price-stats";
import type { PricePoint } from "@/types/catalog";

const NOW = new Date("2026-11-30T10:00:00Z");
const DAY_MS = 86_400_000;

describe("mediana", () => {
  it("con un número par de valores es la media de los dos centrales, y no ordena la lista original", () => {
    const values = [50, 2];
    assert.equal(median(values), 26);
    assert.deepEqual(values, [50, 2]);
    assert.equal(median([1, 3, 30, 100]), 16.5);
    assert.equal(median([7]), 7);
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([]), null);
  });
});

/** Día de hace `ago` días, en ISO */
const day = (ago: number) => new Date(NOW.getTime() - ago * DAY_MS).toISOString().slice(0, 10);

/** Un precio por día desde hace `days` días hasta hoy; `price` recibe los días que faltan para hoy. */
function daily(days: number, price: (ago: number) => number, skip: (ago: number) => boolean = () => false): PricePoint[] {
  const points: PricePoint[] = [];
  for (let ago = days; ago >= 0; ago--) {
    if (!skip(ago)) points.push({ date: day(ago), price: price(ago) });
  }
  return points;
}

describe("estadísticas por periodo", () => {
  it("sin 30 días de seguimiento no hay estadísticas", () => {
    assert.equal(periodStats(daily(7, () => 200), 30, 200, NOW), null);
    assert.equal(periodStats([], 30, 200, NOW), null);
  });

  it("con el periodo cubierto da media, mínimo, máximo, variación y observaciones", () => {
    const history = daily(40, (ago) => (ago === 10 ? 180 : ago > 20 ? 220 : 200));
    const stats = periodStats(history, 30, 200, NOW);

    assert.ok(stats);
    // 30 días naturales, hoy incluido: nunca más observaciones que días.
    assert.equal(stats.observations, 30);
    assert.deepEqual(stats.min, { date: day(10), price: 180 });
    assert.equal(stats.max.price, 220);
    // 9 días a 220 (del 29 al 21), 20 a 200 y uno a 180
    assert.equal(stats.average, Math.round(((9 * 220 + 20 * 200 + 180) / 30) * 100) / 100);
    // Al empezar el periodo costaba 220 y hoy cuesta 200
    assert.equal(stats.changePercent, -9);
  });

  it("nunca cuenta más observaciones que días tiene el periodo", () => {
    const history = daily(200, () => 200);
    assert.equal(periodStats(history, 30, 200, NOW)?.observations, 30);
    assert.equal(periodStats(history, 90, 200, NOW)?.observations, 90);
  });

  it("el precio de hoy cuenta para el mínimo y el máximo aunque aún no esté en el histórico", () => {
    // Histórico plano a 200 hasta ayer; hoy la tienda la tiene a 180 y todavía no hay registro del día.
    const untilYesterday = daily(60, () => 200, (ago) => ago === 0);
    const stats = periodStats(untilYesterday, 30, 180, NOW);
    assert.deepEqual(stats?.min, { date: day(0), price: 180 });
    assert.equal(stats?.max.price, 200);

    const index = opportunityIndex(untilYesterday, 180, "current", NOW);
    assert.ok(index);
    assert.ok(index.reasons.includes("Es el precio más bajo que hemos registrado en ese periodo."));
    assert.ok(!index.reasons.includes("Su precio no ha cambiado en ese periodo."));
  });

  it("la variación parte del precio vigente al empezar el periodo, no del primer registro suelto", () => {
    // 250 hasta hace 40 días, un hueco, y 200 desde hace 14: al empezar el periodo seguía a 250.
    const history = daily(60, (ago) => (ago >= 40 ? 250 : 200), (ago) => ago < 40 && ago > 14);
    assert.equal(periodStats(history, 30, 200, NOW)?.changePercent, -20);
  });

  it("no mezcla periodos: 90 días necesita 90 días de seguimiento", () => {
    const history = daily(40, () => 200);
    assert.ok(periodStats(history, 30, 200, NOW));
    assert.equal(periodStats(history, 90, 200, NOW), null);
    assert.ok(periodStats(daily(95, () => 200), 90, 200, NOW));
  });

  it("con demasiados días sin precio no da estadísticas", () => {
    const minimum = Math.ceil(30 * MIN_COVERAGE);
    // Un precio hace 35 días y después solo unos pocos días sueltos
    const sparse = daily(35, () => 200, (ago) => ago !== 35 && ago >= minimum - 1);
    assert.equal(periodStats(sparse, 30, 200, NOW), null);
  });
});

describe("cuánto histórico hay", () => {
  it("cuenta los días de seguimiento y los que faltan para el veredicto", () => {
    assert.deepEqual(historyCoverage(daily(6, () => 200), NOW), {
      since: day(6),
      daysTracked: 7,
      observations: 7,
      daysUntilVerdict: 24,
    });
    assert.equal(historyCoverage(daily(45, () => 200), NOW)?.daysUntilVerdict, 0);
    assert.equal(historyCoverage([], NOW), null);
  });

  it("los días sin precio no cuentan como observaciones", () => {
    const coverage = historyCoverage(daily(9, () => 200, (ago) => ago % 2 === 0), NOW);
    assert.equal(coverage?.daysTracked, 10);
    assert.equal(coverage?.observations, 5);
  });
});

describe("índice de oportunidad", () => {
  it("no existe con pocos días de histórico ni con un precio sin confirmar", () => {
    assert.equal(opportunityIndex(daily(7, () => 200), 150, "current", NOW), null);
    assert.equal(opportunityIndex(daily(60, () => 200), 150, "stale", NOW), null);
  });

  it("un precio que no se ha movido es el precio habitual", () => {
    const index = opportunityIndex(daily(60, () => 200), 200, "current", NOW);
    assert.ok(index);
    assert.equal(index.score, INDEX_BASE);
    assert.equal(index.confidence, "alta");
    assert.ok(index.reasons.includes("Su precio no ha cambiado en ese periodo."));
  });

  it("sube cuando el precio está por debajo de su media y en su mínimo", () => {
    // 220 € casi todo el mes y 180 € desde ayer
    const history = daily(60, (ago) => (ago <= 1 ? 180 : 220));
    const index = opportunityIndex(history, 180, "current", NOW);

    assert.ok(index);
    // media ≈ 217,3: un 17 % por debajo (+30, con tope) + mínimo del periodo (+15) + ha bajado (+5)
    assert.equal(index.score, 100);
    assert.ok(index.reasons.includes("Está un 17 % por debajo de su precio medio de los últimos 30 días."));
    assert.ok(index.reasons.includes("Es el precio más bajo que hemos registrado en ese periodo."));
    assert.ok(index.reasons.includes("Ha bajado en la última semana."));
  });

  it("cada señal suma lo que dice la fórmula", () => {
    // 200 todo el mes salvo un día a 220 y otro a 180; hoy 190, sin cambio en la última semana.
    const history = daily(60, (ago) => (ago === 20 ? 220 : ago === 15 ? 180 : ago <= 8 ? 190 : 200));
    const index = opportunityIndex(history, 190, "current", NOW);
    assert.ok(index);
    const average = (20 * 200 + 220 + 180 + 9 * 190 - 200) / 30; // 30 días: 19 a 200, 220, 180 y 9 a 190
    const expected = 50 + ((average - 190) / average) * 100 * 2.5 + (15 - 30 * ((190 - 180) / (220 - 180)));
    assert.equal(index.score, Math.round(expected));
    assert.ok(!index.reasons.some((reason) => reason.includes("última semana")));
  });

  it("usa la media del veredicto cuando se le pasa, para decir el mismo porcentaje", () => {
    const history = daily(60, () => 200.49);
    assert.ok(opportunityIndex(history, 191.4, "current", NOW)?.reasons[0].includes("un 5 %"));
    assert.ok(opportunityIndex(history, 191.4, "current", NOW, 200)?.reasons[0].includes("un 4 %"));
  });

  it("no habla de la última semana si el precio de referencia es de hace un mes", () => {
    // 200 hasta hace 20 días, sin registros después, y 180 desde hace 6: no se sabe cuándo bajó.
    const history = daily(60, (ago) => (ago >= 20 ? 200 : 180), (ago) => ago < 20 && ago > 6);
    const index = opportunityIndex(history, 180, "current", NOW);
    assert.ok(index);
    assert.ok(!index.reasons.some((reason) => reason.includes("última semana")));
  });

  it("no existe con un precio que no es positivo", () => {
    assert.equal(opportunityIndex(daily(60, () => 200), 0, "current", NOW), null);
    assert.equal(opportunityIndex(daily(60, () => 200), -5, "current", NOW), null);
  });

  it("baja cuando el precio está por encima de lo que ha costado", () => {
    const history = daily(60, (ago) => (ago <= 1 ? 240 : 200));
    const index = opportunityIndex(history, 240, "current", NOW);

    assert.ok(index);
    // media ≈ 202,7: un 18 % por encima (−30, con tope) + máximo del periodo (−15) + ha subido (−5)
    assert.equal(index.score, 0);
    assert.ok(index.reasons.includes("Es el precio más alto que hemos registrado en ese periodo."));
    assert.ok(index.reasons.includes("Ha subido en la última semana."));
  });

  it("siempre queda entre 0 y 100", () => {
    const crash = opportunityIndex(daily(60, (ago) => (ago === 0 ? 20 : 300)), 20, "current", NOW);
    const spike = opportunityIndex(daily(60, (ago) => (ago === 0 ? 900 : 100)), 900, "current", NOW);
    assert.ok(crash && crash.score <= 100 && crash.score >= 0);
    assert.ok(spike && spike.score <= 100 && spike.score >= 0);
  });

  it("con huecos en el histórico o un precio no comprobado hoy, la confianza baja y se avisa", () => {
    const withGaps = daily(60, () => 200, (ago) => ago % 3 === 1);
    const gaps = opportunityIndex(withGaps, 200, "current", NOW);
    assert.ok(gaps);
    assert.notEqual(gaps.confidence, "alta");
    assert.ok(gaps.reasons.some((reason) => reason.includes("tómalo como orientación")));

    const recent = opportunityIndex(daily(60, () => 200), 200, "recent", NOW);
    assert.ok(recent);
    assert.equal(recent.confidence, "media");
    assert.ok(recent.reasons.some((reason) => reason.includes("confírmalo en la tienda")));
    assert.ok(!recent.reasons.some((reason) => reason.includes("tómalo como orientación")));

    // Con las dos cosas a la vez se dicen las dos, y el recuento nunca pasa de 30.
    const both = opportunityIndex(withGaps, 200, "recent", NOW);
    assert.ok(both);
    assert.ok(both.reasons.some((reason) => /Solo hay precio registrado en \d+ de los últimos 30 días/.test(reason)));
    assert.ok(both.reasons.some((reason) => reason.includes("confírmalo en la tienda")));
    const counted = Number(/en (\d+) de los/.exec(both.reasons.join(" "))?.[1]);
    assert.ok(counted > 0 && counted <= 30);
  });

  it("es reproducible", () => {
    const history = daily(60, (ago) => 200 + (ago % 5));
    assert.deepEqual(
      opportunityIndex(history, 198, "current", NOW),
      opportunityIndex(history, 198, "current", NOW),
    );
  });
});
