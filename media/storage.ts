// Dónde se guardan nuestras copias de las imágenes. En producción, un bucket
// público de Supabase Storage.
//
// SEGURIDAD: este módulo recibe la clave secreta de Supabase y solo lo usan los
// scripts de importación (scripts/media/). No debe importarse desde app/,
// components/, lib/ ni data/: la web sirve las imágenes por su URL pública y no
// necesita ninguna clave.
import { MEDIA_BUCKET } from "@/config/media";

export interface MediaStorage {
  /** Deja el almacenamiento listo para recibir archivos (crea el bucket si falta). */
  prepare(): Promise<void>;
  /** Guarda un archivo en esa ruta; si ya existe, lo sustituye. */
  upload(path: string, bytes: Buffer, contentType: string): Promise<void>;
}

interface SupabaseStorageOptions {
  /** https://<proyecto>.supabase.co */
  url: string;
  /** Clave de servicio (service_role): nunca sale del servidor ni se escribe en el repositorio */
  serviceKey: string;
  bucket?: string;
}

export function createSupabaseStorage({
  url,
  serviceKey,
  bucket = MEDIA_BUCKET,
}: SupabaseStorageOptions): MediaStorage {
  const base = `${url.replace(/\/+$/, "")}/storage/v1`;
  const auth = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };

  async function fail(action: string, response: Response): Promise<never> {
    const detail = (await response.text()).slice(0, 200);
    throw new Error(`Supabase Storage: ${action} → HTTP ${response.status} ${detail}`);
  }

  return {
    async prepare() {
      const existing = await fetch(`${base}/bucket/${bucket}`, { headers: auth });
      if (existing.ok) return;

      const created = await fetch(`${base}/bucket`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ id: bucket, name: bucket, public: true }),
      });
      // 409: otro proceso lo acaba de crear.
      if (!created.ok && created.status !== 409) await fail(`crear el bucket «${bucket}»`, created);
    },

    async upload(path, bytes, contentType) {
      const response = await fetch(`${base}/object/${bucket}/${path}`, {
        method: "POST",
        headers: {
          ...auth,
          "Content-Type": contentType,
          "x-upsert": "true",
          // Las rutas no cambian de contenido salvo reimportación: caché larga.
          "cache-control": "max-age=31536000",
        },
        body: new Uint8Array(bytes),
      });
      if (!response.ok) await fail(`subir ${path}`, response);
    },
  };
}

/** Almacenamiento en memoria, para pruebas y simulaciones. */
export function createMemoryStorage() {
  const files = new Map<string, { bytes: Buffer; contentType: string }>();
  const storage: MediaStorage = {
    async prepare() {},
    async upload(path, bytes, contentType) {
      files.set(path, { bytes, contentType });
    },
  };
  return { storage, files };
}
