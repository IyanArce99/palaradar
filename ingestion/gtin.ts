const GTIN_LENGTH = 14;

function hasValidCheckDigit(gtin14: string): boolean {
  const digits = gtin14.split("").map(Number);
  const sum = digits
    .slice(0, GTIN_LENGTH - 1)
    .reduce((total, digit, i) => total + digit * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === digits[GTIN_LENGTH - 1];
}

/**
 * Valida un EAN-13, UPC-12 o GTIN-14 y lo devuelve normalizado a 14 dígitos,
 * para que el mismo producto se compare igual venga como venga. Devuelve null
 * si no tiene el formato o el dígito de control correctos: cada tienda guarda
 * el código en un campo distinto, así que se reconoce por forma, no por nombre.
 */
export function normalizeGtin(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? "";
  if (!/^\d{12,14}$/.test(value)) return null;

  const gtin14 = value.padStart(GTIN_LENGTH, "0");
  return hasValidCheckDigit(gtin14) ? gtin14 : null;
}
