// Analítica y enlaces de salida: por defecto no se mide nada, nunca viajan datos
// personales y un enlace a tienda no cambia mientras no haya un acuerdo de afiliación.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { affiliatePrograms } from "@/config/affiliates";
import {
  ANALYTICS_EVENTS,
  EVENT_PROPS,
  isPrivatePath,
  looksSensitive,
  resolveAnalyticsProvider,
  sanitizeEvent,
} from "@/lib/analytics";
import { OUTBOUND_REL, outboundLink } from "@/lib/outbound";
import { canClaimCheapest, rankOffers, totalsComparable } from "@/lib/pricing";
import type { StoreOffer } from "@/types/catalog";

describe("proveedor de analítica", () => {
  it("sin configuración no hay analítica", () => {
    assert.equal(resolveAnalyticsProvider(undefined), "none");
    assert.equal(resolveAnalyticsProvider(""), "none");
    assert.equal(resolveAnalyticsProvider("google"), "none");
  });

  it("solo admite los proveedores previstos", () => {
    assert.equal(resolveAnalyticsProvider("plausible"), "plausible");
    assert.equal(resolveAnalyticsProvider(" Console "), "console");
  });
});

describe("datos de un evento", () => {
  it("cada evento tiene su lista de propiedades", () => {
    for (const event of Object.values(ANALYTICS_EVENTS)) {
      assert.ok(EVENT_PROPS[event].length > 0, `el evento ${event} no declara propiedades`);
    }
  });

  it("solo salen las propiedades admitidas", () => {
    assert.deepEqual(
      sanitizeEvent(ANALYTICS_EVENTS.outboundClick, {
        pala: "bullpadel-vertex-05-2026",
        tienda: "padelnuestro",
        precio: 199.95,
        posicion: 1,
        origen: "ficha",
        ip: "203.0.113.7",
        usuario: "alguien",
      }),
      { pala: "bullpadel-vertex-05-2026", tienda: "padelnuestro", precio: 199.95, posicion: 1, origen: "ficha" },
    );
  });

  it("nunca sale un correo ni un token, aunque vaya en una propiedad admitida", () => {
    assert.deepEqual(
      sanitizeEvent(ANALYTICS_EVENTS.search, { termino: "alguien@example.com", resultados: 0 }),
      { resultados: 0 },
    );
    assert.deepEqual(
      sanitizeEvent(ANALYTICS_EVENTS.alertCreate, { pala: "a".repeat(40), origen: "ficha" }),
      { origen: "ficha" },
    );
    assert.equal(looksSensitive("vertex 05"), false);
    assert.equal(looksSensitive("mi correo es yo@dominio.es"), true);
  });

  it("recorta los textos y descarta valores vacíos o no válidos", () => {
    const clean = sanitizeEvent(ANALYTICS_EVENTS.search, {
      termino: `  ${"pala ".repeat(40)}`,
      resultados: Number.NaN,
    });
    assert.equal(typeof clean.termino, "string");
    assert.ok(String(clean.termino).length <= 80);
    assert.ok(!("resultados" in clean));
    assert.deepEqual(sanitizeEvent(ANALYTICS_EVENTS.viewGuide, { guia: "   " }), {});
    assert.deepEqual(sanitizeEvent(ANALYTICS_EVENTS.viewGuide), {});
  });
});

describe("páginas desde las que no se envía nada", () => {
  it("las de alertas llevan un token en la dirección", () => {
    for (const path of ["/alertas/confirmar/", "/alertas/baja", "/mis-alertas/", "/mis-alertas", "/api/alertas/baja/"]) {
      assert.equal(isPrivatePath(path), true, path);
    }
    for (const path of ["/", "/pala/una-pala-2026/", "/palas-padel/", "/favoritos/", "/alertas-de-precio/"]) {
      assert.equal(isPrivatePath(path), false, path);
    }
  });

  it("los slugs de una comparación de tres palas no se cortan a medias", () => {
    const palas = Array.from({ length: 3 }, (_, i) => `marca-modelo-con-un-nombre-bastante-largo-${i}-2026`).join(",");
    assert.ok(palas.length > 80);
    assert.equal(sanitizeEvent(ANALYTICS_EVENTS.compareView, { palas, numero: 3 }).palas, palas);
  });
});

describe("total con envío", () => {
  it("solo se puede decir cuál es la más barata si todos los envíos están verificados", () => {
    assert.equal(totalsComparable([{ shipping: 0 }, { shipping: 4.95 }]), true);
    // Tienda A: 200 € + 5 € de envío; tienda B: 203 € con envío sin verificar. B saldría primera sin serlo necesariamente.
    assert.equal(totalsComparable([{ shipping: 5 }, { shipping: null }]), false);
    assert.equal(totalsComparable([]), true);
  });

  it("un envío desconocido no decide el orden: con envíos mixtos se ordena por el precio de la pala", () => {
    const offer = (slug: string, price: number, shipping: number | null): StoreOffer => ({
      store: { id: slug, slug, name: slug, url: "" },
      price,
      shipping,
      previousPrice: null,
      availability: "En stock",
      url: null,
      checkedAt: "2026-10-09T10:00:00Z",
    });
    // Alfa 200 € + 6 € verificados; Beta 203 € con envío sin verificar: Alfa va primera (es más barata como pala).
    const mixed = rankOffers([offer("beta", 203, null), offer("alfa", 200, 6)]);
    assert.deepEqual(mixed.map((item) => [item.store.slug, item.total]), [["alfa", 206], ["beta", 203]]);
    // Con todos los envíos verificados manda el total.
    const comparable = rankOffers([offer("alfa", 200, 6), offer("beta", 203, 0)]);
    assert.deepEqual(comparable.map((item) => item.store.slug), ["beta", "alfa"]);
    // Empate: orden estable por tienda.
    assert.deepEqual(rankOffers([offer("b", 100, 0), offer("a", 100, 0)]).map((item) => item.store.slug), ["a", "b"]);
  });

  it("el comparador solo dice «la más barata» con dos ofertas o más y todos los envíos verificados (T-01)", () => {
    // Envío con coste verificado en todas.
    assert.equal(canClaimCheapest([{ shipping: 4.95 }, { shipping: 6 }]), true);
    // Envío gratis verificado: 0 es un dato, no una ausencia.
    assert.equal(canClaimCheapest([{ shipping: 0 }, { shipping: 0 }]), true);
    assert.equal(canClaimCheapest([{ shipping: 0 }, { shipping: 4.95 }]), true);
    // Envío desconocido en alguna: no se trata como 0 € y no se señala ninguna.
    assert.equal(canClaimCheapest([{ shipping: null }, { shipping: 0 }]), false);
    assert.equal(canClaimCheapest([{ shipping: null }, { shipping: null }]), false);
    // Una sola oferta no es «la más barata» de nada.
    assert.equal(canClaimCheapest([{ shipping: 0 }]), false);
    assert.equal(canClaimCheapest([{ shipping: null }]), false);
    assert.equal(canClaimCheapest([]), false);
  });

  it("el comparador usa esa condición y avisa de los envíos sin verificar", () => {
    const source = readFileSync(join(process.cwd(), "components/compare/ComparePrices.tsx"), "utf8");
    assert.match(source, /claimCheapest = price \? canClaimCheapest\(price\.offers\) : false/);
    assert.match(source, /i === 0 && claimCheapest && " · la más barata"/);
    assert.doesNotMatch(source, /offers\.length > 1 && " · la más barata"/);
    assert.match(source, /no incluye el envío, que no hemos verificado/);
    // La ficha aplica la misma regla: con una sola tienda no hay «la más barata».
    const ficha = readFileSync(join(process.cwd(), "components/ficha/StoreList.tsx"), "utf8");
    assert.match(ficha, /claimCheapest=\{canClaimCheapest\(price\.offers\)\}/);
    assert.doesNotMatch(ficha, /totalsComparable/);
  });
});

describe("enlaces de salida", () => {
  it("no hay ningún programa de afiliación dado de alta", () => {
    assert.deepEqual(affiliatePrograms, {});
  });

  it("sin programa, el enlace es la URL del producto tal cual", () => {
    assert.deepEqual(outboundLink("https://tienda.example/pala-x?color=rojo", "tienda"), {
      href: "https://tienda.example/pala-x?color=rojo",
      affiliated: false,
    });
  });

  it("con programa, añade sus parámetros sin pisar los del producto ni cambiar el destino", () => {
    const programs = { tienda: { params: { ref: "palaradar", color: "azul" } } };
    const link = outboundLink("https://tienda.example/pala-x?color=rojo", "tienda", programs);
    assert.ok(link?.affiliated);
    const url = new URL(link.href);
    assert.equal(url.origin + url.pathname, "https://tienda.example/pala-x");
    assert.equal(url.searchParams.get("color"), "rojo");
    assert.equal(url.searchParams.get("ref"), "palaradar");
  });

  it("no hay enlace si la URL falta, no es válida o no es http", () => {
    assert.equal(outboundLink(null, "tienda"), null);
    assert.equal(outboundLink("no es una url", "tienda"), null);
    assert.equal(outboundLink("javascript:alert(1)", "tienda"), null);
  });

  it("todo enlace a tienda es comercial y no traspasa autoridad", () => {
    assert.deepEqual(OUTBOUND_REL.split(" ").sort(), ["nofollow", "noopener", "sponsored"]);
  });
});
