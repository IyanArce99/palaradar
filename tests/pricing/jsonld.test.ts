// El JSON-LD de producto no publica precios de demostración ni desactualizados,
// ni datos que no tengamos de verdad.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveIncludeDemoStores } from "@/config/pricing";
import { createMemoryRepository } from "@/data/memory-repository";
import { buildPriceSummary, priceFreshness } from "@/lib/pricing";
import { productJsonLd } from "@/lib/seo";
import type { Pala, StoreOffer } from "@/types/catalog";

const NOW = new Date("2026-10-05T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

function offer(slug: string, price: number, shipping: number, checkedAt: string): StoreOffer {
  return {
    store: { id: slug, slug, name: slug, url: `https://example.com/${slug}` },
    price,
    shipping,
    previousPrice: null,
    availability: "En stock",
    url: `https://example.com/${slug}/producto`,
    checkedAt,
  };
}

/** Una pala del catálogo con las ofertas indicadas como único precio. */
async function palaWith(offers: StoreOffer[]): Promise<Pala> {
  const repository = createMemoryRepository();
  const [slug] = await repository.getAllPalaSlugs();
  const pala = await repository.getPalaBySlug(slug);
  assert.ok(pala);
  return { ...pala, price: buildPriceSummary(offers, [], NOW) };
}

type JsonLd = ReturnType<typeof productJsonLd> & {
  offers?: { lowPrice: number; highPrice: number; offerCount: number; priceCurrency: string };
  aggregateRating?: unknown;
  image?: unknown;
};

describe("JSON-LD de producto", () => {
  it("publica como oferta el precio real y comprobado, con envío incluido", async () => {
    const pala = await palaWith([offer("a", 200, 2.99, hoursAgo(2)), offer("b", 210, 0, hoursAgo(30))]);
    const jsonLd: JsonLd = productJsonLd({ pala, path: "/pala/x/", includeOffers: true });

    assert.deepEqual(jsonLd.offers, {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: 202.99,
      highPrice: 210,
      offerCount: 2,
    });
  });

  it("no publica ofertas cuando los precios son de demostración", async () => {
    const pala = await palaWith([offer("demo", 200, 0, hoursAgo(2))]);
    const jsonLd: JsonLd = productJsonLd({ pala, path: "/pala/x/", includeOffers: false });

    assert.equal(jsonLd.offers, undefined);
    assert.equal(JSON.stringify(jsonLd).includes("200"), false);
  });

  it("en producción los precios demo no llegan a mostrarse, así que no hay nada que publicar", () => {
    // hasTestPrices = origen mock || tiendas demo incluidas; lo segundo es imposible en producción.
    assert.equal(resolveIncludeDemoStores({ NODE_ENV: "production", INCLUDE_DEMO_PRICES: "true" }), false);
  });

  it("no publica un precio desactualizado como oferta", async () => {
    const pala = await palaWith([offer("a", 200, 0, hoursAgo(72))]);
    assert.equal(pala.price?.freshness, "stale");

    const jsonLd: JsonLd = productJsonLd({ pala, path: "/pala/x/", includeOffers: true });
    assert.equal(jsonLd.offers, undefined);
  });

  it("una oferta desactualizada no cuenta en el rango ni en el número de ofertas", async () => {
    const pala = await palaWith([offer("vieja", 150, 0, hoursAgo(200)), offer("fresca", 200, 0, hoursAgo(1))]);
    const jsonLd: JsonLd = productJsonLd({ pala, path: "/pala/x/", includeOffers: true });

    assert.equal(jsonLd.offers?.lowPrice, 200);
    assert.equal(jsonLd.offers?.highPrice, 200);
    assert.equal(jsonLd.offers?.offerCount, 1);
  });

  it("sin precio no hay ofertas", async () => {
    const pala = await palaWith([]);
    const jsonLd: JsonLd = productJsonLd({ pala, path: "/pala/x/", includeOffers: true });
    assert.equal(jsonLd.offers, undefined);
  });

  it("no publica valoraciones ni imágenes que no tenemos", async () => {
    const pala = await palaWith([offer("a", 200, 0, hoursAgo(2))]);
    const jsonLd: JsonLd = productJsonLd({ pala, path: "/pala/x/", includeOffers: true });

    // Sin opiniones reales no hay valoración; las ilustraciones propias no son foto del producto.
    assert.equal(pala.reviewCount, 0);
    assert.equal(jsonLd.aggregateRating, undefined);
    assert.equal(jsonLd.image, undefined);
    assert.equal(jsonLd.name, `${pala.brand.name} ${pala.model} ${pala.year}`);
  });
});

describe("antigüedad del precio", () => {
  it("hasta 24 h es actual, hasta 48 h es reciente y después está desactualizado", () => {
    assert.equal(priceFreshness(hoursAgo(0), NOW), "current");
    assert.equal(priceFreshness(hoursAgo(24), NOW), "current");
    assert.equal(priceFreshness(hoursAgo(24.01), NOW), "recent");
    assert.equal(priceFreshness(hoursAgo(48), NOW), "recent");
    assert.equal(priceFreshness(hoursAgo(48.01), NOW), "stale");
  });

  it("un precio reciente se sigue mostrando, como «último precio conocido»", () => {
    const summary = buildPriceSummary([offer("a", 200, 0, hoursAgo(30))], [], NOW);
    assert.equal(summary?.freshness, "recent");
    assert.equal(summary?.current, 200);
    assert.notEqual(summary?.verdict.status, "stale");
  });
});
