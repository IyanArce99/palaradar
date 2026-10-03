// Genera las ilustraciones provisionales de public/img (palas, portada y guías).
// Son arte propio sin logotipos de marca: se sustituyen por recortes reales de
// producto cambiando las rutas en los datos. Uso: node scripts/generate-art.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "img");

const SHAPES = {
  redonda: { w: 118, h: 122, taper: 0, power: 2 },
  lagrima: { w: 116, h: 128, taper: 0.1, power: 2.15 },
  diamante: { w: 120, h: 126, taper: 0.2, power: 2.5 },
};

const PALAS = [
  { slug: "bullpadel-vertex-04-2026", shape: "diamante", frame: "#15171a", face: "#22252a", accent: "#c6ef3a", grip: "#f1f1ee", light: false },
  { slug: "nox-at10-genius-18k-2026", shape: "lagrima", frame: "#e7e3d7", face: "#f5f2ea", accent: "#d9502b", grip: "#1d1f23", light: true },
  { slug: "adidas-metalbone-3-4-2025", shape: "diamante", frame: "#2a2d33", face: "#3a3e46", accent: "#e2452f", grip: "#15171a", light: false },
  { slug: "head-speed-pro-2025", shape: "lagrima", frame: "#f1f1ef", face: "#ffffff", accent: "#ff6a13", grip: "#15171a", light: true },
  { slug: "nox-ml10-pro-cup-2026", shape: "redonda", frame: "#b9c0cb", face: "#d3d8e0", accent: "#1f4fd8", grip: "#f1f1ee", light: true },
  { slug: "siux-electra-st3-pro-2026", shape: "diamante", frame: "#101216", face: "#1b1e24", accent: "#ffd21f", grip: "#ffd21f", light: false },
  { slug: "starvie-triton-pro-2026", shape: "lagrima", frame: "#173468", face: "#1f4489", accent: "#ff5d7a", grip: "#f1f1ee", light: false },
];

const bySlug = Object.fromEntries(PALAS.map((p) => [p.slug, p]));
const n = (value) => Number(value.toFixed(1));

/** Contorno de la cabeza: superelipse que se ensancha hacia arriba según la forma. */
function headPath(shape, scale = 1) {
  const { w, h, taper, power } = SHAPES[shape];
  const exp = 2 / power;
  const points = [];
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
function holes(shape, color) {
  const { w, h } = SHAPES[shape];
  const dots = [];
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
function pala(p, id) {
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

function palaDefs(p, id) {
  const { h } = SHAPES[p.shape];
  return `<clipPath id="${id}-face"><path d="${headPath(p.shape, 0.9)}"/></clipPath>
  <clipPath id="${id}-grip"><rect x="-19" y="${h + 72}" width="38" height="112" rx="9"/></clipPath>`;
}

const SHADOW = `<filter id="shadow" x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#15171a" flood-opacity=".2"/></filter>`;

function ball(x, y, r = 22) {
  return `<g transform="translate(${x} ${y})">
    <ellipse cy="${r * 1.05}" rx="${r * 0.9}" ry="${r * 0.22}" fill="#15171a" opacity=".14"/>
    <circle r="${r}" fill="#c6ef3a"/>
    <path d="M${-r * 0.9} ${-r * 0.35} C ${-r * 0.2} ${-r * 0.1}, ${-r * 0.2} ${r * 0.9}, ${-r * 0.55} ${r * 0.82}" fill="none" stroke="#f7fde6" stroke-width="2.5"/>
    <path d="M${r * 0.9} ${r * 0.35} C ${r * 0.2} ${r * 0.1}, ${r * 0.2} ${-r * 0.9}, ${r * 0.55} ${-r * 0.82}" fill="none" stroke="#f7fde6" stroke-width="2.5"/>
  </g>`;
}

/** Coloca una pala: posición del centro de la cabeza, giro y escala. */
function placed(slug, id, x, y, rotate, scale) {
  const p = bySlug[slug];
  return {
    defs: palaDefs(p, id),
    body: `<g transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})" filter="url(#shadow)">${pala(p, id)}</g>`,
  };
}

function svg(width, height, parts, background = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <defs>${SHADOW}${parts.map((part) => part.defs ?? "").join("")}</defs>
  ${background}${parts.map((part) => part.body ?? part).join("")}
</svg>
`;
}

function write(name, content) {
  const file = join(OUT, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

// Una imagen por pala, sobre fondo transparente
for (const p of PALAS) {
  write(`palas/${p.slug}.svg`, svg(340, 460, [placed(p.slug, "p", 176, 138, 8, 0.88)]));
}

// Portada: tres palas en abanico
write(
  "hero-palas.svg",
  svg(640, 520, [
    placed("nox-at10-genius-18k-2026", "a", 190, 190, -20, 0.82),
    placed("starvie-triton-pro-2026", "b", 462, 186, 22, 0.82),
    placed("bullpadel-vertex-04-2026", "c", 326, 172, 4, 1),
    ball(520, 420, 26),
    ball(110, 440, 20),
  ]),
);

const courtLines = (color) =>
  `<g fill="none" stroke="${color}" stroke-width="3"><path d="M40 270 H560 M300 40 V270 M40 120 H560"/><rect x="40" y="40" width="520" height="320"/></g>`;

// Guías
write(
  "guias/mejores-palas-padel-2026.svg",
  svg(
    600,
    400,
    [
      placed("adidas-metalbone-3-4-2025", "a", 170, 150, -16, 0.62),
      placed("head-speed-pro-2025", "b", 430, 150, 16, 0.62),
      placed("bullpadel-vertex-04-2026", "c", 300, 140, 0, 0.72),
    ],
    `<rect width="600" height="400" fill="#e6eadb"/>`,
  ),
);
write(
  "guias/mejores-palas-nivel-intermedio.svg",
  svg(
    600,
    400,
    [placed("nox-at10-genius-18k-2026", "a", 300, 140, 24, 0.74), ball(140, 290, 24)],
    `<rect width="600" height="400" fill="#15171a"/>${courtLines("rgba(198,239,58,.35)")}`,
  ),
);
write(
  "guias/palas-menos-de-150-euros.svg",
  svg(
    600,
    400,
    [placed("nox-ml10-pro-cup-2026", "a", 290, 140, -18, 0.74), ball(455, 300, 24), ball(505, 250, 16)],
    `<rect width="600" height="400" fill="#eefbc9"/>`,
  ),
);

console.log(`Ilustraciones generadas en ${OUT}`);
