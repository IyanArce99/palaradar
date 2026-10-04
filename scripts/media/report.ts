// Estado de las imágenes del catálogo: cuántas hay en cada estado, cobertura,
// espacio ocupado y palas que siguen sin foto real.   npm run media:report
import { runDbScript } from "../db/run";

runDbScript(async (sql) => {
  const states = await sql<{ source: string; verification: string; rights: string; images: number; stored: number }[]>`
    select source, verification_status as verification, rights_status as rights,
           count(*)::int as images, count(storage_path)::int as stored
    from racket_media group by 1, 2, 3 order by 1, 2, 3`;
  console.log("Imágenes por estado:");
  console.table(states);

  const [totals] = await sql<{ available: number; with_photo: number; files: number; bytes: number; duplicates: number; failed: number }[]>`
    select
      (select count(*)::int from racket_catalog) as available,
      (select count(*)::int from racket_catalog where photo_path is not null) as with_photo,
      (select count(distinct storage_path)::int from racket_media where storage_path is not null) as files,
      (select coalesce(sum(size), 0)::int from (
         select distinct on (storage_path) file_size as size from racket_media where storage_path is not null
       ) stored) as bytes,
      (select count(*)::int from (
         select file_hash from racket_media where file_hash is not null
         group by file_hash having count(distinct racket_id) > 1
       ) repeated) as duplicates,
      (select count(*)::int from racket_media where verification_note like 'Descarga fallida:%') as failed`;

  console.log(`Palas publicables:        ${totals.available}`);
  console.log(`Con foto real publicada:  ${totals.with_photo} (${((totals.with_photo / totals.available) * 100).toFixed(1)} %)`);
  console.log(`Archivos en Storage:      ${totals.files} · ${(totals.bytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Imágenes repetidas en más de una pala: ${totals.duplicates}`);
  console.log(`Descargas fallidas pendientes de reintento: ${totals.failed}`);

  const notes = await sql<{ verification: string; note: string; images: number }[]>`
    select verification_status as verification,
           regexp_replace(coalesce(verification_note, '(sin nota)'), '\\(.*?\\)', '', 'g') as note,
           count(*)::int as images
    from racket_media where verification_status <> 'verified'
    group by 1, 2 order by 3 desc`;
  console.log("\nMotivos de las no verificadas:");
  console.table(notes);

  const missing = await sql<{ brand_name: string; palas: number }[]>`
    select brand_name, count(*)::int as palas from racket_catalog
    where photo_path is null group by 1 order by 2 desc`;
  console.log("Palas sin foto real, por marca:");
  console.table(missing);
});
