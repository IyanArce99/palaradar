// Comparación entre temporadas de un mismo modelo: qué cambia en lo que las dos
// declaran, qué se mantiene y cuánto cuesta hoy cada una. La relación entre
// temporadas la decide `sameModelSeasons` (lib/similar.ts): misma marca y mismo
// nombre de modelo, otro año. Aquí no se dice que una edición sea mejor que
// otra: solo se enfrentan datos declarados y precios vigentes.
import { buildSpecRows } from "@/lib/compare";
import { formatEuroCompact, formatPercent } from "@/lib/format";
import type { Pala } from "@/types/catalog";

export interface SeasonChange {
  label: string;
  /** Valor de la pala de la ficha */
  current: string;
  /** Valor de la otra temporada */
  other: string;
}

export interface SeasonPriceGap {
  current: number;
  other: number;
  /** Lo que cuesta de más (positivo) o de menos (negativo) la otra temporada, en euros */
  difference: number;
  /** La misma diferencia sobre el precio de la pala de la ficha, en tanto por ciento */
  percent: number;
}

export interface SeasonComparison {
  slug: string;
  model: string;
  year: number;
  /** Características que las dos declaran y no coinciden */
  changed: SeasonChange[];
  /** Características que las dos declaran y coinciden */
  same: string[];
  /** Características que solo declara una de las dos: no se pueden comparar */
  unknown: string[];
  /** null si alguna de las dos no tiene precio vigente */
  price: SeasonPriceGap | null;
  /** Tiendas con precio vigente de la otra temporada */
  storeCount: number;
  /** Frase de cierre; null si no hay precios para respaldarla */
  conclusion: string | null;
}

/** El año distingue a las temporadas: no es una característica que comparar. */
const SKIPPED_LABELS = new Set(["Año"]);

function currentPrice(pala: Pala): number | null {
  return pala.price && pala.price.freshness !== "stale" ? pala.price.current : null;
}

export function seasonPriceGap(current: Pala, other: Pala): SeasonPriceGap | null {
  const [a, b] = [currentPrice(current), currentPrice(other)];
  if (a === null || b === null || a <= 0) return null;
  const difference = Math.round((b - a) * 100) / 100;
  return { current: a, other: b, difference, percent: Math.round((difference / a) * 100) };
}

function conclusion(current: Pala, other: Pala, gap: SeasonPriceGap | null, changed: number, compared: number): string | null {
  if (!gap) return null;
  const euros = formatEuroCompact(Math.abs(Math.round(gap.difference)));
  const percent = formatPercent(Math.abs(gap.percent));
  const older = other.year < current.year;
  const edition = `La edición de ${other.year}`;

  if (Math.round(gap.difference) === 0) {
    return `${edition} cuesta hoy prácticamente lo mismo que la de ${current.year}.`;
  }
  // Un porcentaje que redondea a cero no dice nada: «1 € más (0 %)».
  const share = gap.percent === 0 ? "" : ` (${percent})`;
  const priceSentence = `${edition} cuesta hoy ${euros} ${gap.difference < 0 ? "menos" : "más"}${share}.`;
  if (compared === 0) return `${priceSentence} No tenemos características declaradas de las dos para compararlas.`;

  const specs =
    changed === 0
      ? "Las características declaradas que podemos comparar coinciden"
      : `Cambian ${changed} de las ${compared} características declaradas que podemos comparar`;
  // Solo se habla de «compensar» cuando la edición anterior es la barata: es el caso que ayuda a decidir.
  const advice = older && gap.difference < 0 ? "; revísalas para valorar si te compensa pagar la diferencia." : ".";
  return `${priceSentence} ${specs}${advice}`;
}

/** Enfrenta la pala de la ficha con otra temporada del mismo modelo. */
export function compareSeasons(current: Pala, other: Pala): SeasonComparison {
  const rows = buildSpecRows([current, other]).filter((row) => !SKIPPED_LABELS.has(row.label));
  const changed: SeasonChange[] = [];
  const same: string[] = [];
  const unknown: string[] = [];

  // «MultiEVA» y «MultiEva» son el mismo dato escrito de dos maneras: no es un cambio.
  // Solo se ignoran mayúsculas, espacios y guiones. Cualquier otro signo se conserva:
  // «38 mm» y «3.8 mm», o «3K» y «12K», no son lo mismo.
  const normalize = (value: string) => value.toLowerCase().replace(/[\s\-_]/g, "");
  const sameValue = (a: string, b: string) => a === b || (normalize(a) !== "" && normalize(a) === normalize(b));

  for (const row of rows) {
    const [a, b] = row.values;
    if (a === null || b === null) unknown.push(row.label);
    else if (sameValue(a, b)) same.push(row.label);
    else changed.push({ label: row.label, current: a, other: b });
  }

  const price = seasonPriceGap(current, other);
  return {
    slug: other.slug,
    model: other.model,
    year: other.year,
    changed,
    same,
    unknown,
    price,
    storeCount: currentPrice(other) === null ? 0 : (other.price?.storeCount ?? 0),
    conclusion: conclusion(current, other, price, changed.length, changed.length + same.length),
  };
}
