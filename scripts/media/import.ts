// Importa las imágenes de una fuente (por defecto, PadelZoom) a Supabase Storage.
//   npm run media:import                    descarga, guarda y clasifica lo pendiente
//   npm run media:import -- --dry-run       analiza y clasifica sin guardar nada
//   npm run media:import -- --recheck       vuelve a pasar los controles a todas (tras cambiar criterios)
//   npm run media:import -- --limit 20      solo las 20 primeras pendientes
//   npm run media:import -- --source otra   otra fuente de `racket_media`
// Se puede repetir: lo ya importado no se vuelve a descargar y los fallos se reintentan.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { importMedia, type Download, type Downloader } from "@/media/import";
import { createPostgresMediaRepository } from "@/media/repository";
import { createMemoryStorage, createSupabaseStorage } from "@/media/storage";
import { runDbScript } from "../db/run";

const USER_AGENT = "PalaRadarBot/0.1 (+https://palaradar.es; importacion de imagenes)";
const PAUSE_MS = 150;
const TIMEOUT_MS = 20_000;
// Copia local de lo descargado (git-ignorada): repetir el proceso no vuelve a pedirlo a la fuente.
const CACHE_DIR = join(process.cwd(), "var", "media-cache");

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

/** Descarga con caché en disco: solo se guardan las respuestas correctas. */
const download: Downloader = async (url) => {
  const key = join(CACHE_DIR, createHash("sha1").update(url).digest("hex"));
  try {
    const [bytes, contentType] = await Promise.all([readFile(key), readFile(`${key}.type`, "utf8")]);
    return { status: 200, contentType, bytes };
  } catch {
    // No está en caché: se descarga.
  }

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const result: Download = {
    status: response.status,
    contentType: response.headers.get("content-type"),
    bytes: Buffer.from(await response.arrayBuffer()),
  };
  if (result.status === 200 && result.contentType?.startsWith("image/")) {
    await writeFile(key, result.bytes);
    await writeFile(`${key}.type`, result.contentType);
  }
  return result;
};

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

runDbScript(async (sql) => {
  const source = arg("source") ?? "padelzoom";
  const dryRun = process.argv.includes("--dry-run");
  const recheck = process.argv.includes("--recheck");
  const limit = Number(arg("limit")) || undefined;

  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!dryRun && (!url || !serviceKey)) {
    throw new Error(
      "Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local (ver .env.example). " +
        "Sin ellas no se puede guardar en Storage; usa --dry-run para analizar sin guardar.",
    );
  }

  await mkdir(CACHE_DIR, { recursive: true });
  const storage =
    !dryRun && url && serviceKey
      ? createSupabaseStorage({ url, serviceKey })
      : createMemoryStorage().storage;

  console.log(`Imágenes de «${source}»${dryRun ? " (simulación: no se guarda nada)" : ""}…`);
  const report = await importMedia({
    source,
    repository: createPostgresMediaRepository(sql),
    storage,
    download,
    dryRun,
    recheck,
    limit,
    pauseMs: PAUSE_MS,
    onProgress: (done, total) => {
      if (done % 50 === 0 || done === total) console.log(`  ${done}/${total}`);
    },
  });

  console.log(`
Por descargar:   ${report.total}
Descargadas:     ${report.downloaded}
Fallidas:        ${report.failed.length}
Verificadas:     ${report.verified}
Pendientes:      ${report.pending}
Rechazadas:      ${report.rejected}
Duplicadas:      ${report.duplicates.length}
${dryRun ? "Se subirían" : "Subidas"}:     ${report.uploaded} archivos, ${megabytes(report.uploadedBytes)}`);

  const byNote = new Map<string, string[]>();
  for (const image of report.images) {
    if (image.status === "verified") continue;
    // El motivo sin las cifras concretas, para agrupar.
    const reason = `${image.status}: ${(image.note ?? "").replace(/\(.*?\)/g, "").trim()}`;
    byNote.set(reason, [...(byNote.get(reason) ?? []), image.slug]);
  }
  for (const [reason, slugs] of byNote) {
    console.log(`\n${reason} — ${slugs.length}`);
    console.log(`  ${slugs.slice(0, 8).join(", ")}${slugs.length > 8 ? "…" : ""}`);
  }
  for (const failure of report.failed.slice(0, 20)) {
    console.log(`\nFALLO ${failure.slug}: ${failure.error}\n  ${failure.sourceUrl}`);
  }

  if (dryRun) {
    await writeFile(join(process.cwd(), "var", "media-dry-run.json"), JSON.stringify(report, null, 2));
    console.log("\nDetalle en var/media-dry-run.json");
  }
});
