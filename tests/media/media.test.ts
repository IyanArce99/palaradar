// Imágenes reales: qué se publica, cómo se clasifica una imagen y cómo se importa.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import sharp from "sharp";
import { toPala, toPalaSummary } from "@/data/mappers";
import { createMemoryRepository } from "@/data/memory-repository";
import { buildSeed } from "@/data/seed/build";
import {
  isProductPhoto,
  isPublishable,
  mediaUrl,
  palaAlt,
  publishedImages,
  storagePathFor,
} from "@/lib/media";
import { palaShareImage, productJsonLd } from "@/lib/seo";
import { importMedia, type Download, type Downloader } from "@/media/import";
import { classifyImage, inspectImage } from "@/media/inspect";
import { createMemoryMediaRepository, type MediaItem } from "@/media/repository";
import { createMemoryStorage } from "@/media/storage";
import type { RacketCatalogRow } from "@/types/db";

const STORAGE = "https://proyecto.supabase.co";
const PUBLIC = `${STORAGE}/storage/v1/object/public/media`;
const NOW = new Date("2026-10-04T10:00:00Z");

let previousUrl: string | undefined;
function useStorage(url: string | null) {
  if (url === null) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = url;
}
beforeEach(() => {
  previousUrl = process.env.SUPABASE_URL;
  useStorage(STORAGE);
});
afterEach(() => useStorage(previousUrl ?? null));

interface PictureOptions {
  size?: [number, number];
  background?: { r: number; g: number; b: number; alpha: number };
  /** Caja de la «pala», en proporción a la imagen: [izquierda, arriba, ancho, alto] */
  box?: [number, number, number, number];
  /** Color de la pala: cambiarlo da un archivo distinto */
  color?: string;
}

/** Imagen de prueba: un rectángulo oscuro (la pala) sobre un fondo liso. */
async function picture({
  size = [800, 800],
  background = { r: 255, g: 255, b: 255, alpha: 1 },
  box = [0.3, 0.1, 0.4, 0.8],
  color = "#15171a",
}: PictureOptions = {}): Promise<Buffer> {
  const [width, height] = size;
  const racket = await sharp({
    create: {
      width: Math.round(width * box[2]),
      height: Math.round(height * box[3]),
      channels: 4,
      background: color,
    },
  })
    .png()
    .toBuffer();

  return sharp({ create: { width, height, channels: 4, background } })
    .composite([{ input: racket, left: Math.round(width * box[0]), top: Math.round(height * box[1]) }])
    .png()
    .toBuffer();
}

describe("qué imagen se enseña", () => {
  it("la foto real va antes que la ilustración", () => {
    assert.deepEqual(publishedImages([`${PUBLIC}/a.jpg`], ["/img/palas/generica-redonda-1.svg"]), [
      `${PUBLIC}/a.jpg`,
    ]);
  });

  it("sin foto real se enseña la ilustración", () => {
    assert.deepEqual(publishedImages([], ["/img/palas/x.svg"]), ["/img/palas/x.svg"]);
    assert.deepEqual(publishedImages([null], ["/img/palas/x.svg"]), ["/img/palas/x.svg"]);
  });

  it("solo se publica una imagen verificada, con derechos y con copia propia", () => {
    const ok = { verification_status: "verified", rights_status: "approved", storage_path: "rackets/1/primary.jpg" } as const;
    assert.equal(isPublishable(ok), true);
    assert.equal(isPublishable({ ...ok, rights_status: "pending" }), false);
    assert.equal(isPublishable({ ...ok, rights_status: "rejected" }), false);
    assert.equal(isPublishable({ ...ok, verification_status: "pending" }), false);
    assert.equal(isPublishable({ ...ok, verification_status: "rejected" }), false);
    assert.equal(isPublishable({ ...ok, storage_path: null }), false);
  });

  it("construye la URL pública solo si Storage está configurado", () => {
    assert.equal(mediaUrl("rackets/1/primary.jpg"), `${PUBLIC}/rackets/1/primary.jpg`);
    assert.equal(mediaUrl(null), null);
    useStorage(null);
    assert.equal(mediaUrl("rackets/1/primary.jpg"), null);
  });

  it("separa la imagen principal de la galería en Storage", () => {
    assert.equal(storagePathFor("abc", "primary", 0, "jpg"), "rackets/abc/primary.jpg");
    assert.equal(storagePathFor("abc", "gallery", 2, "webp"), "rackets/abc/gallery/2.webp");
    assert.equal(storagePathFor("abc", "primary", 0, "jpg", "fabricante"), "rackets/abc/primary-fabricante.jpg");
  });

  it("el texto alternativo es marca, modelo y año", () => {
    assert.equal(palaAlt({ brand: { name: "Bullpadel" }, model: "Vertex 04", year: 2025 }), "Bullpadel Vertex 04 2025");
  });

  it("distingue una foto de una ilustración propia", () => {
    assert.equal(isProductPhoto(`${PUBLIC}/rackets/1/primary.jpg`), true);
    assert.equal(isProductPhoto("/img/palas/generica-redonda-1.svg"), false);
  });
});

describe("la foto en el catálogo y en la ficha", () => {
  const seed = buildSeed(NOW);
  const racket = seed.rackets[0];
  const brand = seed.brands.find((item) => item.id === racket.brand_id)!;
  const row = (photo: string | null | undefined): RacketCatalogRow => ({
    id: racket.id, slug: racket.slug, model: racket.model, year: racket.year, images: racket.images,
    shape: racket.shape, balance: racket.balance, play_style: racket.play_style, levels: racket.levels,
    description: racket.description, rating: 0, review_count: 0, brand_slug: brand.slug, brand_name: brand.name,
    search_text: "", best_price: null, store_count: null, previous_price: null, drop_percent: null,
    min_price: null, price_30d_ago: null, price_status: null, price_checked_at: null, photo_path: photo,
  });
  const parts = { racket, brand, offers: [], priceHistory: [], reviews: [], alternatives: [] };

  it("la tarjeta usa la foto publicada y, si no la hay, la ilustración", () => {
    assert.equal(toPalaSummary(row("rackets/1/primary.jpg"), NOW).image, `${PUBLIC}/rackets/1/primary.jpg`);
    assert.equal(toPalaSummary(row(null), NOW).image, racket.images[0]);
    assert.equal(toPalaSummary(row(undefined), NOW).image, racket.images[0]);
  });

  it("la ficha enseña las fotos con sus dimensiones", () => {
    const pala = toPala({ ...parts, photos: [{ storage_path: "rackets/1/primary.jpg", width: 800, height: 900 }] }, NOW);
    assert.deepEqual(pala.images, [`${PUBLIC}/rackets/1/primary.jpg`]);
    assert.deepEqual(pala.photoSize, { width: 800, height: 900 });
    assert.deepEqual(palaShareImage(pala), {
      url: `${PUBLIC}/rackets/1/primary.jpg`, width: 800, height: 900, alt: palaAlt(pala),
    });
    assert.deepEqual(productJsonLd({ pala, path: "/pala/x/", includeOffers: false }).image, pala.images);
  });

  it("una ficha sin foto sigue funcionando con su ilustración", () => {
    const pala = toPala(parts, NOW);
    assert.deepEqual(pala.images, racket.images);
    assert.equal(pala.photoSize, null);
    assert.equal(palaShareImage(pala), null);
    assert.equal("image" in productJsonLd({ pala, path: "/pala/x/", includeOffers: false }), false);
  });

  it("sin Storage configurado no se enseña una foto que no se puede servir", () => {
    useStorage(null);
    const pala = toPala({ ...parts, photos: [{ storage_path: "rackets/1/primary.jpg", width: 800, height: 800 }] }, NOW);
    assert.deepEqual(pala.images, racket.images);
    assert.equal(toPalaSummary(row("rackets/1/primary.jpg"), NOW).image, racket.images[0]);
  });

  it("el catálogo en memoria (sin fotos) no se rompe", async () => {
    const { items } = await createMemoryRepository().searchCatalog(
      { q: "", collection: "todas", levels: [], styles: [], brands: [], shapes: [], balances: [], years: [], maxPrice: null, coverage: [], sort: "disponibilidad", page: 1 },
      { pageSize: 3 },
    );
    assert.ok(items.every((pala) => pala.image?.startsWith("/img/palas/")));
  });
});

describe("controles de calidad de una imagen", () => {
  it("mide la imagen y reconoce el fondo blanco", async () => {
    const inspection = await inspectImage(await picture({ size: [800, 1000] }));
    assert.deepEqual([inspection?.width, inspection?.height, inspection?.format, inspection?.background], [800, 1000, "png", "white"]);
    assert.equal(inspection?.touchesEdge, false);
  });

  it("verifica una pala vertical, entera, sobre fondo blanco y con resolución suficiente", async () => {
    assert.deepEqual(classifyImage(await inspectImage(await picture())), { status: "verified", note: null });
  });

  it("acepta el fondo transparente", async () => {
    const inspection = await inspectImage(await picture({ background: { r: 0, g: 0, b: 0, alpha: 0 } }));
    assert.equal(inspection?.background, "transparent");
    assert.equal(classifyImage(inspection).status, "verified");
  });

  it("verifica entre 600 y 800 px, pero lo anota", async () => {
    const result = classifyImage(await inspectImage(await picture({ size: [700, 700] })));
    assert.equal(result.status, "verified");
    assert.match(result.note ?? "", /800 px preferidos/);
  });

  it("publica desde 375 px de lado corto", async () => {
    assert.equal(classifyImage(await inspectImage(await picture({ size: [500, 500] }))).status, "verified");
    assert.equal(classifyImage(await inspectImage(await picture({ size: [375, 438] }))).status, "verified");
  });

  it("deja pendiente la baja resolución, sin descartarla", async () => {
    const result = classifyImage(await inspectImage(await picture({ size: [360, 360] })));
    assert.equal(result.status, "pending");
    assert.match(result.note ?? "", /Baja resolución \(360×360 px\)/);
  });

  it("admite AVIF como cualquier otro formato", async () => {
    const avif = await sharp(await picture({ size: [576, 576] })).avif().toBuffer();
    const inspection = await inspectImage(avif);
    assert.deepEqual([inspection?.format, inspection?.extension, inspection?.width], ["avif", "avif", 576]);
    assert.equal(classifyImage(inspection).status, "verified");
  });

  it("rechaza lo que no sirve ni para una tarjeta", async () => {
    assert.equal(classifyImage(await inspectImage(await picture({ size: [200, 200] }))).status, "rejected");
  });

  it("rechaza lo que no es una imagen", async () => {
    const inspection = await inspectImage(Buffer.from("<html>no encontrado</html>"));
    assert.equal(inspection, null);
    assert.equal(classifyImage(inspection).status, "rejected");
  });

  it("publica el fondo gris claro y lo deja anotado", async () => {
    const inspection = await inspectImage(await picture({ background: { r: 232, g: 232, b: 230, alpha: 1 } }));
    assert.equal(inspection?.background, "light");
    // La pala se sigue distinguiendo del fondo: no se toma toda la imagen por contenido.
    assert.ok((inspection?.content?.width ?? 1) < 0.5);
    const result = classifyImage(inspection);
    assert.deepEqual([result.status, /Fondo gris claro/.test(result.note ?? "")], ["verified", true]);
  });

  it("deja pendiente un fondo de color", async () => {
    const result = classifyImage(await inspectImage(await picture({ background: { r: 30, g: 120, b: 200, alpha: 1 } })));
    assert.deepEqual([result.status, /fondo/.test(result.note ?? "")], ["pending", true]);
  });

  it("deja pendiente una pala cortada por el borde", async () => {
    const result = classifyImage(await inspectImage(await picture({ box: [0.25, 0, 0.5, 0.9] })));
    assert.deepEqual([result.status, /cortada/.test(result.note ?? "")], ["pending", true]);
  });

  it("deja pendiente un encuadre que no es el de una sola pala en vertical", async () => {
    const result = classifyImage(await inspectImage(await picture({ box: [0.1, 0.3, 0.8, 0.4] })));
    assert.deepEqual([result.status, /encuadre/.test(result.note ?? "")], ["pending", true]);
  });

  it("deja pendiente la imagen cuya asociación con la pala está por revisar", async () => {
    const inspection = await inspectImage(await picture());
    assert.equal(classifyImage(inspection, { needsMatchReview: true }).status, "pending");
    assert.equal(classifyImage(inspection, { duplicateOf: "otra-pala-2026" }).status, "pending");
  });
});

describe("importación de imágenes", () => {
  const item = (id: string, url: string, extra: Partial<MediaItem> = {}): MediaItem => ({
    racketId: id, racketSlug: `pala-${id}`, source: "padelzoom", sourceUrl: url,
    role: "primary", position: 0, needsMatchReview: false, ...extra,
  });
  const image = (bytes: Buffer): Download => ({ status: 200, contentType: "image/jpeg", bytes });

  function setup(items: MediaItem[], responses: Record<string, Download | Error>) {
    const { repository, rows } = createMemoryMediaRepository(items);
    const { storage, files } = createMemoryStorage();
    const requested: string[] = [];
    const download: Downloader = async (url) => {
      requested.push(url);
      const response = responses[url];
      if (!response) return { status: 404, contentType: "text/html", bytes: Buffer.from("no") };
      if (response instanceof Error) throw response;
      return response;
    };
    const run = (dryRun = false) =>
      importMedia({ source: "padelzoom", repository, storage, download, now: () => NOW, dryRun });
    return { run, rows, files, requested };
  }

  it("descarga, mide, guarda la copia y deja la imagen verificada", async () => {
    const bytes = await picture({ size: [900, 900] });
    const { run, rows, files } = setup([item("1", "https://pz.test/a.jpg")], { "https://pz.test/a.jpg": image(bytes) });
    const report = await run();

    assert.deepEqual([report.downloaded, report.verified, report.uploaded, report.failed.length], [1, 1, 1, 0]);
    // La extensión sale del contenido real (PNG), no del nombre de la URL.
    assert.deepEqual([...files.keys()], ["rackets/1/primary.png"]);
    const media = rows[0].media;
    assert.deepEqual(
      [media?.storagePath, media?.width, media?.height, media?.fileSize, media?.status, media?.fetchedAt],
      ["rackets/1/primary.png", 900, 900, bytes.length, "verified", NOW.toISOString()],
    );
    assert.match(media?.fileHash ?? "", /^[0-9a-f]{64}$/);
  });

  it("una descarga fallida se anota, queda pendiente y no detiene las demás", async () => {
    const { run, rows, requested } = setup(
      [item("1", "https://pz.test/rota.jpg"), item("2", "https://pz.test/caida.jpg"), item("3", "https://pz.test/ok.jpg")],
      { "https://pz.test/caida.jpg": new Error("timeout"), "https://pz.test/ok.jpg": image(await picture()) },
    );
    const report = await run();

    assert.deepEqual(report.failed.map((failure) => failure.error), ["HTTP 404", "timeout"]);
    assert.equal(report.verified, 1);
    assert.deepEqual(rows.map((row) => [row.media?.status ?? null, row.error]), [
      [null, "HTTP 404"], [null, "timeout"], ["verified", null],
    ]);

    // Al repetir, solo se reintentan las fallidas.
    requested.length = 0;
    await run();
    assert.deepEqual(requested, ["https://pz.test/rota.jpg", "https://pz.test/caida.jpg"]);
  });

  it("no acepta una respuesta que no es una imagen ni una imagen sin URL", async () => {
    const { run } = setup([item("1", "https://pz.test/pagina"), item("2", "")], {
      "https://pz.test/pagina": { status: 200, contentType: "text/html", bytes: Buffer.from("<html>") },
    });
    const report = await run();

    assert.equal(report.downloaded, 0);
    assert.match(report.failed[0].error, /no es una imagen/);
    assert.match(report.failed[1].error, /URL de origen/);
  });

  it("rechaza un archivo que dice ser imagen y no lo es, sin guardarlo", async () => {
    const { run, rows, files } = setup([item("1", "https://pz.test/falsa.jpg")], {
      "https://pz.test/falsa.jpg": image(Buffer.from("esto no es un jpg")),
    });
    const report = await run();

    assert.deepEqual([report.rejected, files.size, rows[0].media?.storagePath], [1, 0, null]);
  });

  it("la misma imagen en dos palas se sube una vez y las dos quedan por revisar", async () => {
    const bytes = await picture();
    const { run, rows, files } = setup(
      [item("1", "https://pz.test/a.jpg"), item("2", "https://pz.test/b.jpg"), item("3", "https://pz.test/c.jpg")],
      {
        "https://pz.test/a.jpg": image(bytes),
        "https://pz.test/b.jpg": image(bytes),
        "https://pz.test/c.jpg": image(await picture({ color: "#7fb800" })),
      },
    );
    const report = await run();

    assert.deepEqual(report.duplicates, [{ slug: "pala-2", sameAs: "pala-1" }]);
    assert.equal(report.uploaded, 2);
    assert.deepEqual([...files.keys()], ["rackets/1/primary.png", "rackets/3/primary.png"]);
    assert.deepEqual(rows.map((row) => row.media?.status), ["pending", "pending", "verified"]);
    assert.equal(rows[1].media?.storagePath, "rackets/1/primary.png");
    assert.match(rows[0].media?.note ?? "", /misma imagen/);
  });

  it("una asociación marcada para revisión se guarda pero no se verifica", async () => {
    const { run, rows, files } = setup([item("1", "https://pz.test/a.jpg", { needsMatchReview: true })], {
      "https://pz.test/a.jpg": image(await picture()),
    });
    await run();

    assert.deepEqual([rows[0].media?.status, files.size], ["pending", 1]);
  });

  it("repetir la importación no vuelve a descargar ni a subir nada", async () => {
    const { run, files, requested } = setup([item("1", "https://pz.test/a.jpg")], {
      "https://pz.test/a.jpg": image(await picture()),
    });
    await run();
    const second = await run();

    assert.deepEqual([second.total, requested.length, files.size], [0, 1, 1]);
  });

  it("volver a pasar los controles recorre todas las imágenes sin subirlas de nuevo", async () => {
    const { repository, rows } = createMemoryMediaRepository([item("1", "https://pz.test/a.jpg")]);
    const { storage, files } = createMemoryStorage();
    const bytes = await picture({ size: [520, 520] });
    let uploads = 0;
    const counting = { ...storage, upload: async (...args: Parameters<typeof storage.upload>) => { uploads++; await storage.upload(...args); } };
    const options = { source: "padelzoom", repository, storage: counting, download: async () => image(bytes), now: () => NOW };

    await importMedia(options);
    // Como si la hubiera dejado pendiente un criterio anterior, más estricto.
    rows[0].media = { ...rows[0].media!, status: "pending", note: "Baja resolución" };

    assert.equal((await importMedia(options)).total, 0);
    const rechecked = await importMedia({ ...options, recheck: true });

    assert.deepEqual([rechecked.total, rechecked.verified, rechecked.uploaded], [1, 1, 0]);
    assert.deepEqual([rows[0].media?.status, rows[0].media?.storagePath], ["verified", "rackets/1/primary.png"]);
    assert.deepEqual([uploads, files.size], [1, 1]);
  });

  it("la imagen de otra fuente para la misma pala no pisa la que ya había", async () => {
    const first = await picture({ color: "#15171a" });
    const second = await picture({ color: "#7fb800" });
    const { repository, rows } = createMemoryMediaRepository([
      item("1", "https://pz.test/a.jpg"),
      item("1", "https://fabricante.test/a.jpg", { source: "fabricante" }),
    ]);
    const { storage, files } = createMemoryStorage();
    const download: Downloader = async (url) => image(url.includes("fabricante") ? second : first);

    await importMedia({ source: "padelzoom", repository, storage, download, now: () => NOW });
    await importMedia({ source: "fabricante", repository, storage, download, now: () => NOW });

    assert.deepEqual([...files.keys()], ["rackets/1/primary.png", "rackets/1/primary-fabricante.png"]);
    assert.deepEqual(rows.map((row) => row.media?.status), ["verified", "verified"]);
    assert.ok(files.get("rackets/1/primary.png")?.bytes.equals(first));
  });

  it("la simulación clasifica sin guardar nada", async () => {
    const { run, rows, files } = setup([item("1", "https://pz.test/a.jpg")], {
      "https://pz.test/a.jpg": image(await picture()),
    });
    const report = await run(true);

    assert.deepEqual([report.verified, report.uploaded, files.size, rows[0].media], [1, 1, 0, null]);
  });
});
