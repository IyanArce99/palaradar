// Imágenes de producto: nuestras copias viven en un bucket público de Supabase
// Storage. La web solo necesita saber desde dónde se sirven; la clave de
// servicio la usan únicamente los scripts de importación (scripts/media/).

/** Bucket de Supabase Storage con las imágenes de las palas */
export const MEDIA_BUCKET = "media";

/**
 * Dirección pública desde la que se sirven las imágenes, o null si Storage no
 * está configurado (entonces las palas muestran su ilustración).
 */
export function publicMediaBase(): string | null {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  return url ? `${url}/storage/v1/object/public/${MEDIA_BUCKET}` : null;
}
