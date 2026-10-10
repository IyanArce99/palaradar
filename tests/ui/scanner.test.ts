// Escáner por foto: sin proveedor no existe, y con él nunca se enseña una
// certeza: solo candidatos del catálogo con confianza suficiente.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SCAN_MAX_BYTES,
  SCAN_MAX_CANDIDATES,
  scannerAvailable,
  scanPala,
  toScanCandidates,
  type ScanGuess,
  type ScanProvider,
} from "@/lib/scanner";

const catalog = new Set(["pala-a", "pala-b", "pala-c", "pala-d", "pala-e", "pala-f"]);
const photo = { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" };
const provider = (guesses: ScanGuess[] | Error): ScanProvider => ({
  id: "prueba",
  identify: async () => {
    if (guesses instanceof Error) throw guesses;
    return guesses;
  },
});
const guess = (slug: string, confidence: number): ScanGuess => ({ slug, confidence, evidence: ["logotipo"] });

describe("disponibilidad", () => {
  it("hoy no hay ningún servicio de visión conectado", async () => {
    assert.equal(scannerAvailable(), false);
    assert.deepEqual(await scanPala(photo, catalog), { status: "unavailable" });
  });
});

describe("candidatos", () => {
  it("descarta lo que no está en el catálogo, lo poco fiable y lo repetido", () => {
    const candidates = toScanCandidates(
      [guess("pala-a", 0.6), guess("inventada", 0.99), guess("pala-b", 0.1), guess("pala-a", 0.9), guess("pala-c", Number.NaN)],
      catalog,
    );
    assert.deepEqual(candidates, [{ slug: "pala-a", confidence: "alta", evidence: ["logotipo"] }]);
  });

  it("ordena de más a menos probable y no pasa de cinco", () => {
    const guesses = [...catalog].map((slug, i) => guess(slug, 0.4 + i * 0.05));
    const candidates = toScanCandidates(guesses, catalog);
    assert.equal(candidates.length, SCAN_MAX_CANDIDATES);
    assert.equal(candidates[0].slug, "pala-f");
    assert.ok(candidates.every((candidate) => candidate.confidence === "media"));
  });
});

describe("flujo de un escaneo", () => {
  it("devuelve candidatos, nunca una única respuesta segura", async () => {
    const result = await scanPala(photo, catalog, provider([guess("pala-a", 0.95), guess("pala-b", 0.5)]));
    assert.deepEqual(result, {
      status: "candidates",
      candidates: [
        { slug: "pala-a", confidence: "alta", evidence: ["logotipo"] },
        { slug: "pala-b", confidence: "media", evidence: ["logotipo"] },
      ],
    });
  });

  it("sin coincidencias fiables lo dice, para buscar a mano", async () => {
    assert.deepEqual(await scanPala(photo, catalog, provider([guess("pala-a", 0.2)])), { status: "no-match" });
    assert.deepEqual(await scanPala(photo, catalog, provider([])), { status: "no-match" });
  });

  it("un fallo del servicio o una imagen no válida no rompen nada", async () => {
    assert.deepEqual(await scanPala(photo, catalog, provider(new Error("servicio caído"))), { status: "error" });
    const working = provider([guess("pala-a", 0.9)]);
    assert.deepEqual(await scanPala({ ...photo, mimeType: "application/pdf" }, catalog, working), { status: "error" });
    assert.deepEqual(await scanPala({ ...photo, bytes: new Uint8Array(SCAN_MAX_BYTES + 1) }, catalog, working), { status: "error" });
    assert.deepEqual(await scanPala({ ...photo, bytes: new Uint8Array(0) }, catalog, working), { status: "error" });
  });
});
