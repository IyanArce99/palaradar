// Imágenes reales contra PostgreSQL, en transacciones que se deshacen. Solo se
// ejecuta con `npm run test:db` (necesita DATABASE_URL).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSql, getDatabaseUrl, type Sql } from "@/data/db/client";
import { createPostgresRepository } from "@/data/postgres-repository";
import { DEFAULT_QUERY } from "@/lib/catalog/query";
import { createPostgresMediaRepository } from "@/media/repository";

const url = getDatabaseUrl();
const ROLLBACK = new Error("rollback");
const STORAGE = "https://proyecto-de-test.supabase.co";
const PUBLIC = `${STORAGE}/storage/v1/object/public/media`;
const NOW = "2026-10-04T10:00:00.000Z";

async function rolledBack(work: (tx: Sql) => Promise<void>): Promise<void> {
  const sql = createSql(url as string, 1);
  const previous = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = STORAGE;
  try {
    await sql.begin(async (transaction) => {
      await work(transaction as unknown as Sql);
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous;
    await sql.end();
  }
}

const TEST_URL = "https://padelzoom.es/imagen-de-test.jpg";

/**
 * Una pala disponible con una imagen propia de la prueba, todavía sin importar.
 * Sus demás imágenes se apartan para que el resultado no dependa de lo ya importado.
 */
async function pendingItem(tx: Sql) {
  const [racket] = await tx<{ id: string }[]>`
    select id from rackets where is_available order by slug limit 1`;
  await tx`delete from racket_media where racket_id = ${racket.id}`;
  await tx`
    insert into racket_media (racket_id, source, source_url, rights_status, matching_confidence)
    values (${racket.id}, 'padelzoom', ${TEST_URL}, 'approved', 'high')`;

  const item = (await createPostgresMediaRepository(tx).listToFetch("padelzoom")).find(
    (candidate) => candidate.sourceUrl === TEST_URL,
  );
  assert.ok(item);
  return item;
}

describe("imágenes reales en PostgreSQL", { skip: !url && "DATABASE_URL no configurada" }, () => {
  it("una imagen verificada y con derechos se publica en la ficha y en el catálogo", async () => {
    await rolledBack(async (tx) => {
      const media = createPostgresMediaRepository(tx);
      const item = await pendingItem(tx);
      const path = `rackets/${item.racketId}/primary.jpg`;
      const hash = "a".repeat(64);

      await media.saveFetched(item, {
        storagePath: path, width: 800, height: 800, fileHash: hash, fileSize: 12345,
        fetchedAt: NOW, status: "verified", note: null,
      });

      const catalog = createPostgresRepository(tx);
      const pala = await catalog.getPalaBySlug(item.racketSlug);
      assert.deepEqual(pala?.images, [`${PUBLIC}/${path}`]);
      assert.deepEqual(pala?.photoSize, { width: 800, height: 800 });

      const { items } = await catalog.searchCatalog({ ...DEFAULT_QUERY, q: item.racketSlug.replaceAll("-", " ") });
      assert.equal(items.find((summary) => summary.slug === item.racketSlug)?.image, `${PUBLIC}/${path}`);

      // Ya importada: no vuelve a salir entre las pendientes y se encuentra por su huella.
      assert.equal((await media.listToFetch("padelzoom")).some((next) => next.racketId === item.racketId), false);
      assert.deepEqual((await media.findByHash(hash)).map((match) => match.racketSlug), [item.racketSlug]);
    });
  });

  it("sin verificar o sin derechos, la pala sigue con su ilustración", async () => {
    await rolledBack(async (tx) => {
      const media = createPostgresMediaRepository(tx);
      const item = await pendingItem(tx);
      const catalog = createPostgresRepository(tx);
      const fetched = {
        storagePath: `rackets/${item.racketId}/primary.jpg`, width: 500, height: 500,
        fileHash: "b".repeat(64), fileSize: 999, fetchedAt: NOW, note: "Baja resolución",
      };

      await media.saveFetched(item, { ...fetched, status: "pending" });
      assert.match((await catalog.getPalaBySlug(item.racketSlug))?.images[0] ?? "", /^\/img\/palas\//);

      await media.saveFetched(item, { ...fetched, status: "verified" });
      await tx`update racket_media set rights_status = 'pending' where racket_id = ${item.racketId}`;
      const pala = await catalog.getPalaBySlug(item.racketSlug);
      assert.match(pala?.images[0] ?? "", /^\/img\/palas\//);
      assert.equal(pala?.photoSize, null);
    });
  });

  it("las imágenes de PadelZoom parten con derechos aprobados y las de URL antigua, para revisión", async () => {
    await rolledBack(async (tx) => {
      const [counts] = await tx<{ total: number; approved: number; review: number }[]>`
        select count(*)::int as total,
               count(*) filter (where rights_status = 'approved')::int as approved,
               count(*) filter (where matching_confidence = 'review')::int as review
        from racket_media where source = 'padelzoom'`;
      assert.equal(counts.approved, counts.total);
      assert.equal(counts.review, 7);
    });
  });

  it("un fallo de descarga deja la imagen pendiente y con el error anotado", async () => {
    await rolledBack(async (tx) => {
      const media = createPostgresMediaRepository(tx);
      const item = await pendingItem(tx);
      await media.saveFailure(item, "HTTP 404");

      const [row] = await tx<{ verification_status: string; verification_note: string; file_hash: string | null }[]>`
        select verification_status, verification_note, file_hash from racket_media
        where racket_id = ${item.racketId} and source_url = ${item.sourceUrl}`;
      assert.deepEqual(row, { verification_status: "pending", verification_note: "Descarga fallida: HTTP 404", file_hash: null });
      assert.equal((await media.listToFetch("padelzoom")).some((next) => next.racketId === item.racketId), true);
    });
  });
});
