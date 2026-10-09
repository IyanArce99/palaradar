// Qué fichas son aptas para indexarse cuando el sitio se abra a los buscadores
// (lib/indexability.ts): requisitos de identidad y base técnica, y dos de los
// tres pilares (precio vigente, foto real, perfil de juego).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRepository } from "@/data/memory-repository";
import {
  assessIndexability,
  isIndexableComparison,
  isIndexablePala,
  palaIndexabilitySource,
  PROFILE_MIN_TRAITS,
  REQUIRED_PILLARS,
  selectForSitemap,
  type IndexabilitySource,
} from "@/lib/indexability";
import { metaDescription, palaTitle } from "@/lib/pala-content";
import { pageMetadata } from "@/lib/seo";
import type { Pala, PalaSummary } from "@/types/catalog";

const PHOTO = "https://ejemplo.supabase.co/storage/v1/object/public/media/rackets/1/primary.jpg";
const ILLUSTRATION = "/img/palas/generica-diamante-2.svg";

/** Una ficha completa: identidad, base técnica y los tres pilares. */
function complete(overrides: Partial<IndexabilitySource> = {}): IndexabilitySource {
  return {
    brandName: "Bullpadel",
    model: "Vertex 05 Juan Tello",
    year: 2026,
    image: PHOTO,
    hasCurrentPrice: true,
    hasWeight: true,
    specs: [
      { label: "Núcleo", value: "MultiEVA" },
      { label: "Caras", value: "Xtend Carbon 12K" },
      { label: "Marco", value: "Carbono" },
      { label: "Tacto", value: "Medio" },
    ],
    hardness: "Dura",
    balance: "alto",
    levels: ["avanzado", "competicion"],
    playStyle: "potencia",
    ...overrides,
  };
}

const NO_PROFILE: Pick<IndexabilitySource, "balance" | "levels" | "playStyle"> = { balance: null, levels: [], playStyle: null };

describe("fichas aptas para indexarse", () => {
  it("una ficha completa es apta y dice por qué", () => {
    const verdict = assessIndexability(complete());
    assert.equal(verdict.indexable, true);
    assert.deepEqual(verdict.pillars, ["precio", "foto", "perfil"]);
    assert.deepEqual(verdict.missing, []);
    assert.equal(verdict.summary, "Apta: tiene la base técnica y precio y foto y perfil.");
  });

  it("hacen falta dos de los tres pilares: precio, foto y perfil", () => {
    assert.equal(REQUIRED_PILLARS, 2);
    // Dos pilares, en sus tres combinaciones.
    assert.equal(assessIndexability(complete({ ...NO_PROFILE })).indexable, true);
    assert.equal(assessIndexability(complete({ image: ILLUSTRATION })).indexable, true);
    assert.equal(assessIndexability(complete({ hasCurrentPrice: false })).indexable, true);
    // Uno solo, o ninguno.
    assert.equal(assessIndexability(complete({ image: ILLUSTRATION, ...NO_PROFILE })).indexable, false);
    assert.equal(assessIndexability(complete({ hasCurrentPrice: false, ...NO_PROFILE })).indexable, false);
    assert.equal(assessIndexability(complete({ hasCurrentPrice: false, image: ILLUSTRATION })).indexable, false);
    assert.equal(assessIndexability(complete({ hasCurrentPrice: false, image: null, ...NO_PROFILE })).indexable, false);
  });

  it("tener precio no basta: con precio pero pocos datos no es apta", () => {
    const verdict = assessIndexability(complete({ image: ILLUSTRATION, ...NO_PROFILE }));
    assert.equal(verdict.indexable, false);
    assert.deepEqual(verdict.pillars, ["precio"]);
    assert.equal(verdict.summary, "No apta: de precio, foto y perfil solo tiene precio; hacen falta 2.");
  });

  it("sin precio, pero con foto y perfil completos, es apta como ficha de consulta", () => {
    const verdict = assessIndexability(complete({ hasCurrentPrice: false }));
    assert.equal(verdict.indexable, true);
    assert.deepEqual(verdict.pillars, ["foto", "perfil"]);
  });

  it("una ficha claramente pobre no es apta: solo nombre, foto y datos básicos", () => {
    const verdict = assessIndexability(complete({ hasCurrentPrice: false, ...NO_PROFILE, hardness: null }));
    assert.equal(verdict.indexable, false);
    assert.deepEqual(verdict.pillars, ["foto"]);
    assert.match(verdict.summary, /^No apta: de precio, foto y perfil solo tiene foto/);
  });

  it("sin foto real hacen falta precio y perfil; una ilustración o ninguna imagen no cuentan", () => {
    for (const image of [ILLUSTRATION, null]) {
      assert.equal(assessIndexability(complete({ image })).indexable, true);
      assert.equal(assessIndexability(complete({ image, hasCurrentPrice: false })).indexable, false);
      assert.equal(assessIndexability(complete({ image, ...NO_PROFILE })).indexable, false);
      assert.ok(!assessIndexability(complete({ image })).pillars.includes("foto"));
    }
  });

  it("sin base técnica no es apta, tenga los pilares que tenga", () => {
    const without = (label: string) => complete().specs.filter((spec) => spec.label !== label);

    const noWeight = assessIndexability(complete({ hasWeight: false }));
    assert.equal(noWeight.indexable, false);
    assert.deepEqual(noWeight.missing, ["peso"]);
    assert.equal(noWeight.summary, "No apta: le falta peso.");

    assert.deepEqual(assessIndexability(complete({ specs: without("Núcleo") })).missing, ["núcleo"]);
    assert.deepEqual(assessIndexability(complete({ specs: without("Caras") })).missing, ["caras"]);

    const nothing = assessIndexability(complete({ hasWeight: false, specs: [], hardness: null }));
    assert.equal(nothing.indexable, false);
    assert.deepEqual(nothing.missing, ["peso", "núcleo", "caras", "tacto o dureza"]);
    // Sigue teniendo los tres pilares: no es eso lo que falla.
    assert.equal(nothing.pillars.length, 3);
  });

  it("el marco no es obligatorio, y la dureza vale en lugar del tacto", () => {
    const noFrame = complete().specs.filter((spec) => spec.label !== "Marco");
    assert.equal(assessIndexability(complete({ specs: noFrame })).indexable, true);

    const noTouch = complete().specs.filter((spec) => spec.label !== "Tacto");
    assert.equal(assessIndexability(complete({ specs: noTouch, hardness: "Dura" })).indexable, true);
    assert.deepEqual(assessIndexability(complete({ specs: noTouch, hardness: null })).missing, ["tacto o dureza"]);
  });

  it("un dato vacío no cuenta como dato", () => {
    const blankCore = complete().specs.map((spec) => (spec.label === "Núcleo" ? { ...spec, value: "  " } : spec));
    assert.deepEqual(assessIndexability(complete({ specs: blankCore })).missing, ["núcleo"]);

    const noTouch = complete().specs.filter((spec) => spec.label !== "Tacto");
    assert.deepEqual(assessIndexability(complete({ specs: noTouch, hardness: " , " })).missing, ["tacto o dureza"]);
  });

  it("sin marca, modelo o año no se sabe qué pala es", () => {
    assert.deepEqual(assessIndexability(complete({ brandName: " " })).missing, ["marca"]);
    assert.deepEqual(assessIndexability(complete({ model: "" })).missing, ["modelo"]);
    assert.deepEqual(assessIndexability(complete({ year: 0 })).missing, ["año"]);
    assert.deepEqual(assessIndexability(complete({ year: Number.NaN })).missing, ["año"]);
  });

  it("el perfil de juego está completo con dos de balance, nivel y estilo", () => {
    assert.equal(PROFILE_MIN_TRAITS, 2);
    const base = { hasCurrentPrice: false } as const; // con foto: el perfil decide
    assert.equal(assessIndexability(complete({ ...base, playStyle: null })).indexable, true);
    assert.equal(assessIndexability(complete({ ...base, balance: null })).indexable, true);
    assert.equal(assessIndexability(complete({ ...base, levels: [] })).indexable, true);
    assert.equal(assessIndexability(complete({ ...base, levels: [], playStyle: null })).indexable, false);
    assert.equal(assessIndexability(complete({ ...base, balance: null, playStyle: null })).indexable, false);
  });
});

/** Una pala de la semilla convertida en ficha apta (foto y perfil) o pobre (solo datos básicos). */
async function seedPala(slug: string, apt: boolean): Promise<Pala> {
  const pala = await createMemoryRepository().getPalaBySlug(slug);
  assert.ok(pala, slug);
  const base: Pala = {
    ...pala,
    weight: { min: 360, max: 370 },
    specs: [
      { label: "Núcleo", value: "EVA" },
      { label: "Caras", value: "Carbono" },
      { label: "Tacto", value: "Medio" },
    ],
    alternatives: [],
  };
  return apt
    ? { ...base, images: [PHOTO], balance: "alto", levels: ["avanzado"], playStyle: "potencia" }
    : { ...base, images: [ILLUSTRATION], balance: null, levels: [], playStyle: null, price: null };
}

/** `a` tiene a `b` entre sus «parecidas»: es lo que hace curada una comparación. */
function curated(a: Pala, b: Pala): Pala {
  return { ...a, alternatives: [{ pala: { slug: b.slug } as PalaSummary, reason: "Misma forma" }] };
}

describe("comparaciones: solo entre dos fichas aptas", () => {
  it("una comparación curada entre dos fichas aptas es indexable, en los dos sentidos", async () => {
    const [first, second] = await createMemoryRepository().getAllPalaSlugs();
    const b = await seedPala(second, true);
    const a = curated(await seedPala(first, true), b);

    assert.equal(isIndexablePala(a) && isIndexablePala(b), true);
    assert.equal(isIndexableComparison(a, b), true);
    assert.equal(isIndexableComparison(b, a), true);
  });

  it("si una de las dos fichas no es apta, la comparación tampoco", async () => {
    const [first, second] = await createMemoryRepository().getAllPalaSlugs();
    const poor = await seedPala(second, false);
    const apt = curated(await seedPala(first, true), poor);
    assert.equal(isIndexablePala(apt), true);
    assert.equal(isIndexablePala(poor), false);
    assert.equal(isIndexableComparison(apt, poor), false);
    assert.equal(isIndexableComparison(poor, apt), false);

    const bothPoor = curated(await seedPala(first, false), poor);
    assert.equal(isIndexableComparison(bothPoor, poor), false);
  });

  it("dos fichas aptas que no son «parecidas» no forman una comparación indexable", async () => {
    const [first, second] = await createMemoryRepository().getAllPalaSlugs();
    const a = await seedPala(first, true);
    const b = await seedPala(second, true);
    assert.equal(isIndexableComparison(a, b), false);
  });
});

describe("sitemap: lo que cuelga de las fichas aptas", () => {
  const indexable = [
    { slug: "adidas-metalbone-2026", brandSlug: "adidas" },
    { slug: "bullpadel-vertex-05-2026", brandSlug: "bullpadel" },
    { slug: "bullpadel-hack-04-2026", brandSlug: "bullpadel" },
  ];
  const brands = ["adidas", "bullpadel", "varlion", "kuikma"];

  it("entran las fichas aptas, tal cual", () => {
    const { palaSlugs } = selectForSitemap(indexable, brands, []);
    assert.deepEqual(palaSlugs, ["adidas-metalbone-2026", "bullpadel-vertex-05-2026", "bullpadel-hack-04-2026"]);
  });

  it("una marca entra solo si tiene al menos una ficha apta", () => {
    const { brandSlugs } = selectForSitemap(indexable, brands, []);
    // Con una basta (Adidas); sin ninguna, fuera (Varlion, Kuikma). Se respeta el orden recibido.
    assert.deepEqual(brandSlugs, ["adidas", "bullpadel"]);
    assert.deepEqual(selectForSitemap([], brands, []).brandSlugs, []);
    assert.deepEqual(selectForSitemap([indexable[0]], brands, []).brandSlugs, ["adidas"]);
  });

  it("una comparación curada entra solo si sus dos fichas son aptas", () => {
    const pairs: [string, string][] = [
      ["bullpadel-vertex-05-2026", "adidas-metalbone-2026"], // las dos aptas
      ["adidas-metalbone-2026", "bullpadel-vertex-05-2026"], // la misma, en el otro sentido
      ["bullpadel-vertex-05-2026", "varlion-avant-2023"], // una no apta
      ["varlion-avant-2023", "kuikma-comfort-2024"], // ninguna apta
      ["bullpadel-hack-04-2026", "bullpadel-vertex-05-2026"], // las dos aptas
    ];
    const selection = selectForSitemap(indexable, brands, pairs);
    assert.deepEqual(selection.pairs, [
      ["adidas-metalbone-2026", "bullpadel-vertex-05-2026"],
      ["bullpadel-hack-04-2026", "bullpadel-vertex-05-2026"],
    ]);
  });

  it("sin fichas aptas no entra ninguna marca ni ninguna comparación", () => {
    const selection = selectForSitemap([], brands, [["a", "b"]]);
    assert.deepEqual(selection, { palaSlugs: [], brandSlugs: [], pairs: [] });
  });
});

describe("la ficha no promete precio ni tiendas si no los tiene", () => {
  it("con precio vigente el título habla de precio y tiendas; sin él, de ficha técnica", async () => {
    const repository = createMemoryRepository();
    const slugs = await repository.getAllPalaSlugs();
    const palas = (await Promise.all(slugs.map((slug) => repository.getPalaBySlug(slug)))).filter((pala): pala is Pala => pala !== null);
    const priced = palas.find((pala) => pala.price !== null && pala.price.freshness !== "stale");
    assert.ok(priced, "la semilla debe tener una pala con precio vigente");

    assert.equal(palaTitle(priced), `${priced.brand.name} ${priced.model} ${priced.year}: características, precio y tiendas`);
    assert.match(metaDescription(priced), /Desde .+ en \d+ tiendas?\./);
    assert.match(metaDescription(priced), /precio por tienda\.$/);

    const unpriced: Pala = { ...priced, price: null };
    assert.equal(palaTitle(unpriced), `${priced.brand.name} ${priced.model} ${priced.year}: características y ficha técnica`);
    assert.doesNotMatch(`${palaTitle(unpriced)} ${metaDescription(unpriced)}`, /precio|tienda/i);
  });

  it("un precio caducado tampoco se promete", async () => {
    const repository = createMemoryRepository();
    const slugs = await repository.getAllPalaSlugs();
    const palas = (await Promise.all(slugs.map((slug) => repository.getPalaBySlug(slug)))).filter((pala): pala is Pala => pala !== null);
    const stale = palas.find((pala) => pala.price?.freshness === "stale");
    assert.ok(stale, "la semilla deja a propósito algunas palas con el precio caducado");

    assert.match(palaTitle(stale), /: características y ficha técnica$/);
    assert.doesNotMatch(metaDescription(stale), /precio|tienda/i);
  });
});

describe("la decisión se aplica igual en la ficha y en el sitemap", () => {
  it("el sitemap solo recibe fichas aptas, y todas las aptas", async () => {
    const repository = createMemoryRepository();
    const all = await repository.getAllPalaSlugs();
    const indexable = (await repository.getIndexablePalas()).map((pala) => pala.slug);

    // Las palas de la semilla no declaran tacto ni dureza: ninguna pasa los requisitos.
    assert.ok(indexable.every((slug) => all.includes(slug)));
    for (const slug of all) {
      const pala = await repository.getPalaBySlug(slug);
      assert.ok(pala);
      assert.equal(indexable.includes(slug), isIndexablePala(pala), slug);
    }
  });

  it("un precio caducado no cuenta como precio", async () => {
    const repository = createMemoryRepository();
    for (const slug of await repository.getAllPalaSlugs()) {
      const pala = await repository.getPalaBySlug(slug);
      assert.ok(pala);
      const source = palaIndexabilitySource(pala);
      assert.equal(source.hasCurrentPrice, pala.price !== null && pala.price.freshness !== "stale");
    }
  });

  it("mientras el sitio no esté lanzado, ni una ficha apta pide indexarse", () => {
    // NEXT_PUBLIC_ALLOW_INDEXING no vale «true» en los tests: manda el noindex global.
    for (const index of [true, false]) {
      const metadata = pageMetadata({ title: "t", description: "d", path: "/pala/x/", index });
      assert.equal(metadata.robots, undefined);
      assert.equal(metadata.alternates, undefined);
    }
  });
});
