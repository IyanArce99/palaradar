// Contenido propio: colecciones del catálogo y guías. Se comprueba que es
// coherente (enlaces que existen, filtros válidos) y que las guías no afirman
// de una pala nada que no salga de sus datos.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collections, getCollection } from "@/content/collections";
import { getGuide, guides } from "@/content/guides";
import { createMemoryRepository } from "@/data/memory-repository";
import { collectionForQuery, collectionsForPala, listingHref } from "@/lib/catalog/collections";
import { DEFAULT_QUERY } from "@/lib/catalog/query";
import { catalogSeo } from "@/lib/catalog/seo";
import { pickHighlights, pickReason, pickTraits, readingMinutes } from "@/lib/guides";
import type { Pala } from "@/types/catalog";

const repository = createMemoryRepository();

describe("colecciones del catálogo", () => {
  it("cada una tiene slug único, texto, preguntas y un filtro", () => {
    assert.equal(new Set(collections.map((c) => c.slug)).size, collections.length);
    for (const collection of collections) {
      assert.match(collection.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, collection.slug);
      assert.ok(collection.intro.length >= 2, `${collection.slug}: texto`);
      assert.ok(collection.faq.length >= 2, `${collection.slug}: preguntas`);
      assert.ok(Object.keys(collection.query).length > 0, `${collection.slug}: filtro`);
      assert.ok(collection.description.length >= 80 && collection.description.length <= 170, `${collection.slug}: descripción`);
    }
  });

  it("solo enlazan a colecciones y guías que existen", () => {
    for (const collection of collections) {
      for (const slug of collection.related) assert.ok(getCollection(slug), `${collection.slug} → ${slug}`);
      if (collection.guide) assert.ok(getGuide(collection.guide), `${collection.slug} → guía ${collection.guide}`);
    }
  });

  it("ningún slug de colección coincide con el de una marca", async () => {
    const brands = new Set((await repository.getBrands()).map((brand) => brand.slug));
    for (const collection of collections) assert.ok(!brands.has(collection.slug), collection.slug);
  });

  it("no prometen salud ni resultados", () => {
    assert.doesNotMatch(JSON.stringify(collections), /lesi[oó]n|epicondilitis|codo de tenista|garantiza|te har[aá] ganar/i);
  });

  it("los filtros exactos de una colección llevan a su página; con algo más, no", () => {
    const redondas = { ...DEFAULT_QUERY, shapes: ["redonda" as const] };
    assert.equal(collectionForQuery(redondas)?.slug, "redondas");
    assert.equal(collectionForQuery({ ...redondas, balances: ["alto"] }), null);
    assert.equal(collectionForQuery({ ...redondas, sort: "precio" }), null);
    assert.equal(collectionForQuery({ ...redondas, q: "nox" }), null);

    assert.equal(listingHref({ styles: ["control"] }), "/palas-padel/control/");
    assert.equal(listingHref({ shapes: ["redonda"], balances: ["alto"] }), "/palas-padel/?forma=redonda&balance=alto");
  });

  it("el catálogo filtrado declara como canónica la página de la colección", () => {
    assert.deepEqual(catalogSeo({ ...DEFAULT_QUERY, maxPrice: 150 }), {
      canonical: "/palas-padel/menos-de-150-euros/",
      index: true,
    });
    assert.deepEqual(catalogSeo({ ...DEFAULT_QUERY, maxPrice: 150, page: 2 }), {
      canonical: "/palas-padel/menos-de-150-euros/?pagina=2",
      index: true,
    });
    assert.deepEqual(catalogSeo({ ...DEFAULT_QUERY, maxPrice: 137 }), { canonical: null, index: false });
  });

  it("una pala entra en las colecciones que le corresponden por sus datos y su precio de hoy", () => {
    const pala = { shape: "redonda", playStyle: "control", levels: ["iniciacion"], year: 2026, price: 89 };
    assert.deepEqual(
      collectionsForPala(pala).map((c) => c.slug),
      ["redondas", "control", "principiantes", "menos-de-100-euros", "menos-de-150-euros", "menos-de-200-euros", "2026"],
    );
    // Sin precio vigente no entra en las de precio; sin estilo declarado, en ninguna de juego.
    assert.deepEqual(
      collectionsForPala({ ...pala, playStyle: null, price: null }).map((c) => c.slug),
      ["redondas", "principiantes", "2026"],
    );
  });

  it("una colección con dos filtros exige los dos: sin balance declarado no es «manejable»", () => {
    const pala = { shape: "redonda", playStyle: null, levels: [], year: 2024, price: null };
    const slugs = (balance: string | null) => collectionsForPala({ ...pala, balance }).map((c) => c.slug);
    assert.deepEqual(slugs("bajo"), ["redondas", "manejables"]);
    assert.deepEqual(slugs("alto"), ["redondas"]);
    assert.deepEqual(slugs(null), ["redondas"]);
    assert.equal(listingHref({ shapes: ["redonda"], balances: ["bajo"] }), "/palas-padel/manejables/");
  });
});

describe("guías", () => {
  it("cada una tiene slug único, texto, preguntas y enlaces que existen", () => {
    assert.equal(new Set(guides.map((g) => g.slug)).size, guides.length);
    for (const guide of guides) {
      assert.ok(guide.intro.length >= 2, `${guide.slug}: introducción`);
      assert.ok(guide.faq.length >= 3, `${guide.slug}: preguntas`);
      assert.ok(guide.picks.length + guide.blocks.length >= 3, `${guide.slug}: apartados`);
      assert.match(guide.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
      for (const slug of guide.collections) assert.ok(getCollection(slug), `${guide.slug} → ${slug}`);
      assert.ok(readingMinutes(guide) >= 1);

      const ids = [...guide.picks.map((p) => p.id), ...guide.blocks.map((b) => b.id)];
      assert.equal(new Set(ids).size, ids.length, `${guide.slug}: anclas repetidas`);
    }
  });

  it("el texto no nombra palas concretas ni cita pruebas u opiniones propias", () => {
    const text = JSON.stringify(guides);
    // Las palas las pone el catálogo del día, no el texto.
    assert.doesNotMatch(text, /Vertex|Metalbone|AT10|Hack 0|Speed Pro|ML10/);
    assert.doesNotMatch(text, /hemos probado|nuestras pruebas|opiniones de (miles|nuestros)|según los jugadores/i);
    assert.doesNotMatch(text, /lesi[oó]n|epicondilitis|codo de tenista/i);
  });

  it("los enlaces internos del texto apuntan a rutas del sitio", () => {
    for (const guide of guides) {
      for (const link of guide.blocks.flatMap((block) => block.links ?? [])) {
        assert.match(link.href, /^\/(palas-padel|guias|ofertas|comparar|pala-ideal)\//, `${guide.slug}: ${link.href}`);
        const collection = /^\/palas-padel\/([a-z0-9-]+)\/$/.exec(link.href)?.[1];
        if (collection) assert.ok(getCollection(collection), `${guide.slug} → ${link.href}`);
        const other = /^\/guias\/([a-z0-9-]+)\/$/.exec(link.href)?.[1];
        if (other) assert.ok(getGuide(other), `${guide.slug} → ${link.href}`);
      }
    }
  });
});

describe("lo que una guía dice de cada pala", () => {
  async function pala(): Promise<Pala> {
    const [slug] = await repository.getPricedPalaSlugs();
    const found = await repository.getPalaBySlug(slug);
    assert.ok(found);
    return found;
  }
  const ratings = (scores: Record<string, number>) => ({
    source: "PadelZoom",
    total: null,
    scores: Object.entries(scores).map(([label, score]) => ({ label, score })),
  });

  it("explica el criterio con la cifra y el nombre de la fuente", async () => {
    const base = await pala();
    const text = pickReason({ ...base, sourceRatings: ratings({ Potencia: 9 }) }, 9.2);
    assert.match(text, /9,2 sobre 10 de puntuación técnica total en PadelZoom/);
    assert.doesNotMatch(pickReason({ ...base, sourceRatings: null }, null), /PadelZoom|sobre 10/);
  });

  it("destaca las notas más alta y más baja solo si se diferencian", async () => {
    const base = await pala();
    assert.deepEqual(pickHighlights({ ...base, sourceRatings: ratings({ Potencia: 9.5, Control: 8, Manejabilidad: 7 }) }), {
      best: ["potencia (9,5)"],
      weakest: "manejabilidad (7,0)",
    });
    assert.deepEqual(pickHighlights({ ...base, sourceRatings: ratings({ Potencia: 8.5, Control: 8.5 }) }), {
      best: [],
      weakest: null,
    });
    assert.deepEqual(pickHighlights({ ...base, sourceRatings: null }), { best: [], weakest: null });
  });

  it("resume los datos declarados, sin los que la pala no declara", async () => {
    const base = await pala();
    assert.equal(
      pickTraits({ ...base, shape: "diamante", balance: "alto", levels: ["avanzado", "competicion"] }),
      "Diamante · balance alto · avanzado · competición",
    );
    assert.equal(pickTraits({ ...base, shape: "redonda", balance: null, levels: [] }), "Redonda");
  });

  it("las selecciones salen del catálogo: con precio y sin repetir", async () => {
    const rated = await repository.getTopRatedPalas({ styles: ["control"] }, 5);
    assert.ok(rated.every(({ pala: item }) => item.price !== null));
    assert.equal(new Set(rated.map(({ pala: item }) => item.slug)).size, rated.length);
  });
});
