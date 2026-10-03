// Genera las ilustraciones provisionales de public/img: una por cada pala de la
// semilla, la de portada y las de guías. Son arte propio sin logotipos de marca,
// NO fotos del producto: se sustituyen cambiando `images` en los datos.
//   npm run art
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { brandSeeds } from "@/data/seed/brands";
import { slugify } from "@/data/seed/build";
import { racketSpecs } from "@/data/seed/rackets";
import type { PalaShape } from "@/types/catalog";

const OUT = join(process.cwd(), "public", "img");

const SHAPES: Record<PalaShape, { w: number; h: number; taper: number; power: number }> = {
  redonda: { w: 118, h: 122, taper: 0, power: 2 },
  lagrima: { w: 116, h: 128, taper: 0.1, power: 2.15 },
  diamante: { w: 120, h: 126, taper: 0.2, power: 2.5 },
};

interface Palette {
  frame: string;
  face: string;
  accent: string;
  grip: string;
  light: boolean;
}

// Paletas genéricas: no reproducen la estética real de ningún modelo.
const PALETTES: Palette[] = [
  { frame: "#15171a", face: "#22252a", accent: "#c6ef3a", grip: "#f1f1ee", light: false },
  { frame: "#e7e3d7", face: "#f5f2ea", accent: "#d9502b", grip: "#1d1f23", light: true },
  { frame: "#2a2d33", face: "#3a3e46", accent: "#e2452f", grip: "#15171a", light: false },
  { frame: "#f1f1ef", face: "#ffffff", accent: "#ff6a13", grip: "#15171a", light: true },
  { frame: "#b9c0cb", face: "#d3d8e0", accent: "#1f4fd8", grip: "#f1f1ee", light: true },
  { frame: "#101216", face: "#1b1e24", accent: "#ffd21f", grip: "#ffd21f", light: false },
  { frame: "#173468", face: "#1f4489", accent: "#ff5d7a", grip: "#f1f1ee", light: false },
  { frame: "#1d3b2f", face: "#28523f", accent: "#9be7c4", grip: "#f1f1ee", light: false },
  { frame: "#4a1f3d", face: "#662a54", accent: "#ffb347", grip: "#f1f1ee", light: false },
];

interface ArtPala extends Palette {
  slug: string;
  shape: PalaShape;
}

const brandNames = new Map(brandSeeds.map((brand) => [brand.slug, brand.name]));

const palas: ArtPala[] = racketSpecs.map((spec, index) => ({
  slug: slugify(`${brandNames.get(spec.brand) ?? spec.brand} ${spec.model} ${spec.year}`),
  shape: spec.shape,
  ...PALETTES[index % PALETTES.length],
}));

const n = (value: number) => Number(value.toFixed(1));

/** Contorno de la cabeza: superelipse que se ensancha hacia arriba según la forma. */
function headPath(shape: PalaShape, scale = 1): string {
  const { w, h, taper, power } = SHAPES[shape];
  const exp = 2 / power;
  const points: string[] = [];
  for (let i = 0; i < 72; i++) {
    const t = (2 * Math.PI * i) / 72;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = Math.sign(c) * Math.abs(c) ** exp * w * (1 - taper * s) * scale;
    const y = Math.sign(s) * Math.abs(s) ** exp * h * scale;
    points.push(`${n(x)} ${n(y)}`);
  }
  return `M${points.join(" L")} Z`;
}

/** Agujeros de la cara, solo en la zona central. */
function holes(shape: PalaShape, color: string): string {
  const { w, h } = SHAPES[shape];
  const dots: string[] = [];
  for (let row = -4; row <= 4; row++) {
    for (let col = -4; col <= 4; col++) {
      const x = col * 22 + (row % 2 ? 11 : 0);
      const y = row * 20 + 6;
      if ((x / (w * 0.6)) ** 2 + (y / (h * 0.6)) ** 2 < 1) {
        dots.push(`<circle cx="${x}" cy="${y}" r="4.6"/>`);
      }
    }
  }
  return `<g fill="${color}">${dots.join("")}</g>`;
}

/** Una pala centrada en la cabeza (0,0). `id` hace únicos los clipPath. */
function pala(p: ArtPala, id: string): string {
  const { h } = SHAPES[p.shape];
  const throatTop = h - 42;
  const handleTop = h + 72;
  const handleBottom = handleTop + 118;
  const wraps = Array.from({ length: 7 }, (_, i) => {
    const y = handleTop + 12 + i * 15;
    return `<path d="M-19 ${y + 9} L19 ${y}" />`;
  }).join("");

  return `
  <g>
    <path d="M-19 ${handleBottom - 6} C -34 ${handleBottom + 30}, 26 ${handleBottom + 40}, 16 ${handleBottom - 2}" fill="none" stroke="${p.accent}" stroke-width="5" stroke-linecap="round"/>
    <path fill-rule="evenodd" fill="${p.frame}" d="M-74 ${throatTop} L74 ${throatTop} L21 ${handleTop + 8} L-21 ${handleTop + 8} Z M-31 ${h + 10} L31 ${h + 10} L0 ${h + 58} Z"/>
    <rect x="-19" y="${handleTop}" width="38" height="${handleBottom - handleTop}" rx="9" fill="${p.grip}"/>
    <g stroke="${p.light ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.16)"}" stroke-width="2.5" clip-path="url(#${id}-grip)">${wraps}</g>
    <rect x="-21" y="${handleBottom - 12}" width="42" height="14" rx="6" fill="${p.frame}"/>
    <path d="${headPath(p.shape)}" fill="${p.frame}"/>
    <path d="${headPath(p.shape, 0.9)}" fill="${p.face}"/>
    <g clip-path="url(#${id}-face)">
      <path d="M-170 70 L170 -64 L170 -18 L-170 116 Z" fill="${p.accent}"/>
      <path d="M-170 128 L170 -6 L170 6 L-170 140 Z" fill="${p.accent}" opacity=".45"/>
      <path d="M-150 -150 L-20 -150 L-110 150 L-150 150 Z" fill="#fff" opacity="${p.light ? 0.35 : 0.07}"/>
    </g>
    ${holes(p.shape, p.light ? "rgba(21,23,26,.3)" : "rgba(0,0,0,.45)")}
  </g>`;
}

function palaDefs(p: ArtPala, id: string): string {
  const { h } = SHAPES[p.shape];
  return `<clipPath id="${id}-face"><path d="${headPath(p.shape, 0.9)}"/></clipPath>
  <clipPath id="${id}-grip"><rect x="-19" y="${h + 72}" width="38" height="112" rx="9"/></clipPath>`;
}

const SHADOW = `<filter id="shadow" x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#15171a" flood-opacity=".2"/></filter>`;

interface Part {
  defs: string;
  body: string;
}

function ball(x: number, y: number, r = 22): Part {
  return {
    defs: "",
    body: `<g transform="translate(${x} ${y})">
    <ellipse cy="${r * 1.05}" rx="${r * 0.9}" ry="${r * 0.22}" fill="#15171a" opacity=".14"/>
    <circle r="${r}" fill="#c6ef3a"/>
    <path d="M${-r * 0.9} ${-r * 0.35} C ${-r * 0.2} ${-r * 0.1}, ${-r * 0.2} ${r * 0.9}, ${-r * 0.55} ${r * 0.82}" fill="none" stroke="#f7fde6" stroke-width="2.5"/>
    <path d="M${r * 0.9} ${r * 0.35} C ${r * 0.2} ${r * 0.1}, ${r * 0.2} ${-r * 0.9}, ${r * 0.55} ${-r * 0.82}" fill="none" stroke="#f7fde6" stroke-width="2.5"/>
  </g>`,
  };
}

/** Coloca una pala: posición del centro de la cabeza, giro y escala. */
function placed(p: ArtPala, id: string, x: number, y: number, rotate: number, scale: number): Part {
  return {
    defs: palaDefs(p, id),
    body: `<g transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})" filter="url(#shadow)">${pala(p, id)}</g>`,
  };
}

function svg(width: number, height: number, parts: Part[], background = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <defs>${SHADOW}${parts.map((part) => part.defs).join("")}</defs>
  ${background}${parts.map((part) => part.body).join("")}
</svg>
`;
}

function write(name: string, content: string): void {
  const file = join(OUT, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

/** Primera pala de cada forma, para las composiciones de portada y guías. */
function firstOf(shape: PalaShape, skip = 0): ArtPala {
  const matches = palas.filter((p) => p.shape === shape);
  return matches[skip % matches.length] ?? palas[0];
}

// Una imagen por pala, sobre fondo transparente
for (const p of palas) {
  write(`palas/${p.slug}.svg`, svg(340, 460, [placed(p, "p", 176, 138, 8, 0.88)]));
}

// Portada: tres palas en abanico
write(
  "hero-palas.svg",
  svg(640, 520, [
    placed(firstOf("lagrima"), "a", 190, 190, -20, 0.82),
    placed(firstOf("redonda"), "b", 462, 186, 22, 0.82),
    placed(firstOf("diamante"), "c", 326, 172, 4, 1),
    ball(520, 420, 26),
    ball(110, 440, 20),
  ]),
);

const courtLines = (color: string) =>
  `<g fill="none" stroke="${color}" stroke-width="3"><path d="M40 270 H560 M300 40 V270 M40 120 H560"/><rect x="40" y="40" width="520" height="320"/></g>`;

// Guías
write(
  "guias/mejores-palas-padel-2026.svg",
  svg(
    600,
    400,
    [
      placed(firstOf("diamante", 1), "a", 170, 150, -16, 0.62),
      placed(firstOf("lagrima", 1), "b", 430, 150, 16, 0.62),
      placed(firstOf("diamante"), "c", 300, 140, 0, 0.72),
    ],
    `<rect width="600" height="400" fill="#e6eadb"/>`,
  ),
);
write(
  "guias/mejores-palas-nivel-intermedio.svg",
  svg(
    600,
    400,
    [placed(firstOf("lagrima"), "a", 300, 140, 24, 0.74), ball(140, 290, 24)],
    `<rect width="600" height="400" fill="#15171a"/>${courtLines("rgba(198,239,58,.35)")}`,
  ),
);
write(
  "guias/palas-menos-de-150-euros.svg",
  svg(
    600,
    400,
    [placed(firstOf("redonda"), "a", 290, 140, -18, 0.74), ball(455, 300, 24), ball(505, 250, 16)],
    `<rect width="600" height="400" fill="#eefbc9"/>`,
  ),
);

console.log(`${palas.length} ilustraciones de pala generadas en ${OUT}`);
