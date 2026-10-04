// Carga un catálogo enriquecido (catalog/types.ts) en la base de datos. Es
// repetible: volver a cargar el mismo fichero deja lo mismo. No borra palas,
// precios ni histórico, y no pisa lo que una persona haya fijado a mano.
import { inTransaction, type Sql } from "@/data/db/client";
import { tryPriceWriteLock } from "@/data/db/lock";
import { normalizeGtin } from "@/ingestion/gtin";
import { normalizeBrand } from "@/ingestion/title";
import { genericArtPath, publishedValues, slugify, stableId, toShape } from "./normalize";
import type { CatalogImport, ImportRacket } from "./types";

const CHUNK = 500;

/**
 * Fuentes cuyas imágenes hemos aprobado mostrar en PalaRadar, con la base de esa
 * decisión. Es una aprobación interna (`rights_status`), no una licencia.
 */
const MEDIA_RIGHTS: Record<string, string | undefined> = {
  padelzoom:
    "Aprobación interna para mostrarla en PalaRadar (octubre de 2026). No acredita licencia ni titularidad: es una foto de catálogo obtenida de PadelZoom. Sustituible por una imagen de fabricante, tienda u otra fuente con derechos claros.",
};

function chunks<T>(rows: T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK) result.push(rows.slice(i, i + CHUNK));
  return result;
}

/** Literal de array de PostgreSQL: {"a","b"}. */
function pgArray(values: readonly string[]): string {
  const quoted = values.map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  return `{${quoted.join(",")}}`;
}

export interface LoadSummary {
  rackets: number;
  created: number;
  enrichedExisting: number;
  unavailable: number;
  brandsCreated: number;
  facts: number;
  identifiers: number;
  identifiersSkipped: number;
  content: number;
  media: number;
  legacyUrls: number;
  storeLinks: number;
  storeLinksMissing: number;
}

interface Resolved {
  item: ImportRacket;
  id: string;
  slug: string;
  isNew: boolean;
}

/** Comprueba el fichero antes de tocar la base de datos. */
export function validateImport(data: CatalogImport): void {
  const sources = new Set(data.sources.map((source) => source.slug));
  const slugs = new Map<string, string>();

  for (const racket of data.rackets) {
    if (!racket.brand || !racket.model || !Number.isInteger(racket.year)) {
      throw new Error(`Pala «${racket.key}» sin marca, modelo o año.`);
    }
    const slug = racket.existingSlug ?? slugify(`${racket.brand} ${racket.model} ${racket.year}`);
    const other = slugs.get(slug);
    if (other) throw new Error(`Las palas «${other}» y «${racket.key}» darían la misma dirección (${slug}).`);
    slugs.set(slug, racket.key);

    const selected = new Set<string>();
    for (const fact of racket.facts) {
      if (!sources.has(fact.source)) throw new Error(`Fuente desconocida «${fact.source}» en «${racket.key}».`);
      if (!fact.value) throw new Error(`Dato vacío (${fact.attribute}) en «${racket.key}»: lo que no se sabe no se carga.`);
      if (fact.selected) {
        if (selected.has(fact.attribute)) throw new Error(`Dos valores elegidos para ${fact.attribute} en «${racket.key}».`);
        if (fact.confidence === "review") throw new Error(`Un dato en revisión no puede publicarse (${fact.attribute}, «${racket.key}»).`);
        selected.add(fact.attribute);
      }
    }
  }
}

export async function loadCatalog(sql: Sql, data: CatalogImport, now: Date = new Date()): Promise<LoadSummary> {
  validateImport(data);
  const observedAt = data.generatedAt;
  const today = now.toISOString().slice(0, 10);

  return inTransaction(sql, async (tx) => {
    // Cambia emparejamientos de productos de tienda: no debe coincidir con una ingestión.
    if (!(await tryPriceWriteLock(tx))) {
      throw new Error("Hay una ingestión de precios en marcha. Repite la carga cuando termine.");
    }

    for (const batch of chunks(data.sources)) {
      await tx`
        insert into data_sources ${tx(batch)}
        on conflict (slug) do update set name = excluded.name, kind = excluded.kind, url = excluded.url`;
    }

    // --- Marcas: se reconocen aunque cambie la escritura («Star Vie» = «StarVie») ---
    const brandRows = await tx<{ id: string; name: string }[]>`select id, name from brands`;
    const brandIds = new Map(brandRows.map((brand) => [normalizeBrand(brand.name), brand.id]));
    let brandsCreated = 0;
    for (const name of new Set(data.rackets.map((racket) => racket.brand))) {
      if (brandIds.has(normalizeBrand(name))) continue;
      const slug = slugify(name);
      const [created] = await tx<{ id: string }[]>`
        insert into brands (id, slug, name, description) values (${stableId(`brand:${slug}`)}, ${slug}, ${name}, '')
        on conflict (slug) do update set name = brands.name returning id`;
      brandIds.set(normalizeBrand(name), created.id);
      brandsCreated++;
    }
    const brandNames = new Map(
      (await tx<{ id: string; name: string }[]>`select id, name from brands`).map((brand) => [brand.id, brand.name]),
    );

    // --- Palas ---
    const existing = await tx<{ id: string; slug: string }[]>`select id, slug from rackets`;
    const idBySlug = new Map(existing.map((racket) => [racket.slug, racket.id]));
    const resolved: Resolved[] = [];
    let unavailable = 0;

    for (const item of data.rackets) {
      const brandId = brandIds.get(normalizeBrand(item.brand)) as string;
      const published = publishedValues(item.facts);
      // `shape` es obligatoria en la tabla: sin forma elegida se guarda la de alguna fuente, y la pala no se ofrece.
      const fallbackShape = item.facts.map((fact) => (fact.attribute === "shape" ? toShape(fact.value) : null)).find(Boolean);
      const shape = published.shape ?? fallbackShape;
      if (!shape) throw new Error(`«${item.key}» no tiene ninguna forma: no se puede cargar.`);
      const available = item.available && published.shape !== null;
      if (!available) unavailable++;
      const reason = available ? null : (item.unavailableReason ?? "Forma sin resolver entre las fuentes.");

      if (item.existingSlug) {
        const id = idBySlug.get(item.existingSlug);
        if (!id) throw new Error(`«${item.key}» apunta a una pala que no existe: ${item.existingSlug}.`);
        // Pala que ya estaba: sus datos verificados se respetan; solo se rellenan huecos y campos nuevos.
        await tx`
          update rackets set
            balance = coalesce(balance, ${published.balance}::pala_balance),
            play_style = coalesce(play_style, ${published.playStyle}::play_style),
            levels = case when levels = '{}' then ${pgArray(published.levels)}::player_level[] else levels end,
            weight_min = coalesce(weight_min, ${published.weightMin}),
            weight_max = coalesce(weight_max, ${published.weightMax}),
            player = ${item.player}, variants = ${pgArray(item.variants)}::text[],
            gender = ${published.gender}, thickness_mm = ${published.thicknessMm},
            surface = ${published.surface}, finish = ${published.finish}, hardness = ${published.hardness},
            msrp = ${published.msrp},
            enrichment_level = greatest(enrichment_level, ${published.enrichmentLevel})
          where id = ${id}`;
        resolved.push({ item, id, slug: item.existingSlug, isNew: false });
        continue;
      }

      const slug = slugify(`${brandNames.get(brandId)} ${item.model} ${item.year}`);
      const id = idBySlug.get(slug) ?? stableId(`racket:${slug}`);
      const specs = tx.json(published.technicalSpecs as unknown as Parameters<Sql["json"]>[0]);
      await tx`
        insert into rackets (
          id, slug, brand_id, model, year, images, shape, balance, play_style, levels,
          weight_min, weight_max, description, editorial_summary, editorial_status, ideal_for,
          editorial_updated_at, technical_specs, specs_source_url,
          player, variants, gender, thickness_mm, surface, finish, hardness, msrp,
          is_available, unavailable_reason, enrichment_level
        ) values (
          ${id}, ${slug}, ${brandId}, ${item.model}, ${item.year},
          ${pgArray([genericArtPath(shape, slug)])}::text[],
          ${shape}::pala_shape, ${published.balance}::pala_balance, ${published.playStyle}::play_style,
          ${pgArray(published.levels)}::player_level[],
          ${published.weightMin}, ${published.weightMax}, ${published.description}, ${published.description},
          'draft', ${pgArray(published.idealFor)}::text[], ${today}, ${specs}, ${published.specsSourceUrl},
          ${item.player}, ${pgArray(item.variants)}::text[], ${published.gender}, ${published.thicknessMm},
          ${published.surface}, ${published.finish}, ${published.hardness}, ${published.msrp},
          ${available}, ${reason}, ${published.enrichmentLevel}
        )
        on conflict (slug) do update set
          brand_id = excluded.brand_id, model = excluded.model, year = excluded.year,
          shape = excluded.shape, balance = excluded.balance, play_style = excluded.play_style,
          levels = excluded.levels, weight_min = excluded.weight_min, weight_max = excluded.weight_max,
          technical_specs = excluded.technical_specs, specs_source_url = excluded.specs_source_url,
          player = excluded.player, variants = excluded.variants, gender = excluded.gender,
          thickness_mm = excluded.thickness_mm, surface = excluded.surface, finish = excluded.finish,
          hardness = excluded.hardness, msrp = excluded.msrp,
          is_available = excluded.is_available, unavailable_reason = excluded.unavailable_reason,
          enrichment_level = greatest(rackets.enrichment_level, excluded.enrichment_level),
          -- El texto solo se regenera mientras siga siendo un borrador automático.
          description = case when rackets.editorial_status = 'draft' then excluded.description else rackets.description end,
          editorial_summary = case when rackets.editorial_status = 'draft' then excluded.editorial_summary else rackets.editorial_summary end,
          ideal_for = case when rackets.editorial_status = 'draft' then excluded.ideal_for else rackets.ideal_for end`;
      resolved.push({ item, id, slug, isNew: !idBySlug.has(slug) });
    }

    // --- Observaciones ---
    const factRows = resolved.flatMap(({ item, id }) =>
      item.facts.map((fact) => ({
        racket_id: id,
        attribute: fact.attribute,
        value: fact.value,
        raw_value: fact.raw,
        unit: fact.unit,
        source: fact.source,
        source_url: fact.url,
        observed_at: observedAt,
        kind: fact.kind,
        confidence: fact.confidence,
      })),
    );
    for (const batch of chunks(factRows)) {
      await tx`
        insert into racket_facts ${tx(batch)}
        on conflict (racket_id, attribute, source) do update set
          value = excluded.value, raw_value = excluded.raw_value, unit = excluded.unit,
          source_url = excluded.source_url, observed_at = excluded.observed_at,
          kind = excluded.kind, confidence = excluded.confidence`;
    }

    // El valor elegido se marca aparte: primero se quita la marca anterior (salvo lo fijado a mano)
    // y después se pone la nueva, solo donde nadie ha fijado otro valor para ese atributo.
    const racketIds = resolved.map(({ id }) => id);
    for (const batch of chunks(racketIds)) {
      await tx`update racket_facts set selected = false where racket_id in ${tx(batch)} and selected and not pinned`;
    }
    const selections = resolved.flatMap(({ item, id }) =>
      item.facts.filter((fact) => fact.selected).map((fact) => [id, fact.attribute, fact.source]),
    );
    for (const batch of chunks(selections)) {
      await tx`
        update racket_facts f set selected = true
        from (values ${tx(batch)}) as v (racket_id, attribute, source)
        where f.racket_id = v.racket_id::uuid and f.attribute = v.attribute and f.source = v.source
          and not exists (
            select 1 from racket_facts p
            where p.racket_id = f.racket_id and p.attribute = f.attribute and p.selected and p.pinned
          )`;
    }

    // --- Identificadores: cada uno pertenece a una sola pala; si ya está asignado, no se mueve ---
    const identifierRows = resolved.flatMap(({ item, id }) =>
      item.identifiers.flatMap((identifier) => {
        const value = identifier.type === "gtin" ? normalizeGtin(identifier.value) : identifier.value;
        return value
          ? [{ racket_id: id, type: identifier.type, value, source: identifier.source, verified_at: observedAt }]
          : [];
      }),
    );
    // Un mismo identificador repetido dentro del fichero solo puede ir a la primera pala.
    const seenIdentifiers = new Set<string>();
    const uniqueIdentifiers = identifierRows.filter((row) => {
      const key = `${row.type}|${row.value}`;
      if (seenIdentifiers.has(key)) return false;
      seenIdentifiers.add(key);
      return true;
    });
    let identifiers = 0;
    for (const batch of chunks(uniqueIdentifiers)) {
      const inserted = await tx`
        insert into racket_identifiers ${tx(batch)}
        on conflict (type, value) do nothing returning value`;
      identifiers += inserted.length;
    }
    // Cuántos han quedado en la pala que decía el fichero (el resto ya eran de otra).
    let owned = 0;
    for (const batch of chunks(uniqueIdentifiers)) {
      const [row] = await tx<{ owned: number }[]>`
        select count(*)::int as owned from racket_identifiers i
        join (values ${tx(batch.map((item) => [item.type, item.value, item.racket_id]))}) as v (type, value, racket_id)
          on i.type::text = v.type and i.value = v.value and i.racket_id = v.racket_id::uuid`;
      owned += row.owned;
    }

    // --- Contenido de las fuentes, imágenes de referencia y direcciones heredadas ---
    const contentRows = resolved.flatMap(({ item, id }) =>
      item.content.map((content) => ({ racket_id: id, source: content.source, kind: content.kind, body: content.body, url: content.url, words: content.words, fetched_at: observedAt })),
    );
    for (const batch of chunks(contentRows)) {
      await tx`
        insert into racket_source_content ${tx(batch)}
        on conflict (racket_id, source, kind) do update set
          body = excluded.body, url = excluded.url, words = excluded.words, fetched_at = excluded.fetched_at`;
    }
    // La imagen viene de la misma ficha que la pala: la asociación es directa. Los
    // derechos parten de lo acordado con cada fuente; el resto, pendiente.
    const mediaRows = resolved.flatMap(({ item, id }) =>
      item.media.map((media) => ({
        racket_id: id,
        source: media.source,
        source_url: media.url,
        matching_method: "source_page",
        matching_confidence: "high",
        rights_status: MEDIA_RIGHTS[media.source] ? "approved" : "pending",
        rights_note: MEDIA_RIGHTS[media.source] ?? null,
      })),
    );
    for (const batch of chunks(mediaRows)) {
      await tx`insert into racket_media ${tx(batch)} on conflict (racket_id, source_url) do nothing`;
    }
    const urlRows = resolved.flatMap(({ item, id }) =>
      item.legacyUrls.map((url) => ({ source: url.source, path: url.path, racket_id: id })),
    );
    for (const batch of chunks(urlRows)) {
      await tx`
        insert into legacy_urls ${tx(batch)}
        on conflict (source, path) do update set racket_id = excluded.racket_id`;
    }

    // --- Emparejamientos con productos de tienda ---
    // Quedan como decisión fijada: la ingestión los respeta y no los recalcula.
    const links = resolved.flatMap(({ item, id }) =>
      item.storeLinks.map((link) => [link.store, link.externalId, id, link.confidence, link.reason]),
    );
    let storeLinks = 0;
    for (const batch of chunks(links)) {
      const updated = await tx`
        update store_products p set
          racket_id = v.racket_id::uuid,
          matching_status = 'matched',
          matching_method = 'manual',
          matching_confidence = v.confidence,
          matching_note = v.reason
        from (values ${tx(batch)}) as v (store, external_id, racket_id, confidence, reason)
        join stores s on s.slug = v.store
        where p.store_id = s.id and p.external_id = v.external_id
        returning p.id`;
      storeLinks += updated.length;
    }

    return {
      rackets: resolved.length,
      created: resolved.filter((racket) => racket.isNew).length,
      enrichedExisting: resolved.filter((racket) => racket.item.existingSlug).length,
      unavailable,
      brandsCreated,
      facts: factRows.length,
      identifiers,
      identifiersSkipped: uniqueIdentifiers.length - owned + (identifierRows.length - uniqueIdentifiers.length),
      content: contentRows.length,
      media: mediaRows.length,
      legacyUrls: urlRows.length,
      storeLinks,
      storeLinksMissing: links.length - storeLinks,
    };
  });
}
