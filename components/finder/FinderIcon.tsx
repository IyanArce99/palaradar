// Iconos de las respuestas del quiz: formas geométricas sobre una caja de 44×44,
// tal y como las define el diseño (barras de nivel, diana, media pista, siluetas
// de pala, círculo de llenado para el tacto y monedas). Sin librería de iconos ni emoji.
import type { CSSProperties } from "react";

const INK = "#15171a";
const LIME = "#c6ef3a";
const OFF = "#e3e5df";

interface PartOptions {
  r?: string;
  bg?: string;
  bd?: string;
  tf?: string;
}

function part(left: number, top: number, width: number, height: number, options: PartOptions = {}): CSSProperties {
  return {
    left,
    top,
    width,
    height,
    borderRadius: options.r ?? 0,
    background: options.bg ?? "transparent",
    border: options.bd ?? "none",
    transform: options.tf ?? "none",
  };
}

function racket(radius: string): CSSProperties[] {
  return [
    part(11, 4, 22, 26, { r: radius, bd: `2.5px solid ${INK}` }),
    part(19.5, 29, 5, 11, { r: "0 0 3px 3px", bg: INK }),
  ];
}

const ring = part(8, 8, 28, 28, { r: "50%", bd: `3px solid ${INK}` });
const dot = part(18, 18, 8, 8, { r: "50%", bg: INK });

/** Piezas del icono de la opción `option` de la pregunta `question`. */
function iconParts(question: number, option: number): CSSProperties[] {
  switch (question) {
    case 0:
      return [0, 1, 2, 3].map((i) =>
        part(7 + i * 8, 34 - (8 + i * 6), 6, 8 + i * 6, { r: "2px", bg: i <= option ? INK : OFF }),
      );
    case 1:
      return [
        [ring, dot],
        [ring, part(8, 8, 14, 28, { r: "14px 0 0 14px", bg: INK })],
        [part(8, 8, 28, 28, { r: "50%", bg: LIME, bd: `3px solid ${INK}` }), dot],
      ][option];
    case 2: {
      const court = [part(6, 10, 32, 24, { r: "4px", bd: `2px solid ${INK}` }), part(21, 10, 2, 24, { bg: INK })];
      if (option === 2) return [part(6, 10, 32, 24, { r: "4px", bg: LIME }), ...court];
      const half = option === 0 ? part(22, 10, 16, 24, { r: "0 4px 4px 0", bg: LIME }) : part(6, 10, 16, 24, { r: "4px 0 0 4px", bg: LIME });
      return [half, ...court];
    }
    case 3:
      return [
        racket("50%"),
        racket("50% 50% 45% 45% / 62% 62% 38% 38%"),
        [
          part(13, 6, 18, 18, { r: "3px", bd: `2.5px solid ${INK}`, tf: "rotate(45deg)" }),
          part(19.5, 27, 5, 13, { r: "0 0 3px 3px", bg: INK }),
        ],
        [8, 18.5, 29].map((left) => part(left, 19, 7, 7, { r: "50%", bg: INK })),
      ][option];
    case 4:
      // Tacto: el círculo se llena a medida que la pala es más firme.
      return [
        [ring],
        [ring, part(11, 27, 22, 6, { r: "0 0 11px 11px", bg: LIME })],
        [ring, part(11, 22, 22, 11, { r: "0 0 11px 11px", bg: LIME })],
        [part(8, 8, 28, 28, { r: "50%", bg: LIME, bd: `3px solid ${INK}` })],
        [8, 18.5, 29].map((left) => part(left, 19, 7, 7, { r: "50%", bg: INK })),
      ][option];
    default:
      return Array.from({ length: option + 1 }, (_, i) =>
        part(8 + i * 7, 15, 14, 14, { r: "50%", bg: i === option ? LIME : "#fff", bd: `2px solid ${INK}` }),
      );
  }
}

interface FinderIconProps {
  question: number;
  option: number;
  selected: boolean;
}

export function FinderIcon({ question, option, selected }: FinderIconProps) {
  return (
    <span
      aria-hidden="true"
      className={`relative block size-11 rounded-xl ${selected ? "bg-white" : "bg-mist"}`}
    >
      {iconParts(question, option).map((style, i) => (
        <span key={i} className="absolute box-border block" style={style} />
      ))}
    </span>
  );
}
