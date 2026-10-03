// Lectura de títulos de producto: separa año, variantes y resto del modelo para
// poder comparar el título de una tienda con una pala del catálogo.

/** Palabras que no distinguen un modelo de otro */
const NOISE = new Set(["pala", "palas", "padel", "raqueta", "de", "by", "the", "new", "nueva", "nuevo"]);

/**
 * Variantes de un mismo modelo. Dos palas que difieren en cualquiera de ellas
 * son productos distintos, aunque el resto del nombre coincida.
 */
const VARIANTS: Record<string, string> = {
  woman: "woman",
  women: "woman",
  w: "woman",
  lady: "woman",
  mujer: "woman",
  hybrid: "hybrid",
  hyb: "hybrid",
  comfort: "comfort",
  cmf: "comfort",
  junior: "junior",
  jr: "junior",
  control: "control",
  ctrl: "control",
  ctr: "control",
  light: "light",
  lite: "light",
  hard: "hard",
  hrd: "hard",
  soft: "soft",
  carbon: "carbon",
  attack: "attack",
  team: "team",
  plus: "plus",
};

/** Listados que nunca se emparejan solos: no son la pala suelta y nueva. */
const NEVER_AUTOMATIC = /\b(pack|paletero|mochila|test|segunda mano|reacondicionad[ao])\b/;

export interface ParsedTitle {
  /** Palabras del modelo, sin marca, año, variantes ni ruido */
  tokens: Set<string>;
  variants: Set<string>;
  year: number | null;
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function brandWords(brand: string): string[] {
  return normalizeText(brand)
    .split(/[^a-z0-9]+/)
    .filter((word) => word && word !== "padel");
}

/**
 * Forma comparable de una marca: sin acentos, mayúsculas, espacios ni la
 * coletilla «padel». Así «Adidas Padel» = «adidas» y «Star Vie» = «StarVie».
 */
export function normalizeBrand(brand: string): string {
  return brandWords(brand).join("");
}

export function isBundleOrUsed(title: string): boolean {
  return NEVER_AUTOMATIC.test(normalizeText(title));
}

function yearOf(token: string): number | null {
  if (/^20[2-3]\d$/.test(token)) return Number(token);
  // Colección escrita con dos cifras: «Neuron 25», «Hack 04 26». Los números
  // bajos («04», «10») son parte del modelo, no un año.
  if (/^(2[2-9]|3\d)$/.test(token)) return 2000 + Number(token);
  return null;
}

/**
 * Descompone un título o un nombre de modelo. Las marcas indicadas se eliminan
 * del texto, vengan escritas juntas o separadas («StarVie», «Star Vie»).
 */
export function parseTitle(text: string, brands: (string | null)[]): ParsedTitle {
  const ignored = new Set(
    brands.flatMap((brand) => (brand ? [...brandWords(brand), normalizeBrand(brand)] : [])),
  );
  const words = normalizeText(text)
    .replace(/\+/g, " plus ")
    .split(/[^a-z0-9.]+/)
    .map((word) => word.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);

  const parsed: ParsedTitle = { tokens: new Set(), variants: new Set(), year: null };

  for (const word of words) {
    if (NOISE.has(word) || ignored.has(word)) continue;

    const year = yearOf(word);
    if (year !== null && parsed.year === null) {
      parsed.year = year;
    } else if (VARIANTS[word]) {
      parsed.variants.add(VARIANTS[word]);
    } else {
      parsed.tokens.add(word);
    }
  }

  return parsed;
}
