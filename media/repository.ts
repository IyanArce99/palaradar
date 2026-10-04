// Acceso a `racket_media` para la importación de imágenes. Dos implementaciones:
// PostgreSQL (la real) y memoria (pruebas y simulaciones).
import type { Sql } from "@/data/db/client";
import type { MediaRole, VerificationStatus } from "@/lib/media";

/** Una imagen por importar: su pala y de dónde se descarga */
export interface MediaItem {
  racketId: string;
  racketSlug: string;
  source: string;
  sourceUrl: string;
  role: MediaRole;
  position: number;
  /** La asociación imagen–pala está marcada para revisión manual */
  needsMatchReview: boolean;
}

/** Resultado de una descarga correcta */
export interface FetchedMedia {
  /** null si el archivo no se ha guardado (imagen rechazada) */
  storagePath: string | null;
  width: number | null;
  height: number | null;
  fileHash: string;
  fileSize: number;
  fetchedAt: string;
  status: VerificationStatus;
  note: string | null;
}

/** Otra imagen ya importada con el mismo archivo */
export interface HashMatch {
  racketId: string;
  racketSlug: string;
  sourceUrl: string;
  storagePath: string | null;
}

export interface MediaRepository {
  /**
   * Imágenes de la fuente que aún no se han descargado: pendientes y sin hash.
   * Con `all`, todas las de la fuente, para volver a aplicarles los controles.
   */
  listToFetch(source: string, options?: { all?: boolean }): Promise<MediaItem[]>;
  /** Imágenes ya importadas con ese mismo archivo. */
  findByHash(fileHash: string): Promise<HashMatch[]>;
  /** true si otra imagen (de otra fuente o de otra pala) ya ocupa esa ruta de Storage. */
  pathInUse(storagePath: string, item: MediaItem): Promise<boolean>;
  saveFetched(item: MediaItem, media: FetchedMedia): Promise<void>;
  /** La descarga falló: la imagen sigue pendiente y se anota el error para reintentar. */
  saveFailure(item: MediaItem, error: string): Promise<void>;
  /** Devuelve una imagen ya verificada a «pendiente» (p. ej. al descubrir un duplicado). */
  markPending(racketId: string, sourceUrl: string, note: string): Promise<void>;
}

interface ItemRow {
  racket_id: string;
  slug: string;
  source: string;
  source_url: string;
  role: MediaRole;
  position: number;
  matching_confidence: string | null;
}

export function createPostgresMediaRepository(sql: Sql): MediaRepository {
  return {
    async listToFetch(source, { all = false } = {}) {
      const rows = await sql<ItemRow[]>`
        select m.racket_id, r.slug, m.source, m.source_url, m.role, m.position, m.matching_confidence
        from racket_media m join rackets r on r.id = m.racket_id
        where m.source = ${source}
          and (${all} or (m.verification_status = 'pending' and m.file_hash is null))
        order by r.slug, m.position`;
      return rows.map((row) => ({
        racketId: row.racket_id,
        racketSlug: row.slug,
        source: row.source,
        sourceUrl: row.source_url,
        role: row.role,
        position: row.position,
        needsMatchReview: row.matching_confidence === "review",
      }));
    },

    async findByHash(fileHash) {
      const rows = await sql<{ racket_id: string; slug: string; source_url: string; storage_path: string | null }[]>`
        select m.racket_id, r.slug, m.source_url, m.storage_path
        from racket_media m join rackets r on r.id = m.racket_id
        where m.file_hash = ${fileHash}`;
      return rows.map((row) => ({
        racketId: row.racket_id,
        racketSlug: row.slug,
        sourceUrl: row.source_url,
        storagePath: row.storage_path,
      }));
    },

    async pathInUse(storagePath, item) {
      const rows = await sql`
        select 1 from racket_media
        where storage_path = ${storagePath}
          and not (racket_id = ${item.racketId} and source_url = ${item.sourceUrl})
        limit 1`;
      return rows.length > 0;
    },

    async saveFetched(item, media) {
      await sql`
        update racket_media set
          storage_path = ${media.storagePath}, width = ${media.width}, height = ${media.height},
          file_hash = ${media.fileHash}, file_size = ${media.fileSize}, fetched_at = ${media.fetchedAt},
          verification_status = ${media.status}, verification_note = ${media.note}
        where racket_id = ${item.racketId} and source_url = ${item.sourceUrl}`;
    },

    async saveFailure(item, error) {
      await sql`
        update racket_media set verification_note = ${`Descarga fallida: ${error}`}
        where racket_id = ${item.racketId} and source_url = ${item.sourceUrl}`;
    },

    async markPending(racketId, sourceUrl, note) {
      await sql`
        update racket_media set verification_status = 'pending', verification_note = ${note}
        where racket_id = ${racketId} and source_url = ${sourceUrl} and verification_status = 'verified'`;
    },
  };
}

interface MemoryRow extends MediaItem {
  media: FetchedMedia | null;
  error: string | null;
}

/** Repositorio en memoria: mismas reglas que el de PostgreSQL, para pruebas y simulaciones. */
export function createMemoryMediaRepository(items: MediaItem[]) {
  const rows: MemoryRow[] = items.map((item) => ({ ...item, media: null, error: null }));
  const find = (racketId: string, sourceUrl: string) =>
    rows.find((row) => row.racketId === racketId && row.sourceUrl === sourceUrl);

  const repository: MediaRepository = {
    async listToFetch(source, { all = false } = {}) {
      // Una fila es también un MediaItem: sus campos extra no molestan a quien la lee.
      return rows.filter((row) => row.source === source && (all || row.media === null));
    },

    async pathInUse(storagePath, item) {
      return rows.some(
        (row) =>
          row.media?.storagePath === storagePath &&
          !(row.racketId === item.racketId && row.sourceUrl === item.sourceUrl),
      );
    },

    async findByHash(fileHash) {
      return rows.flatMap((row) =>
        row.media?.fileHash === fileHash
          ? [{ racketId: row.racketId, racketSlug: row.racketSlug, sourceUrl: row.sourceUrl, storagePath: row.media.storagePath }]
          : [],
      );
    },

    async saveFetched(item, media) {
      const row = find(item.racketId, item.sourceUrl);
      if (row) Object.assign(row, { media, error: null });
    },

    async saveFailure(item, error) {
      const row = find(item.racketId, item.sourceUrl);
      if (row) row.error = error;
    },

    async markPending(racketId, sourceUrl, note) {
      const row = find(racketId, sourceUrl);
      if (row?.media?.status === "verified") row.media = { ...row.media, status: "pending", note };
    },
  };

  return { repository, rows };
}
