// Qué imagen se enseña de cada pala. Orden de preferencia:
//   1. foto real publicada (verificada, con derechos aprobados y copia propia),
//   2. ilustración propia de esa pala,
//   3. ilustración genérica de su forma.
// Las dos últimas viven en `rackets.images`; la foto, en `racket_media`.
import { publicMediaBase } from "@/config/media";

export type MediaRole = "primary" | "gallery";
/** Resultado de los controles técnicos de calidad de la imagen */
export type VerificationStatus = "pending" | "verified" | "rejected";
/**
 * Estado INTERNO de aprobación para mostrar la imagen en PalaRadar. «approved»
 * significa que hemos decidido usarla; NO que tengamos una licencia ni la
 * titularidad de la imagen. La base de la decisión se anota en `rights_note`.
 *
 * Las imágenes de PadelZoom (fotos de catálogo de los fabricantes) están
 * aprobadas en este sentido y pensadas para sustituirse por otras de fuentes con
 * derechos claros: basta añadir la nueva imagen como otra fila de la pala, o
 * pasar a «rejected» las de una fuente para retirarlas todas de la web.
 */
export type RightsStatus = "approved" | "pending" | "rejected";

interface PublishableFields {
  verification_status: VerificationStatus;
  rights_status: RightsStatus;
  storage_path: string | null;
}

/** Una imagen se publica solo verificada, aprobada internamente y con copia propia guardada. */
export function isPublishable(media: PublishableFields): boolean {
  return (
    media.verification_status === "verified" &&
    media.rights_status === "approved" &&
    Boolean(media.storage_path)
  );
}

/** URL pública de una imagen guardada, o null si no hay ruta o Storage no está configurado. */
export function mediaUrl(storagePath: string | null | undefined): string | null {
  const base = publicMediaBase();
  return storagePath && base ? `${base}/${storagePath}` : null;
}

/**
 * Ruta de una imagen dentro del bucket: rackets/{id}/primary.jpg o
 * rackets/{id}/gallery/{n}.jpg. Con `variant` (la fuente), el nombre lo incluye:
 * así la imagen de una fuente nueva convive con la anterior en vez de pisarla.
 */
export function storagePathFor(
  racketId: string,
  role: MediaRole,
  position: number,
  extension: string,
  variant?: string,
): string {
  const suffix = variant ? `-${variant}` : "";
  return role === "primary"
    ? `rackets/${racketId}/primary${suffix}.${extension}`
    : `rackets/${racketId}/gallery/${position}${suffix}.${extension}`;
}

/**
 * Imágenes de una pala, en el orden en que se enseñan: sus fotos publicadas y,
 * solo si no tiene ninguna, sus ilustraciones.
 */
export function publishedImages(photos: (string | null)[], illustrations: string[]): string[] {
  const real = photos.filter((url): url is string => Boolean(url));
  return real.length > 0 ? real : illustrations;
}

/** true si la imagen es una foto real de producto y no una ilustración propia (/img/…). */
export function isProductPhoto(src: string): boolean {
  return !src.startsWith("/img/");
}

/** Texto alternativo de la imagen de una pala: marca, modelo y año. */
export function palaAlt(pala: { brand: { name: string }; model: string; year: number }): string {
  return `${pala.brand.name} ${pala.model} ${pala.year}`;
}
