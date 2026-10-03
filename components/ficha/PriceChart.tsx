import { cn } from "@/lib/cn";
import { formatEuro, formatEuroCompact, formatMonthYearShort } from "@/lib/format";
import { chartSeries } from "@/lib/pricing";
import type { PricePoint } from "@/types/catalog";
import type { PriceSummary } from "@/types/pricing";

const PAD_TOP = 26;
const PAD_BOTTOM = 24;
const PAD_RIGHT = 8;

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
 * media de 90 días (punteada) y mínimo histórico (discontinua). La serie llega
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
  const x = (i: number) => (i * innerWidth) / (points.length - 1);
  const y = (value: number) => PAD_TOP + innerHeight * (1 - (value - low) / (high - low));

  const line = points
    .map((point, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(point.price).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${innerWidth} ${baseline} L0 ${baseline} Z`;

  const first = points[0];
  const last = points[points.length - 1];
  const lastX = x(points.length - 1);
  const lastY = y(last.price);
  const endsToday = !price.isStale;
  const { average90, historicalMin } = price;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={
        endsToday
          ? `Evolución del precio en los últimos ${months} meses. Hoy cuesta ${formatEuro(last.price)}.`
          : `Evolución del precio en los últimos ${months} meses. Último precio registrado: ${formatEuro(last.price)}.`
      }
      className={cn("w-full font-sans", className)}
    >
      <path d={area} fill="#f2f9de" />
      {average90 !== null && (
        <>
          <line
            x1="0"
            x2={innerWidth}
            y1={y(average90)}
            y2={y(average90)}
            stroke="#9a9f95"
            strokeDasharray="2 4"
          />
          <text x="4" y={y(average90) - 8} fontSize="12" fill="#5b6058" {...LABEL_HALO}>
            Media 90 días · {formatEuroCompact(average90)}
          </text>
        </>
      )}
      {historicalMin && (
        <>
          <line
            x1="0"
            x2={innerWidth}
            y1={y(historicalMin.price)}
            y2={y(historicalMin.price)}
            stroke="#7fb800"
            strokeDasharray="5 4"
          />
          <text
            x="4"
            y={y(historicalMin.price) + 16}
            fontSize="12"
            fontWeight="700"
            fill="#3b6a00"
            {...LABEL_HALO}
          >
            Mínimo histórico · {formatEuroCompact(historicalMin.price)}
          </text>
        </>
      )}
      <path d={line} fill="none" stroke="#15171a" strokeWidth="2.5" strokeLinejoin="round" />
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
        {formatMonthYearShort(first.date)}
      </text>
      <text x={innerWidth} y={height - 4} fontSize="12" fill="#5b6058" textAnchor="end">
        {endsToday ? "hoy" : formatMonthYearShort(last.date)}
      </text>
    </svg>
  );
}
