// Hoja de revisión de las imágenes pendientes que necesitan que alguien las mire:
// duplicadas entre palas, palas con URL antigua de PadelZoom y recortes o
// encuadres dudosos. Genera var/media-review.html (autocontenido: las imágenes
// van dentro del archivo).   npm run media:review
// No cambia ningún estado: decidir sigue siendo cosa de quien revisa.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mediaUrl } from "@/lib/media";
import { runDbScript } from "../db/run";

const OUTPUT = join(process.cwd(), "var", "media-review.html");
const PADELZOOM = "https://padelzoom.es";

interface Row {
  slug: string;
  brand: string;
  model: string;
  year: number;
  source_url: string;
  storage_path: string;
  width: number;
  height: number;
  file_hash: string;
  note: string;
  legacy: string[] | null;
}

const GROUPS = [
  {
    id: "duplicadas",
    title: "Misma imagen en más de una pala",
    match: /misma imagen/,
    help: "El archivo es idéntico byte a byte en todas las palas de cada grupo. Hay que decidir a cuál corresponde de verdad (o si es válida para todas, p. ej. el mismo molde en dos años).",
  },
  {
    id: "url-antigua",
    title: "Palas con una URL antigua de PadelZoom",
    match: /URL antigua/,
    help: "A cada una de estas palas apunta, además de su ficha, una URL antigua de PadelZoom que mostraba el contenido de otra pala. La imagen procede de la ficha actual; hay que confirmar que es la de esta pala.",
  },
  {
    id: "encuadre",
    title: "Recorte o encuadre dudoso",
    match: /cortada|encuadre/,
    help: "Los controles automáticos ven la pala cortada por un borde o un encuadre que no es el de una sola pala en vertical.",
  },
];

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);

async function dataUri(storagePath: string): Promise<string> {
  const url = mediaUrl(storagePath);
  if (!url) throw new Error("SUPABASE_URL no está configurada: no se pueden leer las imágenes.");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se puede leer ${storagePath}: HTTP ${response.status}`);
  const type = response.headers.get("content-type") ?? "image/jpeg";
  return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
}

async function card(row: Row): Promise<string> {
  const legacy = (row.legacy ?? [])
    .map((path) => `<a href="${PADELZOOM}${escape(path)}">${escape(path)}</a>`)
    .join("<br>");
  return `
    <article>
      <img src="${await dataUri(row.storage_path)}" alt="${escape(`${row.brand} ${row.model} ${row.year}`)}">
      <h3>${escape(`${row.brand} ${row.model}`)} <span>${row.year}</span></h3>
      <p class="slug">${escape(row.slug)}</p>
      <p class="why">${escape(row.note)}</p>
      <dl>
        <dt>Imagen</dt><dd>${row.width}×${row.height} px · <a href="${escape(row.source_url)}">origen</a></dd>
        <dt>Archivo</dt><dd>${escape(row.storage_path)}</dd>
        <dt>Huella</dt><dd>${row.file_hash.slice(0, 12)}…</dd>
        <dt>URLs en PadelZoom</dt><dd>${legacy || "—"}</dd>
      </dl>
    </article>`;
}

runDbScript(async (sql) => {
  const rows = await sql<Row[]>`
    select r.slug, b.name as brand, r.model, r.year, m.source_url, m.storage_path, m.width, m.height,
           m.file_hash, m.verification_note as note,
           (select array_agg(l.path order by l.path) from legacy_urls l where l.racket_id = r.id) as legacy
    from racket_media m
    join rackets r on r.id = m.racket_id
    join brands b on b.id = r.brand_id
    where m.verification_status = 'pending' and m.storage_path is not null
    order by m.file_hash, r.slug`;

  const sections: string[] = [];
  const summary: string[] = [];
  for (const group of GROUPS) {
    const items = rows.filter((row) => group.match.test(row.note ?? ""));
    summary.push(`<li><a href="#${group.id}">${escape(group.title)}</a>: ${items.length}</li>`);

    // Las duplicadas se enseñan juntas, un bloque por archivo repetido.
    const blocks = new Map<string, Row[]>();
    for (const item of items) {
      const key = group.id === "duplicadas" ? item.file_hash : group.id;
      blocks.set(key, [...(blocks.get(key) ?? []), item]);
    }
    const html: string[] = [];
    for (const block of blocks.values()) {
      const cards = await Promise.all(block.map(card));
      html.push(`<div class="block">${cards.join("")}</div>`);
    }
    sections.push(`
      <section id="${group.id}">
        <h2>${escape(group.title)} <span>${items.length}</span></h2>
        <p>${escape(group.help)}</p>
        ${html.join("")}
      </section>`);
    console.log(`${group.title}: ${items.length}`);
  }

  const page = `<!doctype html>
<html lang="es">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PalaRadar · imágenes pendientes de revisión</title>
<style>
  body { margin: 0 auto; max-width: 1240px; padding: 32px 20px 80px; font: 15px/1.5 system-ui, sans-serif; color: #15171a; background: #fff; }
  h1 { font-size: 30px; margin: 0 0 6px; }
  h2 { font-size: 22px; margin: 48px 0 6px; }
  h2 span, h3 span { color: #5b6058; font-weight: 400; }
  h3 { font-size: 16px; margin: 12px 0 0; }
  p { margin: 0 0 12px; color: #3f443c; max-width: 820px; }
  .block { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 16px; margin: 0 0 16px; padding: 16px; border: 1px solid #e3e5df; border-radius: 18px; }
  article img { display: block; width: 100%; height: 300px; object-fit: contain; background: #f4f5f1; border-radius: 14px; }
  .slug { margin: 0; font: 12px ui-monospace, monospace; color: #5b6058; word-break: break-all; }
  .why { margin: 8px 0; padding: 8px 10px; background: #f7fde6; border-radius: 10px; font-size: 13px; color: #2d3a0a; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0; font-size: 12px; }
  dt { color: #5b6058; } dd { margin: 0; word-break: break-all; }
  a { color: inherit; }
</style>
<h1>Imágenes pendientes de revisión</h1>
<p>Generado el ${new Date().toISOString().slice(0, 10)} con <code>npm run media:review</code>. Ninguna de estas imágenes se publica: sus palas muestran su ilustración hasta que se decida. Este informe no cambia ningún estado.</p>
<ul>${summary.join("")}</ul>
${sections.join("")}
</html>`;

  await mkdir(join(process.cwd(), "var"), { recursive: true });
  await writeFile(OUTPUT, page, "utf8");
  console.log(`\nInforme: ${OUTPUT}`);
});
