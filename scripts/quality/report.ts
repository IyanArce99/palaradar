// Panel interno de calidad de datos. SOLO LECTURA: lee el catálogo, los productos
// de tienda y las ejecuciones de ingestión, y genera var/quality-report.html
// (autocontenido, con filtros). No cambia ningún dato ni ningún estado.
//   npm run quality:report
//
// Es un informe local y no una página de la web a propósito: la web no tiene
// autenticación de administración, y un panel con la cola de revisión no puede
// quedar detrás de una dirección que solo «no se enlaza». Ver docs/roadmap-v5.md.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { activeStores } from "@/data/db/sources";
import {
  buildQualityReport,
  ISSUE_TYPES,
  NATURE_LABELS,
  type Issue,
  type PendingStoreProduct,
  type QualityReport,
  type RacketQualityRow,
  type StoreHealth,
} from "@/quality/report";
import type { Spec } from "@/types/catalog";
import { runDbScript } from "../db/run";

const OUTPUT = join(process.cwd(), "var", "quality-report.html");

interface RacketRow extends Omit<RacketQualityRow, "hasTouch" | "hasCore" | "hasFaces" | "gtins" | "source"> {
  hardness: string | null;
  technical_specs: Spec[];
  gtins: string[] | null;
  specs_source_url: string | null;
}

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);

function hostname(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Solo enlaces http(s): lo que viene de una tienda no se pone tal cual en un href. */
function safeUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function matchHtml(issue: Issue): string {
  if (!issue.match) return "";
  const { suggestions, verdict } = issue.match;
  const rows = suggestions
    .map(
      (item) => `
        <li>
          <strong>${escape(`${item.candidate.brand} ${item.candidate.model} ${item.candidate.year}`)}</strong>
          <span class="tag c-${item.confidence}">confianza ${item.confidence}</span>
          <span class="muted">${item.score} / 100 · nombres ${Math.round(item.nameSimilarity * 100)} %</span>
          <div class="muted">${escape(item.candidate.slug)}</div>
          ${item.reasons.map((text) => `<div class="pro">+ ${escape(text)}</div>`).join("")}
          ${item.differences.map((text) => `<div class="con">− ${escape(text)}</div>`).join("")}
        </li>`,
    )
    .join("");
  return `<div class="match"><p><strong>${escape(verdict)}</strong></p>${rows ? `<ol>${rows}</ol>` : ""}</div>`;
}

function issueHtml(issue: Issue): string {
  const url = safeUrl(issue.url);
  const data = [
    `data-type="${issue.type}"`,
    `data-nature="${issue.nature}"`,
    `data-severity="${issue.severity}"`,
    `data-brand="${escape(issue.brand ?? "")}"`,
    `data-store="${escape(issue.store ?? "")}"`,
    `data-source="${escape(issue.source ?? "")}"`,
    `data-review="${issue.review}"`,
    `data-age="${issue.ageDays ?? ""}"`,
  ].join(" ");
  return `
    <article ${data}>
      <header>
        <span class="tag s-${issue.severity}">${issue.severity}</span>
        <span class="tag">${escape(NATURE_LABELS[issue.nature])}</span>
        <span class="tag">${escape(ISSUE_TYPES[issue.type])}</span>
        ${issue.store ? `<span class="tag">${escape(issue.store)}</span>` : ""}
        ${issue.ageDays === null ? "" : `<span class="muted">${issue.ageDays} ${issue.ageDays === 1 ? "día" : "días"}</span>`}
      </header>
      <h3>${escape(issue.subject)}</h3>
      ${issue.slug ? `<p class="muted">/pala/${escape(issue.slug)}/</p>` : ""}
      <p>${escape(issue.detail)}</p>
      ${url ? `<p><a href="${escape(url)}" rel="noopener noreferrer" target="_blank">Ver el producto en la tienda</a></p>` : ""}
      ${matchHtml(issue)}
    </article>`;
}

function options(values: (string | null)[], labels?: Record<string, string>): string {
  const unique = [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "es"));
  return unique.map((value) => `<option value="${escape(value)}">${escape(labels?.[value] ?? value)}</option>`).join("");
}

function render(report: QualityReport): string {
  const { metrics, issues } = report;
  const row = (label: string, count: number, percent: number) =>
    `<tr><th>${escape(label)}</th><td>${count}</td><td>${String(percent).replace(".", ",")} %</td></tr>`;
  const stores = metrics.stores
    .map(
      (store: StoreHealth) =>
        `<tr><th>${escape(store.store)}</th><td>${store.lastSuccessAt ? escape(store.lastSuccessAt.slice(0, 16).replace("T", " ")) : "—"}</td><td>${store.recentFailures}</td><td>${store.matched}</td><td>${store.pending}</td></tr>`,
    )
    .join("");
  const age = metrics.priceAgeHours;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>PalaRadar · calidad de datos</title>
<style>
  body{font:15px/1.5 system-ui,sans-serif;margin:0;color:#15171a;background:#f5f6f2}
  main{max-width:1180px;margin:0 auto;padding:24px}
  h1{font-size:28px;margin:0 0 4px} h2{font-size:19px;margin:28px 0 8px} h3{font-size:16px;margin:6px 0 2px}
  .muted{color:#6b6f66;font-size:13px} .grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
  table{border-collapse:collapse;width:100%;background:#fff;border-radius:12px;overflow:hidden}
  th,td{text-align:left;padding:7px 12px;border-top:1px solid #e6e8e1;font-weight:400} td{font-variant-numeric:tabular-nums;white-space:nowrap}
  thead th{font-weight:700;border-top:0;background:#eceee7}
  form{display:flex;flex-wrap:wrap;gap:8px;background:#fff;padding:12px;border-radius:12px;position:sticky;top:0;border:1px solid #e6e8e1}
  select,input{font:inherit;padding:7px 9px;border:1px solid #c9ccc2;border-radius:8px;background:#fff;max-width:220px}
  article{background:#fff;border-radius:12px;padding:14px 16px;margin-top:10px;border:1px solid #e6e8e1}
  .tag{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;background:#eceee7;margin-right:4px}
  .s-alta{background:#15171a;color:#d7f751} .s-media{background:#d7f751} .c-alta{background:#d7f751} .c-baja{background:#f1d9d4}
  .match{background:#f5f6f2;border-radius:10px;padding:10px 12px;margin-top:8px} .match ol{margin:6px 0 0;padding-left:20px} .match li{margin-top:8px}
  .pro{color:#2f5d1c;font-size:13px} .con{color:#8a2a17;font-size:13px}
  [hidden]{display:none}
</style></head><body><main>
<h1>Calidad de datos</h1>
<p class="muted">Generado el ${escape(report.generatedAt.slice(0, 16).replace("T", " "))} UTC. Informe de solo lectura: no modifica ningún dato. Archivo local, no lo publiques.</p>

<div class="grid">
  <section><h2>Catálogo · ${metrics.total} palas disponibles</h2>
    <table><thead><tr><th>Indicador</th><th>Palas</th><th>%</th></tr></thead><tbody>
    ${metrics.indicators.map((item) => row(item.label, item.count, item.percent)).join("")}
    </tbody></table></section>
  <section><h2>Información suficiente para…</h2>
    <table><thead><tr><th>Función</th><th>Palas</th><th>%</th></tr></thead><tbody>
    ${metrics.readiness.map((item) => row(item.label, item.count, item.percent)).join("")}
    </tbody></table>
    <h2>Antigüedad de los precios vigentes</h2>
    <table><tbody>
      <tr><th>Más reciente</th><td>${age.newest ?? "—"} h</td></tr>
      <tr><th>Mediana</th><td>${age.median ?? "—"} h</td></tr>
      <tr><th>Más antiguo</th><td>${age.oldest ?? "—"} h</td></tr>
    </tbody></table></section>
</div>

<h2>Tiendas</h2>
<table><thead><tr><th>Tienda</th><th>Última ingestión correcta (UTC)</th><th>Fallos en 7 días</th><th>Productos enlazados</th><th>En revisión</th></tr></thead><tbody>${stores}</tbody></table>

<h2>Incidencias · <span id="shown">${issues.length}</span> de ${issues.length}</h2>
<p class="muted">Alta ${metrics.bySeverity.alta} · media ${metrics.bySeverity.media} · baja ${metrics.bySeverity.baja}. Una incidencia no es siempre un error: mira su naturaleza.</p>
<form id="filters" onsubmit="return false">
  <select name="severity"><option value="">Gravedad</option><option>alta</option><option>media</option><option>baja</option></select>
  <select name="nature"><option value="">Naturaleza</option>${options(issues.map((issue) => issue.nature), NATURE_LABELS)}</select>
  <select name="type"><option value="">Tipo</option>${options(issues.map((issue) => issue.type), ISSUE_TYPES)}</select>
  <select name="brand"><option value="">Marca</option>${options(issues.map((issue) => issue.brand))}</select>
  <select name="store"><option value="">Tienda</option>${options(issues.map((issue) => issue.store))}</select>
  <select name="source"><option value="">Fuente de datos</option>${options(issues.map((issue) => issue.source))}</select>
  <select name="review"><option value="">Estado de revisión</option><option value="sin-revisar">Sin revisar</option><option value="en-cola">En la cola de emparejamiento</option></select>
  <select name="age"><option value="">Antigüedad</option><option value="2">2 días o más</option><option value="7">7 días o más</option><option value="30">30 días o más</option></select>
  <input name="text" type="search" placeholder="Modelo o texto">
</form>
<div id="issues">${issues.map(issueHtml).join("")}</div>
</main>
<script>
  const form = document.getElementById("filters");
  const items = [...document.querySelectorAll("#issues article")];
  function apply() {
    const f = Object.fromEntries(new FormData(form));
    const text = (f.text || "").toLowerCase();
    let shown = 0;
    for (const el of items) {
      const d = el.dataset;
      const ok = ["severity", "nature", "type", "brand", "store", "source", "review"].every((key) => !f[key] || d[key] === f[key])
        && (!f.age || (d.age !== "" && Number(d.age) >= Number(f.age)))
        && (!text || el.textContent.toLowerCase().includes(text));
      el.hidden = !ok;
      if (ok) shown++;
    }
    document.getElementById("shown").textContent = shown;
  }
  form.addEventListener("input", apply);
</script>
</body></html>`;
}

runDbScript(async (sql) => {
  // Las tres consultas son SELECT. Ninguna escribe.
  const [rackets, pending, stores] = await Promise.all([
    sql<RacketRow[]>`
      select r.id, r.slug, b.name as brand, r.model, r.year, r.shape::text as shape,
        (c.photo_path is not null) as "hasPhoto", c.best_price as "bestPrice", c.price_checked_at as "priceCheckedAt",
        coalesce(c.store_count, 0)::int as "storeCount", r.weight_min as "weightMin", r.weight_max as "weightMax",
        r.balance::text as balance, r.play_style::text as "playStyle", r.levels::text[] as levels,
        r.hardness, r.technical_specs, r.msrp, r.specs_source_url,
        (select array_agg(i.value order by i.value) from racket_identifiers i
          where i.racket_id = r.id and i.type::text = 'gtin') as gtins,
        exists (select 1 from racket_identifiers i
          where i.racket_id = r.id and i.type::text = 'manufacturer_ref') as "hasManufacturerRef",
        exists (select 1 from racket_facts f where f.racket_id = r.id and f.kind = 'rating') as "hasRatings",
        (select count(*)::int from racket_fact_conflicts x where x.racket_id = r.id) as conflicts
      from rackets r
      join brands b on b.id = r.brand_id
      join racket_catalog c on c.id = r.id
      where r.is_available
      order by r.slug`,
    sql<PendingStoreProduct[]>`
      select s.name as store, p.title, p.brand, p.gtin, p.url, p.matching_note as note, p.price,
        p.last_seen_at as "lastSeenAt"
      from store_products p join stores s on s.id = p.store_id
      where p.matching_status = 'pending_review' and ${activeStores(sql, "s", false)}
      order by s.name, p.title`,
    sql<StoreHealth[]>`
      select s.name as store,
        (select max(r.finished_at) from ingestion_runs r where r.store_id = s.id and r.status = 'success') as "lastSuccessAt",
        (select count(*)::int from ingestion_runs r
          where r.store_id = s.id and r.status = 'failed' and r.started_at > now() - interval '7 days') as "recentFailures",
        (select left(r.error_message, 160) from ingestion_runs r
          where r.store_id = s.id and r.status = 'failed' and r.started_at > now() - interval '7 days'
          order by r.started_at desc limit 1) as "lastError",
        (select count(*)::int from store_products p where p.store_id = s.id and p.matching_status = 'matched') as matched,
        (select count(*)::int from store_products p where p.store_id = s.id and p.matching_status = 'pending_review') as pending
      from stores s
      where ${activeStores(sql, "s", false)}
      order by s.name`,
  ]);

  const toIso = (value: unknown) => (value ? new Date(value as string).toISOString() : null);
  const report = buildQualityReport(
    {
      rackets: rackets.map((row) => {
        const spec = (label: string) => row.technical_specs.some((item) => item.label === label && item.value.trim() !== "");
        return {
          ...row,
          bestPrice: row.bestPrice === null ? null : Number(row.bestPrice),
          msrp: row.msrp === null ? null : Number(row.msrp),
          priceCheckedAt: toIso(row.priceCheckedAt),
          hasTouch: spec("Tacto") || Boolean(row.hardness?.trim()),
          hasCore: spec("Núcleo"),
          hasFaces: spec("Caras"),
          gtins: row.gtins ?? [],
          source: hostname(row.specs_source_url),
        };
      }),
      pending: pending.map((item) => ({ ...item, price: item.price === null ? null : Number(item.price), lastSeenAt: toIso(item.lastSeenAt) })),
      stores: stores.map((store) => ({ ...store, lastSuccessAt: toIso(store.lastSuccessAt) })),
    },
    new Date(),
  );

  await mkdir(join(process.cwd(), "var"), { recursive: true });
  await writeFile(OUTPUT, render(report), "utf8");

  const { metrics } = report;
  console.log(`Calidad de datos · ${metrics.total} palas disponibles`);
  for (const item of metrics.indicators) console.log(`  ${item.label}: ${item.count} (${item.percent} %)`);
  console.log("Información suficiente para:");
  for (const item of metrics.readiness) console.log(`  ${item.label}: ${item.count} (${item.percent} %)`);
  console.log(`Productos de tienda en revisión: ${metrics.pendingMatches}`);
  console.log(
    `Incidencias: ${report.issues.length} (alta ${metrics.bySeverity.alta}, media ${metrics.bySeverity.media}, baja ${metrics.bySeverity.baja})`,
  );
  for (const [nature, label] of Object.entries(NATURE_LABELS)) {
    console.log(`  ${label}: ${metrics.byNature[nature as keyof typeof NATURE_LABELS]}`);
  }
  console.log(`\nInforme: ${OUTPUT}`);
});
