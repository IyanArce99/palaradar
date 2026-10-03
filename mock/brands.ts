import type { Brand } from "@/types/catalog";

export const bullpadel: Brand = {
  id: "brand-bullpadel",
  slug: "bullpadel",
  name: "Bullpadel",
  description:
    "Una de las marcas de referencia del pádel profesional. Sus palas suelen destacar por la potencia y por unos acabados muy cuidados.",
};

export const nox: Brand = {
  id: "brand-nox",
  slug: "nox",
  name: "Nox",
  description:
    "Marca española con palas muy equilibradas, conocidas por su comodidad y por perdonar los golpes descentrados.",
};

export const adidas: Brand = {
  id: "brand-adidas",
  slug: "adidas",
  name: "Adidas",
  description:
    "Palas con mucha pegada y estructuras rígidas, pensadas sobre todo para jugadores ofensivos.",
};

export const head: Brand = {
  id: "brand-head",
  slug: "head",
  name: "Head",
  description:
    "Palas ligeras y manejables, con un tacto reconocible y una buena relación entre control y salida de bola.",
};

export const siux: Brand = {
  id: "brand-siux",
  slug: "siux",
  name: "Siux",
  description:
    "Marca centrada en el jugador de club: mucha pegada y materiales de gama alta a precios contenidos.",
};

export const starvie: Brand = {
  id: "brand-starvie",
  slug: "starvie",
  name: "StarVie",
  description:
    "Palas fabricadas en España, de tacto blando y punto dulce amplio, muy valoradas por su confort.",
};

export const brands: Brand[] = [bullpadel, nox, head, adidas, siux, starvie];
