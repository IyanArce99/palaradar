import type { Metadata } from "next";
import { Finder, type FinderShowcase } from "@/components/finder/Finder";
import { FinderEmpty, FinderResults } from "@/components/finder/FinderResults";
import { JsonLd } from "@/components/seo/JsonLd";
import { alertsAvailable, countPalas, getPalaBySlug, getTopPalas, recommendPalas } from "@/data";
import { isProductPhoto } from "@/lib/media";
import { isComplete, parseFinderAnswers, toPrefs } from "@/lib/recommender";
import { routes } from "@/lib/routes";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

/** La mejor opción y tres alternativas */
const RESULT_COUNT = 4;
const SHOWCASE_POOL = 8;
const SHOWCASE_COUNT = 3;

type RawParams = Record<string, string | string[] | undefined>;

interface IdealPalaPageProps {
  searchParams: Promise<RawParams>;
}

export async function generateMetadata({ searchParams }: IdealPalaPageProps): Promise<Metadata> {
  const hasParams = Object.keys(await searchParams).length > 0;

  return pageMetadata({
    title: "Encuentra tu pala ideal",
    description:
      "Responde seis preguntas sobre cómo juegas y descubre las palas de pádel que mejor encajan contigo, con su mejor precio de hoy.",
    path: routes.idealPala,
    // El resultado de unas respuestas concretas no es una página que indexar.
    index: !hasParams,
  });
}

/** Tres palas del catálogo para ilustrar la entrada: primero las que tienen foto real. */
async function getShowcase(): Promise<FinderShowcase[]> {
  const top = (await getTopPalas(SHOWCASE_POOL)).filter((pala) => pala.image !== null);
  const withPhoto = top.filter((pala) => isProductPhoto(pala.image ?? ""));
  return [...withPhoto, ...top.filter((pala) => !withPhoto.includes(pala))]
    .slice(0, SHOWCASE_COUNT)
    .map((pala) => ({ name: `${pala.brand.name} ${pala.model}`, image: pala.image as string }));
}

// Quiz «Pala ideal». Las respuestas viajan en la URL, así que el resultado se
// calcula y se renderiza en servidor (lib/recommender.ts) y se puede compartir.
export default async function IdealPalaPage({ searchParams }: IdealPalaPageProps) {
  const answers = parseFinderAnswers(await searchParams);
  const complete = isComplete(answers);

  const [showcase, catalogCount, results] = await Promise.all([
    getShowcase(),
    countPalas(),
    complete ? recommendPalas(toPrefs(answers), RESULT_COUNT) : [],
  ]);
  // La mejor opción se enseña con su precio completo: tienda, nº de tiendas y veredicto.
  const top = results[0] ? await getPalaBySlug(results[0].pala.slug) : null;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { label: "Inicio", href: routes.home },
          { label: "Pala ideal", href: routes.idealPala },
        ])}
      />
      <Finder
        initialAnswers={answers}
        resultReady={complete}
        showcase={showcase}
        catalogCount={catalogCount}
      >
        {complete &&
          (top ? (
            <FinderResults answers={answers} top={top} results={results} alertsEnabled={alertsAvailable()} />
          ) : (
            <FinderEmpty answers={answers} />
          ))}
      </Finder>
    </>
  );
}
