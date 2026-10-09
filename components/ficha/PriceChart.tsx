import { cn } from "@/lib/cn";
import { formatDayMonthShort, formatEuro, formatEuroCompact, formatMonthYearShort } from "@/lib/format";
import { chartSeries } from "@/lib/pricing";
import type { PricePoint } from "@/types/catalog";
import type { PriceSummary } from "@/types/pricing";

const PAD_TOP = 26;
const PAD_BOTTOM = 24;
const PAD_RIGHT = 8;
/** Hasta este número de registros se dibuja un punto por día */
const MAX_DAY_MARKS = 45;

// Halo blanco para que las etiquetas se lean cuando la línea de precio pasa por debajo.
const LABEL_HALO = {
  paintOrder: "stroke",
  stroke: "#fff",
  strokeWidth: 4,
  strokeLinejoin: "round",
} as const;

interface PriceChartProps {
  /** Mejor precio de cada día, en orden cronológico */
  history: PricePoint[];
  price: PriceSummary;
  /** Meses que se muestran, contados desde hoy */
  months: number;
  width: number;
  height: number;
  className?: string;
}

/**
 * Evolución del precio como SVG renderizado en servidor: línea de precio,
 * media (punteada) y mínimo (discontinua) de los últimos 30 días, que solo se
 * dibujan cuando hay histórico suficiente para calcularlos. La serie llega
 * hasta hoy solo si el precio está al día; si no, termina en el último registro.
 */
export function PriceChart({ history, price, months, width, height, className }: PriceChartProps) {
  const points = chartSeries(history, price, months);
  if (points.length < 2) return null;

  // Escala común a todos los rangos, calculada sobre el histórico completo.
  const prices = [...history.map((point) => point.price), price.current];
  const low = Math.floor((Math.min(...prices) * 0.92) / 10) * 10;
  const high = Math.ceil((Math.max(...prices) * 1.03) / 10) * 10;

  const innerHeight = height - PAD_TOP - PAD_BOTTOM;
  const innerWidth = width - PAD_RIGHT;
  const baseline = PAD_TOP + innerHeight;
  // Eje de tiempo real: cada registro va en su día, así que un día sin dato deja su hueco.
  const time = (point: PricePoint) => Date.parse(`${point.date.slice(0, 10)}T00:00:00Z`);
  const start = time(points[0]);
  const span = time(points[points.length - 1]) - start;
  const x = (i: number) =>
    span > 0 ? ((time(points[i]) - start) / span) * innerWidth : (i * innerWidth) / (points.length - 1);
  const y = (value: number) => PAD_TOP + innerHeight * (1 - (value - low) / (high - low));
  // Con pocos registros se marca cada día; con muchos, la línea basta.
  const showDays = points.length <= MAX_DAY_MARKS;
  // En rangos cortos las fechas del eje llevan el día; en los largos, el mes.
  const axisDate = months <= 3 ? formatDayMonthShort : formatMonthYearShort;

  const line = points
    .map((point, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(point.price).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${innerWidth} ${baseline} L0 ${baseline} Z`;

  const first = points[0];
  const last = points[points.length - 1];
  const lastX = x(points.length - 1);
  const lastY = y(last.price);
  const endsToday = price.freshness === "current";
  const period = months === 1 ? "el último mes" : `los últimos ${months} meses`;
  const { average30, min30 } = price;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={
        endsToday
          ? `Evolución diaria del precio en ${period}. Hoy cuesta ${formatEuro(last.price)}.`
          : `Evolución diaria del precio en ${period}. Último precio registrado: ${formatEuro(last.price)}.`
      }
      // Los puntos del primer y del último día sobresalen medio radio del lienzo.
      className={cn("w-full overflow-visible font-sans", className)}
    >
      <path d={area} fill="#f2f9de" />
      {average30 !== null && (
        <>
          <line
            x1="0"
            x2={innerWidth}
            y1={y(average30)}
            y2={y(average30)}
            stroke="#9a9f95"
            strokeDasharray="2 4"
          />
          <text x="4" y={y(average30) - 8} fontSize="12" fill="#5b6058" {...LABEL_HALO}>
            Media 30 días · {formatEuroCompact(average30)}
          </text>
        </>
      )}
      {min30 && (
        <>
          <line
            x1="0"
            x2={innerWidth}
            y1={y(min30.price)}
            y2={y(min30.price)}
            stroke="#7fb800"
            strokeDasharray="5 4"
          />
          <text
            x="4"
            y={y(min30.price) + 16}
            fontSize="12"
            fontWeight="700"
            fill="#3b6a00"
            {...LABEL_HALO}
          >
            Mínimo 30 días · {formatEuroCompact(min30.price)}
          </text>
        </>
      )}
      <path d={line} fill="none" stroke="#15171a" strokeWidth="2.5" strokeLinejoin="round" />
      {showDays &&
        points.slice(0, -1).map((point, i) => (
          <circle key={point.date} cx={x(i)} cy={y(point.price)} r="3" fill="#fff" stroke="#15171a" strokeWidth="1.5">
            <title>{`${formatDayMonthShort(point.date)} · ${formatEuro(point.price)}`}</title>
          </circle>
        ))}
      <circle
        cx={lastX}
        cy={lastY}
        r="6"
        fill={endsToday ? "#c6ef3a" : "#c9ccc3"}
        stroke="#15171a"
        strokeWidth="2"
      />
      <text
        x={lastX - 12}
        y={lastY - 12}
        fontSize="13"
        fontWeight="800"
        textAnchor="end"
        {...LABEL_HALO}
      >
        {endsToday ? "Hoy" : "Último"} · {formatEuro(last.price)}
      </text>
      <text x="0" y={height - 4} fontSize="12" fill="#5b6058">
        {axisDate(first.date)}
      </text>
      <text x={innerWidth} y={height - 4} fontSize="12" fill="#5b6058" textAnchor="end">
        {endsToday ? "hoy" : axisDate(last.date)}
      </text>
    </svg>
  );
}
