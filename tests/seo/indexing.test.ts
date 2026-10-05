// Antes del lanzamiento (NEXT_PUBLIC_ALLOW_INDEXING distinto de "true", como en los
// tests) el sitio no puede dar ninguna señal de indexación.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo";
import nextConfig from "@/next.config";

describe("sitio sin lanzar: nada indexable", () => {
  it("el interruptor está apagado si la variable no vale «true»", () => {
    assert.equal(process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true", false);
    assert.equal(siteConfig.allowIndexing, false);
  });

  it("todas las respuestas llevan noindex en la cabecera, también las que no son HTML", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    assert.deepEqual(rules, [
      { source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ]);
  });

  it("el sitemap no anuncia ninguna dirección y robots.txt no lo menciona", async () => {
    assert.deepEqual(await sitemap(), []);
    assert.equal(robots().sitemap, undefined);
  });

  it("las páginas no declaran canónica ni dirección para compartir, ni una regla propia de robots", () => {
    for (const index of [true, false]) {
      const metadata = pageMetadata({ title: "Título", description: "Descripción", path: "/palas-padel/", index });
      assert.equal(metadata.alternates, undefined);
      assert.equal((metadata.openGraph as { url?: string }).url, undefined);
      // Manda el noindex global del layout: ninguna página lo sustituye por otro.
      assert.equal(metadata.robots, undefined);
    }
  });
});
