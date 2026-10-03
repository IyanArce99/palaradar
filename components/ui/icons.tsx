interface IconProps {
  size?: number;
  className?: string;
}

interface LogoProps extends IconProps {
  /** Versión para fondos oscuros */
  inverse?: boolean;
}

/** Símbolo de PalaRadar: la P es una pala y la bola lima está en el punto dulce. */
export function Logo({ size = 32, inverse = false, className }: LogoProps) {
  const ink = inverse ? "#ffffff" : "#15171a";
  const cord = "M17 51 C 17.8 57.5, 26.5 59.5, 34 55.2 C 37.6 53.1, 39.6 50.4, 39.2 48";

  return (
    <svg
      width={size}
      height={size}
      viewBox="-0.5 -2.5 64 64"
      className={className}
      aria-hidden="true"
    >
      <rect x="11.5" y="3" width="11" height="48" rx="5.5" fill={ink} />
      <ellipse cx="35.5" cy="20.5" rx="13.25" ry="14.25" fill="none" stroke={ink} strokeWidth="10" />
      <circle cx="37" cy="19" r="5.6" fill="#c6ef3a" stroke={ink} strokeWidth="1.5" />
      <path d={cord} fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
      <path d={cord} fill="none" stroke="#c6ef3a" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="39.2" cy="48" r="2.8" fill={ink} />
    </svg>
  );
}

export function SearchIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" className={className} aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <line
        x1="11.5"
        y1="11.5"
        x2="16"
        y2="16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Icono del escáner: anillos de radar */
export function ScanIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}
