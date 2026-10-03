import type { Guide } from "@/types/catalog";

// Contenido editorial: no vive en la base de datos. Las imágenes son
// ilustraciones provisionales de scripts/generate-art.mjs.
export const guides: Guide[] = [
  {
    slug: "mejores-palas-padel-2026",
    title: "Las mejores palas de pádel de 2026",
    subtitle: "Según tu nivel y tu forma de jugar",
    image: "/img/guias/mejores-palas-padel-2026.svg",
  },
  {
    slug: "mejores-palas-nivel-intermedio",
    title: "Mejores palas para nivel intermedio",
    subtitle: "Para cuando ya rematas y quieres más",
    image: "/img/guias/mejores-palas-nivel-intermedio.svg",
  },
  {
    slug: "palas-menos-de-150-euros",
    title: "Palas por menos de 150 €",
    subtitle: "Buenas palas sin pasarte de presupuesto",
    image: "/img/guias/palas-menos-de-150-euros.svg",
  },
];

/** Pala destacada en la portada */
export const featuredPalaSlug = "bullpadel-vertex-04-2025";
