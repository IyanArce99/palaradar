// La decisión de indexar sale igual por los dos caminos: el del sitemap (una
// consulta al catálogo) y el de cada página (la pala completa). Solo lectura.
// Solo se ejecuta con `npm run test:db` (necesita DATABASE_URL).
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createSql, getDatabaseUrl } from "@/data/db/client";
import { createPostgresRepository } from "@/data/postgres-repository";
import { uniquePairs } from "@/lib/compare";
import {
  assessIndexability,
  isIndexableComparison,
  palaIndexabilitySource,
  selectForSitemap,
} from "@/lib/indexability";

const url = getDatabaseUrl();
/** Fichas que se comprueban una a una, repartidas por todo el catálogo */
const SAMPLE = 40;

describe("indexación selectiva en PostgreSQL", { skip: !url && "DATABASE_URL no configurada" }, () => {
  const sql = createSql(url ?? "postgres://sin-configurar", 1);
  const repository = createPostgresRepository(sql);
  after(() => sql.end());

  it("el sitemap y la ficha deciden lo mismo, y no entra todo el catálogo", async () => {
    const all = await repository.getAllPalaSlugs();
    const indexable = new Set((await repository.getIndexablePalas()).map((pala) => pala.slug));

    assert.ok([...indexable].every((slug) => all.includes(slug)));
    // Ni todas ni ninguna: el criterio separa fichas completas de fichas pobres.
    assert.ok(indexable.size > 0 && indexable.size < all.length, `${indexable.size} de ${all.length}`);

    const step = Math.max(1, Math.floor(all.length / SAMPLE));
    const sample = all.filter((_, index) => index % step === 0).slice(0, SAMPLE);
    for (const slug of sample) {
      const pala = await repository.getPalaBySlug(slug);
      assert.ok(pala, slug);
      const verdict = assessIndexability(palaIndexabilitySource(pala));
      assert.equal(indexable.has(slug), verdict.indexable, `${slug}: ${verdict.summary}`);
    }
  });

  it("una marca solo entra en el sitemap si tiene alguna ficha apta", async () => {
    const [indexable, brands, pairs] = await Promise.all([
      repository.getIndexablePalas(),
      repository.getBrands(),
      repository.getAlternativePairs(),
    ]);
    const selection = selectForSitemap(indexable, brands.map((brand) => brand.slug), pairs);

    const withIndexable = new Set(indexable.map((pala) => pala.brandSlug));
    assert.deepEqual(new Set(selection.brandSlugs), withIndexable);
    // El catálogo real tiene marcas sin ninguna ficha apta: se quedan fuera.
    assert.ok(selection.brandSlugs.length > 0 && selection.brandSlugs.length < brands.length, `${selection.brandSlugs.length} de ${brands.length}`);
    // Cada ficha apta lleva la marca de su propia pala.
    for (const { slug, brandSlug } of indexable.slice(0, 15)) {
      assert.equal((await repository.getPalaBySlug(slug))?.brand.slug, brandSlug, slug);
    }
  });

  it("una comparación solo entra en el sitemap, y solo es indexable, si sus dos fichas son aptas", async () => {
    const [indexable, brands, pairs] = await Promise.all([
      repository.getIndexablePalas(),
      repository.getBrands(),
      repository.getAlternativePairs(),
    ]);
    const selection = selectForSitemap(indexable, brands.map((brand) => brand.slug), pairs);
    const curated = uniquePairs(pairs);
    const inSitemap = new Set(selection.pairs.map(([a, b]) => `${a}|${b}`));

    assert.ok(selection.pairs.length < curated.length, "hay comparaciones curadas con alguna ficha no apta");
    // La página de cada comparación curada decide lo mismo que el sitemap. Las
    // palas se repiten entre comparaciones: cada una se carga una sola vez.
    const palas = new Map<string, Awaited<ReturnType<typeof repository.getPalaBySlug>>>();
    for (const slug of new Set(curated.flat())) palas.set(slug, await repository.getPalaBySlug(slug));
    for (const [a, b] of curated) {
      const first = palas.get(a);
      const second = palas.get(b);
      assert.ok(first && second, `${a} vs ${b}`);
      assert.equal(isIndexableComparison(first, second), inSitemap.has(`${a}|${b}`), `${a} vs ${b}`);
    }
  });
});
