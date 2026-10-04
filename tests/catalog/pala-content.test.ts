// Texto de la ficha construido con los datos de cada pala: sin dato, no hay frase.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toSourceRatings } from "@/data/mappers";
import { createMemoryRepository } from "@/data/memory-repository";
import { buildFaq, declaredFeel, describePala, fullSpecs, glanceItems, metaDescription } from "@/lib/pala-content";
import { faqJsonLd, productJsonLd } from "@/lib/seo";
import type { Pala } from "@/types/catalog";

const repository = createMemoryRepository();

async function base(): Promise<Pala> {
  const [slug] = await repository.getAllPalaSlugs();
  const pala = await repository.getPalaBySlug(slug);
  assert.ok(pala);
  return {
    ...pala,
    brand: { ...pala.brand, name: "Adidas" },
    model: "Metalbone HRD+",
    year: 2026,
    shape: "diamante",
    balance: "alto",
    weight: { min: 345, max: 360 },
    levels: ["avanzado", "competicion"],
    playStyle: "potencia",
    hardness: "Dura",
    player: "Ale Galán",
    gender: null,
    msrp: 390,
    gtin: "08435739402757",
    manufacturerRef: "AR1CA0U36",
    sourceRatings: null,
    price: null,
    specs: [
      { label: "Núcleo", value: "EVA High Memory" },
      { label: "Caras", value: "Carbon Aluminized 16K" },
      { label: "Marco", value: "Fibra de carbono" },
      { label: "Grosor", value: "38 mm" },
      { label: "Superficie", value: "rugosa" },
      { label: "Acabado", value: "Brillo" },
      { label: "Tacto", value: "Medio-Duro" },
    ],
  };
}

/** La misma pala sin más dato que su forma. */
function bare(pala: Pala): Pala {
  return { ...pala, balance: null, weight: null, levels: [], playStyle: null, hardness: null, player: null, msrp: null, gtin: null, manufacturerRef: null, specs: [] };
}

describe("descripción de la pala", () => {
  it("cuenta lo que la pala declara, con su nombre y sus valores", async () => {
    const text = describePala(await base());

    assert.match(text, /^La Adidas Metalbone HRD\+ es una pala de 2026 con forma diamante y balance alto\./);
    assert.match(text, /Pesa 345–360 g y tiene un perfil de 38 mm\./);
    assert.match(text, /El fabricante la orienta a un juego de potencia y a jugadores de nivel avanzado y competición\./);
    assert.match(text, /Su núcleo es EVA High Memory, las caras son de Carbon Aluminized 16K y el marco es de Fibra de carbono\./);
    assert.match(text, /Declara un tacto medio-duro y una superficie rugosa con acabado brillo\./);
    assert.match(text, /Es el modelo de Ale Galán\./);
    assert.match(text, /precio recomendado por el fabricante es de 390\s€/);
  });

  it("sin datos se queda en lo único que sabe: no rellena", async () => {
    assert.equal(describePala(bare(await base())), "La Adidas Metalbone HRD+ es una pala de 2026 con forma diamante.");
  });

  it("cambia cuando cambian los datos y no valora la pala", async () => {
    const pala = await base();
    assert.notEqual(describePala(pala), describePala({ ...pala, balance: "medio", weight: { min: 360, max: 375 } }));
    assert.doesNotMatch(describePala(pala), /mejor|perfecta|ideal|increíble|excelente/i);
  });
});

describe("de un vistazo y especificaciones", () => {
  it("enseña solo los atributos que existen, cada uno con una explicación neutral", async () => {
    const items = glanceItems(await base());
    assert.deepEqual(items.map((item) => item.label), ["Forma", "Peso", "Balance", "Nivel", "Estilo de juego", "Tacto", "Grosor", "Superficie", "Jugador"]);
    assert.equal(items.find((item) => item.label === "Balance")?.note, "Concentra más peso hacia la cabeza y suele favorecer una sensación más contundente.");
    assert.equal(items.find((item) => item.label === "Superficie")?.value, "Rugosa");
    assert.ok(items.every((item) => item.note.length > 0 && !/esta pala es|perfecta/i.test(item.note)));

    assert.deepEqual(glanceItems(bare(await base())).map((item) => item.label), ["Forma"]);
  });

  it("usa la dureza cuando no hay tacto declarado", async () => {
    const pala = { ...(await base()), specs: [] };
    assert.deepEqual(glanceItems(pala).find((item) => item.label === "Dureza")?.value, "Dura");
    assert.match(declaredFeel(pala) ?? "", /una dureza dura/);
    assert.equal(declaredFeel(bare(pala)), null);
  });

  it("las especificaciones completas incluyen identificadores y precio recomendado", async () => {
    const labels = fullSpecs(await base()).map((spec) => spec.label);
    assert.ok(["Forma", "Peso", "Núcleo", "Dureza", "Jugador", "Precio recomendado", "Referencia del fabricante", "EAN"].every((label) => labels.includes(label)));
    assert.deepEqual(fullSpecs(bare(await base())).map((spec) => spec.label), ["Forma", "Año"]);
  });
});

describe("preguntas frecuentes", () => {
  it("solo formula las que puede responder con datos", async () => {
    const pala = await base();
    const faq = buildFaq(pala);
    assert.deepEqual(faq.map((item) => item.question), [
      "¿Cuánto pesa la Adidas Metalbone HRD+?",
      "¿Qué forma tiene la Adidas Metalbone HRD+?",
      "¿Cuál es el balance de la Adidas Metalbone HRD+?",
      "¿Para qué nivel de juego es la Adidas Metalbone HRD+?",
      "¿Qué tacto tiene la Adidas Metalbone HRD+?",
      "¿De qué materiales está hecha la Adidas Metalbone HRD+?",
    ]);
    assert.match(faq[0].answer, /pesa 345–360 g/);
    assert.deepEqual(buildFaq(bare(pala)).map((item) => item.question), ["¿Qué forma tiene la Adidas Metalbone HRD+?"]);
    assert.equal(faqJsonLd(faq).mainEntity.length, 6);
  });
});

describe("SEO de la ficha", () => {
  it("la descripción resume forma, peso y balance, y no promete opiniones", async () => {
    const text = metaDescription(await base());
    assert.match(text, /^Adidas Metalbone HRD\+ 2026: pala de forma diamante, 345–360 g y balance alto\./);
    assert.doesNotMatch(text, /opiniones/i);
  });

  it("el producto lleva EAN, referencia y características, y ninguna valoración", async () => {
    const data = productJsonLd({ pala: await base(), path: "/pala/x/", includeOffers: true }) as Record<string, unknown>;
    assert.equal(data.gtin13, "8435739402757");
    assert.equal(data.mpn, "AR1CA0U36");
    const properties = data.additionalProperty as { name: string; value: string }[];
    assert.ok(properties.some((property) => property.name === "Balance" && property.value === "Alto"));
    assert.equal(properties.some((property) => property.name === "EAN"), false);
    assert.equal("aggregateRating" in data, false);
    assert.equal("offers" in data, false);
  });

  it("sin EAN ni referencia no se inventan", async () => {
    const data = productJsonLd({ pala: bare(await base()), path: "/pala/x/", includeOffers: true }) as Record<string, unknown>;
    assert.equal("gtin13" in data || "gtin" in data || "mpn" in data, false);
  });
});

describe("valoraciones de la fuente", () => {
  it("se leen tal cual, con el nombre de la fuente", () => {
    const ratings = toSourceRatings([
      { attribute: "score_power", value: "9.5", source_name: "PadelZoom" },
      { attribute: "score_control", value: "8", source_name: "PadelZoom" },
      { attribute: "score_total", value: "8.6", source_name: "PadelZoom" },
      { attribute: "score_desconocida", value: "3", source_name: "PadelZoom" },
    ]);
    assert.deepEqual(ratings, {
      source: "PadelZoom",
      scores: [{ label: "Potencia", score: 9.5 }, { label: "Control", score: 8 }],
      total: 8.6,
    });
  });

  it("sin valoraciones válidas no hay bloque", () => {
    assert.equal(toSourceRatings([]), null);
    assert.equal(toSourceRatings([{ attribute: "score_power", value: "n/d", source_name: "PadelZoom" }]), null);
  });
});
