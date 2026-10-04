// Importación de imágenes de una fuente: descarga cada una, comprueba que es una
// imagen, la mide, calcula su huella, guarda nuestra copia y deja anotado su
// estado. Se puede repetir sin riesgo: lo ya importado no se vuelve a descargar,
// y un fallo en una imagen no detiene las demás.
import { createHash } from "node:crypto";
import { storagePathFor, type VerificationStatus } from "@/lib/media";
import { classifyImage, inspectImage } from "./inspect";
import type { MediaItem, MediaRepository } from "./repository";
import type { MediaStorage } from "./storage";

const MAX_BYTES = 15 * 1024 * 1024;
const CONTENT_TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
} as const;

export interface Download {
  status: number;
  contentType: string | null;
  bytes: Buffer;
}

export type Downloader = (url: string) => Promise<Download>;

export interface ImportedImage {
  slug: string;
  sourceUrl: string;
  status: VerificationStatus;
  note: string | null;
  width: number | null;
  height: number | null;
}

export interface MediaImportReport {
  /** Imágenes que tocaba descargar en esta ejecución */
  total: number;
  downloaded: number;
  verified: number;
  pending: number;
  rejected: number;
  /** Descargas que fallaron: siguen pendientes y se reintentan en la siguiente ejecución */
  failed: { slug: string; sourceUrl: string; error: string }[];
  /** Imágenes cuyo archivo es idéntico al de otra pala */
  duplicates: { slug: string; sameAs: string }[];
  /** Archivos subidos a Storage y bytes que ocupan */
  uploaded: number;
  uploadedBytes: number;
  images: ImportedImage[];
}

interface ImportOptions {
  source: string;
  repository: MediaRepository;
  storage: MediaStorage;
  download: Downloader;
  now?: () => Date;
  /** true: analiza y clasifica, pero no sube archivos ni escribe en la base de datos */
  dryRun?: boolean;
  /**
   * true: vuelve a pasar los controles a todas las imágenes de la fuente (p. ej.
   * tras cambiar los criterios). Lo ya guardado en Storage no se sube de nuevo.
   */
  recheck?: boolean;
  /** Máximo de imágenes de esta ejecución */
  limit?: number;
  /** Pausa entre descargas, en milisegundos, para no cargar la fuente */
  pauseMs?: number;
  onProgress?: (done: number, total: number) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Descarga y valida la respuesta: lanza si no es una imagen descargable. */
async function fetchBytes(item: MediaItem, download: Downloader): Promise<Buffer> {
  if (!/^https?:\/\//.test(item.sourceUrl)) throw new Error("La imagen no tiene una URL de origen válida");

  const response = await download(item.sourceUrl);
  if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
  if (!response.contentType?.startsWith("image/")) {
    throw new Error(`La respuesta no es una imagen (content-type: ${response.contentType ?? "ninguno"})`);
  }
  if (response.bytes.length === 0) throw new Error("La respuesta está vacía");
  if (response.bytes.length > MAX_BYTES) throw new Error("El archivo supera el tamaño máximo");
  return response.bytes;
}

/**
 * Ruta donde guardar la imagen. Si la ruta habitual ya la ocupa la imagen de otra
 * fuente, se usa una con el nombre de la fuente: sustituir una imagen por otra de
 * mejor origen nunca pisa el archivo anterior.
 */
async function freePath(item: MediaItem, extension: string, repository: MediaRepository): Promise<string> {
  const path = storagePathFor(item.racketId, item.role, item.position, extension);
  return (await repository.pathInUse(path, item))
    ? storagePathFor(item.racketId, item.role, item.position, extension, item.source)
    : path;
}

export async function importMedia({
  source,
  repository,
  storage,
  download,
  now = () => new Date(),
  dryRun = false,
  recheck = false,
  limit,
  pauseMs = 0,
  onProgress,
}: ImportOptions): Promise<MediaImportReport> {
  const items = (await repository.listToFetch(source, { all: recheck })).slice(0, limit);
  const report: MediaImportReport = {
    total: items.length,
    downloaded: 0,
    verified: 0,
    pending: 0,
    rejected: 0,
    failed: [],
    duplicates: [],
    uploaded: 0,
    uploadedBytes: 0,
    images: [],
  };
  // En simulación no se escribe nada: los duplicados dentro de la ejecución se llevan aquí.
  const seen = new Map<string, { racketId: string; slug: string; storagePath: string | null }>();

  if (!dryRun && items.length > 0) await storage.prepare();

  for (const [index, item] of items.entries()) {
    try {
      const bytes = await fetchBytes(item, download);
      report.downloaded++;

      const fileHash = createHash("sha256").update(bytes).digest("hex");
      const inspection = await inspectImage(bytes);

      // ¿Tenemos ya este mismo archivo? Si es de otra pala, la asociación es dudosa.
      const known = [
        ...(await repository.findByHash(fileHash)).map((match) => ({
          racketId: match.racketId,
          slug: match.racketSlug,
          sourceUrl: match.sourceUrl,
          storagePath: match.storagePath,
        })),
        ...(seen.has(fileHash) ? [{ ...seen.get(fileHash)!, sourceUrl: null }] : []),
      ];
      const other = known.find((match) => match.racketId !== item.racketId);
      const stored = known.find((match) => match.storagePath)?.storagePath ?? null;

      const { status, note } = classifyImage(inspection, {
        needsMatchReview: item.needsMatchReview,
        duplicateOf: other?.slug ?? null,
      });

      // Las rechazadas no se guardan; un archivo que ya tenemos no se sube otra vez.
      let storagePath: string | null = null;
      if (inspection && status !== "rejected") {
        storagePath = stored ?? (await freePath(item, inspection.extension, repository));
        if (!stored && !dryRun) {
          await storage.upload(storagePath, bytes, CONTENT_TYPES[inspection.extension as keyof typeof CONTENT_TYPES]);
        }
        if (!stored) {
          report.uploaded++;
          report.uploadedBytes += bytes.length;
        }
      }

      if (other) {
        report.duplicates.push({ slug: item.racketSlug, sameAs: other.slug });
        // La otra pala tampoco puede darse por buena: una de las dos no es su imagen.
        if (!dryRun && other.sourceUrl) {
          await repository.markPending(
            other.racketId,
            other.sourceUrl,
            `Es exactamente la misma imagen que la de otra pala (${item.racketSlug})`,
          );
        }
      }
      if (!seen.has(fileHash)) seen.set(fileHash, { racketId: item.racketId, slug: item.racketSlug, storagePath });

      if (!dryRun) {
        await repository.saveFetched(item, {
          storagePath,
          width: inspection?.width ?? null,
          height: inspection?.height ?? null,
          fileHash,
          fileSize: bytes.length,
          fetchedAt: now().toISOString(),
          status,
          note,
        });
      }

      report[status]++;
      report.images.push({
        slug: item.racketSlug,
        sourceUrl: item.sourceUrl,
        status,
        note,
        width: inspection?.width ?? null,
        height: inspection?.height ?? null,
      });
    } catch (error) {
      // Un fallo no detiene la importación: se anota y la imagen queda pendiente.
      const message = errorMessage(error);
      report.failed.push({ slug: item.racketSlug, sourceUrl: item.sourceUrl, error: message });
      if (!dryRun) await repository.saveFailure(item, message).catch(() => {});
    }

    onProgress?.(index + 1, items.length);
    if (pauseMs > 0 && index < items.length - 1) await sleep(pauseMs);
  }

  return report;
}
