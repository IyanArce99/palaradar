// Controles técnicos de una imagen de producto: que sea una imagen válida, sus
// dimensiones, su fondo y cuánto ocupa la pala. Con eso se decide si puede
// publicarse (verified), si no sirve (rejected) o si hay que mirarla (pending).
//
// Lo que NO se puede comprobar aquí —un precio, un texto promocional o una marca
// de agua sobre fondo blanco— queda para la revisión manual.
import sharp from "sharp";
import type { VerificationStatus } from "@/lib/media";

/** Lado corto mínimo para publicar una imagen, en listados y en la ficha */
export const MIN_SHORT_SIDE = 500;
/** Lado corto preferido para la imagen principal */
export const PREFERRED_SHORT_SIDE = 800;
/** Por debajo de esto no sirve ni para una tarjeta */
export const MIN_USABLE_SIDE = 300;

const FORMATS = { jpeg: "jpg", png: "png", webp: "webp", avif: "avif" } as const;
type Format = keyof typeof FORMATS;
type Background = "white" | "transparent" | "light" | "other";

// El análisis se hace sobre una copia reducida: basta para ver fondo y encuadre.
const SAMPLE_SIDE = 256;
const WHITE_LEVEL = 244;
// Gris claro y neutro: fondo de estudio de algunas marcas. Se publica, pero
// sobre el marco de la web puede notarse el recuadro de la imagen.
const LIGHT_LEVEL = 200;
const NEUTRAL_SPREAD = 16;
/** Cuánto puede apartarse un píxel del color del fondo gris y seguir siendo fondo */
const LIGHT_TOLERANCE = 14;
const TRANSPARENT_ALPHA = 16;
/** Tamaño de cada esquina analizada, en proporción al lado */
const CORNER_SHARE = 0.07;
const BACKGROUND_CORNER_SHARE = 0.97;
/** Esquinas que deben ser fondo para dar el fondo por bueno */
const MIN_BACKGROUND_CORNERS = 3;
/** Parte de un borde ocupada por la pala a partir de la cual se da por cortada */
const CUT_EDGE_SHARE = 0.3;
// Una pala de frente mide ≈ 26 × 45,5 cm (1,75). Se deja margen para el cordón.
const MIN_CONTENT_ASPECT = 1.25;
const MAX_CONTENT_ASPECT = 2.6;

export interface ImageInspection {
  format: Format;
  /** Extensión con la que se guarda la copia */
  extension: string;
  width: number;
  height: number;
  /** Fondo de la imagen, leído en sus esquinas */
  background: Background;
  /** Caja que ocupa lo que no es fondo, en proporción a la imagen (0–1); null si está vacía */
  content: { left: number; top: number; width: number; height: number; aspect: number } | null;
  /** La pala ocupa buena parte de algún borde: está cortada */
  touchesEdge: boolean;
}

/**
 * Lee el fondo en las cuatro esquinas (ahí nunca llega una pala bien encuadrada)
 * y devuelve su tipo y la prueba que dice si un píxel es fondo.
 */
function readBackground(data: Buffer, w: number, h: number) {
  const cornerW = Math.max(2, Math.round(w * CORNER_SHARE));
  const cornerH = Math.max(2, Math.round(h * CORNER_SHARE));
  // Cada esquina por separado: el cordón o la etiqueta pueden invadir una.
  const corners = [0, 1, 2, 3].map(() => ({ total: 0, transparent: 0, white: 0, light: 0, sum: [0, 0, 0] }));

  for (let y = 0; y < h; y++) {
    if (y >= cornerH && y < h - cornerH) continue;
    for (let x = 0; x < w; x++) {
      if (x >= cornerW && x < w - cornerW) continue;
      const corner = corners[(y < cornerH ? 0 : 2) + (x < cornerW ? 0 : 1)];
      const i = (y * w + x) * 4;
      corner.total++;
      if (data[i + 3] < TRANSPARENT_ALPHA) {
        corner.transparent++;
        continue;
      }
      const low = Math.min(data[i], data[i + 1], data[i + 2]);
      const high = Math.max(data[i], data[i + 1], data[i + 2]);
      if (low >= WHITE_LEVEL) corner.white++;
      else if (low >= LIGHT_LEVEL && high - low <= NEUTRAL_SPREAD) corner.light++;
      else continue;
      for (let c = 0; c < 3; c++) corner.sum[c] += data[i + c];
    }
  }

  const isWhite = (i: number) =>
    data[i + 3] < TRANSPARENT_ALPHA ||
    (data[i] >= WHITE_LEVEL && data[i + 1] >= WHITE_LEVEL && data[i + 2] >= WHITE_LEVEL);

  const whiteCorners = corners.filter(
    (corner) => (corner.white + corner.transparent) / corner.total >= BACKGROUND_CORNER_SHARE,
  );
  if (whiteCorners.length >= MIN_BACKGROUND_CORNERS) {
    const transparent = whiteCorners.reduce((n, corner) => n + corner.transparent, 0);
    const white = whiteCorners.reduce((n, corner) => n + corner.white, 0);
    const kind: Background = transparent > white ? "transparent" : "white";
    return { kind, isBackground: isWhite };
  }

  const lightCorners = corners.filter(
    (corner) => (corner.white + corner.light + corner.transparent) / corner.total >= BACKGROUND_CORNER_SHARE,
  );
  if (lightCorners.length >= MIN_BACKGROUND_CORNERS) {
    const pixels = lightCorners.reduce((n, corner) => n + corner.white + corner.light, 0);
    const tone = [0, 1, 2].map((c) => lightCorners.reduce((n, corner) => n + corner.sum[c], 0) / pixels);
    const isBackground = (i: number) =>
      isWhite(i) || [0, 1, 2].every((c) => Math.abs(data[i + c] - tone[c]) <= LIGHT_TOLERANCE);
    return { kind: "light" as Background, isBackground };
  }
  return { kind: "other" as Background, isBackground: isWhite };
}

/** Analiza los bytes de una imagen. null si no es un JPG, PNG, WebP o AVIF que se pueda abrir. */
export async function inspectImage(bytes: Buffer): Promise<ImageInspection | null> {
  const decoded = await decode(bytes);
  if (!decoded) return null;

  const { format, width, height, data, info } = decoded;
  const w = info.width;
  const h = info.height;
  const { kind: background, isBackground } = readBackground(data, w, h);
  let left = w;
  let top = h;
  let right = -1;
  let bottom = -1;
  // Píxeles de pala en la primera y la última fila y columna: si son muchos, está cortada.
  const onEdge = { top: 0, bottom: 0, left: 0, right: 0 };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isBackground((y * w + x) * 4)) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (y === 0) onEdge.top++;
      if (y === h - 1) onEdge.bottom++;
      if (x === 0) onEdge.left++;
      if (x === w - 1) onEdge.right++;
    }
  }

  const hasContent = right >= left && bottom >= top;
  const content = hasContent
    ? {
        left: left / w,
        top: top / h,
        width: (right - left + 1) / w,
        height: (bottom - top + 1) / h,
        // Proporción real: la copia reducida conserva la de la imagen.
        aspect: (bottom - top + 1) / (right - left + 1),
      }
    : null;
  // Un recorte ajustado roza el borde en un punto (el mango, el cordón); una pala
  // cortada lo ocupa a lo ancho.
  const touchesEdge =
    Math.max(onEdge.top / w, onEdge.bottom / w, onEdge.left / h, onEdge.right / h) > CUT_EDGE_SHARE;

  return { format, extension: FORMATS[format], width, height, background, content, touchesEdge };
}

/** Abre la imagen y devuelve una copia reducida en RGBA; null si no se puede abrir. */
async function decode(bytes: Buffer) {
  try {
    const metadata = await sharp(bytes).metadata();
    const { width, height } = metadata;
    // sharp llama «heif» al contenedor de AVIF; solo se admite con compresión AV1.
    const format = metadata.format === "heif" && metadata.compression === "av1" ? "avif" : metadata.format;
    if (!format || !(format in FORMATS) || !width || !height) return null;

    const { data, info } = await sharp(bytes)
      .ensureAlpha()
      .resize({ width: SAMPLE_SIDE, height: SAMPLE_SIDE, fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { format: format as Format, width, height, data, info };
  } catch {
    return null;
  }
}

export interface Classification {
  status: VerificationStatus;
  /** Motivo del estado, o una observación si está verificada */
  note: string | null;
}

interface ClassifyContext {
  /** Asociación con la pala marcada para revisión manual */
  needsMatchReview?: boolean;
  /** Otra pala distinta tiene exactamente el mismo archivo */
  duplicateOf?: string | null;
}

/**
 * Decide el estado de una imagen a partir de su análisis. Solo se da por
 * verificada si pasa todos los controles; lo dudoso queda pendiente de revisión.
 */
export function classifyImage(
  inspection: ImageInspection | null,
  { needsMatchReview = false, duplicateOf = null }: ClassifyContext = {},
): Classification {
  if (!inspection) {
    return { status: "rejected", note: "No es un JPG, PNG, WebP o AVIF válido (otro formato o archivo dañado)" };
  }

  const shortSide = Math.min(inspection.width, inspection.height);
  const size = `${inspection.width}×${inspection.height} px`;
  if (shortSide < MIN_USABLE_SIDE) {
    return { status: "rejected", note: `Resolución insuficiente (${size})` };
  }
  if (!inspection.content) return { status: "rejected", note: "La imagen está vacía" };

  const pending = (note: string): Classification => ({ status: "pending", note });

  if (needsMatchReview) {
    return pending("Pala con una URL antigua de PadelZoom que mostraba otra pala: revisar la imagen a mano");
  }
  if (duplicateOf) return pending(`Es exactamente la misma imagen que la de otra pala (${duplicateOf})`);
  if (inspection.background === "other") {
    return pending("El fondo no es blanco, gris claro ni transparente (de color o con algún elemento en las esquinas)");
  }
  if (inspection.touchesEdge) return pending("La pala ocupa el borde de la imagen: parece cortada");
  if (inspection.content.aspect < MIN_CONTENT_ASPECT || inspection.content.aspect > MAX_CONTENT_ASPECT) {
    return pending("El encuadre no es el de una sola pala en vertical: puede haber varias, un pack o estar tumbada");
  }
  if (shortSide < MIN_SHORT_SIDE) {
    return pending(`Baja resolución (${size}): por debajo de los ${MIN_SHORT_SIDE} px mínimos`);
  }

  // Verificada; se anota lo que convendría mejorar si aparece una imagen mejor.
  const notes = [
    inspection.background === "light"
      ? "Fondo gris claro: sobre el marco de la web puede notarse el recuadro de la imagen"
      : null,
    shortSide < PREFERRED_SHORT_SIDE ? `Por debajo de los ${PREFERRED_SHORT_SIDE} px preferidos (${size})` : null,
  ].filter(Boolean);
  return { status: "verified", note: notes.length > 0 ? notes.join(" · ") : null };
}
