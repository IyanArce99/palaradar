// Escáner de palas por foto: contrato y reglas, sin proveedor. Hoy NO hay ningún
// servicio de visión conectado, así que `scannerAvailable()` es false y la web no
// ofrece la función (la ruta /escanear/ no se enlaza). Este módulo fija cómo
// debe comportarse cuando se conecte uno, para que la interfaz no tenga que
// cambiar con el proveedor y para que nunca se presente una certeza que no existe:
//   · el proveedor devuelve candidatos, no «la» pala;
//   · cada candidato se valida contra el catálogo: lo que no esté en él se descarta;
//   · por debajo de una confianza mínima no se enseña nada y se ofrece buscar a mano.
// Ver docs/roadmap-v4.md («Escáner») para el coste y los pasos de activación.

/** Lo que devuelve un servicio de visión sobre una foto, antes de validarlo */
export interface ScanGuess {
  /** Slug de la pala del catálogo que cree reconocer */
  slug: string;
  /** Confianza del proveedor, de 0 a 1 */
  confidence: number;
  /** Elementos de la foto que apuntan a ese modelo: «logotipo», «texto del marco», «dibujo de la cara» */
  evidence: string[];
}

export interface ScanProvider {
  /** Identificador del proveedor, para registrarlo */
  id: string;
  /** Reconoce la pala de una imagen. Puede lanzar si el servicio falla. */
  identify(image: { bytes: Uint8Array; mimeType: string }): Promise<ScanGuess[]>;
}

export interface ScanCandidate {
  slug: string;
  /** alta: coincidencia clara · media: posible · el resto no se enseña */
  confidence: "alta" | "media";
  evidence: string[];
}

export type ScanResult =
  /** No hay servicio de visión configurado: la función no se ofrece */
  | { status: "unavailable" }
  /** El servicio ha fallado: se ofrece buscar a mano */
  | { status: "error" }
  /** No se reconoce ningún modelo con confianza suficiente: se ofrece buscar a mano */
  | { status: "no-match" }
  /** Entre uno y cinco candidatos, de más a menos probable; quien confirma es la persona */
  | { status: "candidates"; candidates: ScanCandidate[] };

/** Formatos y tamaño de imagen que se aceptarían */
export const SCAN_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const SCAN_MAX_BYTES = 8 * 1024 * 1024;
export const SCAN_MAX_CANDIDATES = 5;
/** Por debajo de esto, un candidato no se enseña */
export const SCAN_MIN_CONFIDENCE = 0.35;
/** A partir de esto, la coincidencia se presenta como clara (nunca como segura) */
export const SCAN_HIGH_CONFIDENCE = 0.8;

/** Proveedor configurado. Hoy no hay ninguno: conectar uno es registrar aquí su implementación. */
export function getScanProvider(): ScanProvider | null {
  return null;
}

/** true solo si hay un servicio de visión conectado; la interfaz se apoya en esto para no prometer nada. */
export function scannerAvailable(provider: ScanProvider | null = getScanProvider()): boolean {
  return provider !== null;
}

export function isAcceptedImage(image: { bytes: Uint8Array; mimeType: string }): boolean {
  return (
    (SCAN_ACCEPTED_TYPES as readonly string[]).includes(image.mimeType) &&
    image.bytes.byteLength > 0 &&
    image.bytes.byteLength <= SCAN_MAX_BYTES
  );
}

/**
 * De lo que dice el proveedor a lo que se puede enseñar: solo palas que existen
 * en el catálogo, sin repetir, con confianza suficiente, de más a menos probable.
 */
export function toScanCandidates(guesses: ScanGuess[], catalogSlugs: ReadonlySet<string>): ScanCandidate[] {
  const seen = new Set<string>();
  return [...guesses]
    .filter((guess) => Number.isFinite(guess.confidence) && guess.confidence >= SCAN_MIN_CONFIDENCE)
    .filter((guess) => catalogSlugs.has(guess.slug))
    .sort((a, b) => b.confidence - a.confidence || a.slug.localeCompare(b.slug))
    .filter((guess) => !seen.has(guess.slug) && seen.add(guess.slug))
    .slice(0, SCAN_MAX_CANDIDATES)
    .map((guess) => ({
      slug: guess.slug,
      confidence: guess.confidence >= SCAN_HIGH_CONFIDENCE ? "alta" : "media",
      evidence: guess.evidence.filter((item) => item.trim() !== "").slice(0, 3),
    }));
}

/** Flujo completo de un escaneo, con todos sus finales. Nunca lanza. */
export async function scanPala(
  image: { bytes: Uint8Array; mimeType: string },
  catalogSlugs: ReadonlySet<string>,
  provider: ScanProvider | null = getScanProvider(),
): Promise<ScanResult> {
  if (!provider) return { status: "unavailable" };
  if (!isAcceptedImage(image)) return { status: "error" };
  try {
    const candidates = toScanCandidates(await provider.identify(image), catalogSlugs);
    return candidates.length > 0 ? { status: "candidates", candidates } : { status: "no-match" };
  } catch {
    return { status: "error" };
  }
}
