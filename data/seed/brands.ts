/** Marcas del catálogo. El texto es descripción editorial propia, no dato del fabricante. */
export interface BrandSeed {
  slug: string;
  name: string;
  description: string;
}

export const brandSeeds: BrandSeed[] = [
  {
    slug: "bullpadel",
    name: "Bullpadel",
    description: "Marca española de pádel con una gama amplia, de iniciación a competición.",
  },
  {
    slug: "nox",
    name: "Nox",
    description: "Marca española especializada en pádel, con palas para todos los niveles.",
  },
  {
    slug: "head",
    name: "Head",
    description: "Fabricante de material de raqueta con una línea completa de palas de pádel.",
  },
  {
    slug: "babolat",
    name: "Babolat",
    description: "Fabricante francés de material de raqueta con gama propia de pádel.",
  },
  {
    slug: "adidas",
    name: "Adidas",
    description: "Línea de palas de pádel de Adidas, con modelos de control, polivalentes y de potencia.",
  },
  {
    slug: "siux",
    name: "Siux",
    description: "Marca española de pádel con gamas para jugadores de club y de competición.",
  },
  {
    slug: "starvie",
    name: "StarVie",
    description: "Marca española de pádel con fabricación propia.",
  },
  {
    slug: "wilson",
    name: "Wilson",
    description: "Fabricante de material de raqueta con una línea de palas de pádel.",
  },
];
