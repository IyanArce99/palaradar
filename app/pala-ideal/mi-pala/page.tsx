import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { PalaCard } from "@/components/pala/PalaCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { buttonClass } from "@/components/ui/Button";
import { PageHeading } from "@/components/ui/PageHeading";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { getAlternativeCandidates, getPalaBySlug, searchCatalog } from "@/data";
import {
  ALTERNATIVE_MODES,
  alternativeTarget,
  findUpgrades,
  KEEP_LABELS,
  UPGRADE_KEEPS,
  UPGRADE_WANTS,
  type UpgradeKeep,
  type UpgradeWant,
} from "@/lib/alternatives";
import { DEFAULT_QUERY } from "@/lib/catalog/query";
import { comparePath } from "@/lib/compare";
import { formatEuro } from "@/lib/format";
import { SHAPE_LABELS } from "@/lib/labels";
import { palaAlt } from "@/lib/media";
import { missingData, palaName } from "@/lib/pala-content";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

type RawParams = Record<string, string | string[] | undefined>;

interface UpgradePageProps {
  searchParams: Promise<RawParams>;
}

/** Parámetros de la URL: el resultado se puede compartir y recuperar */
const PARAMS = { pala: "pala", search: "q", wants: "quiero", keeps: "conservar", budget: "presupuesto" } as const;
const BUDGETS = [100, 150, 200, 250] as const;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEARCH_RESULTS = 8;
/** Entre tres y cinco palas: las que caben sin convertirlo en otro catálogo */
const RESULT_COUNT = 5;

export const metadata: Metadata = pageMetadata({
  title: "Cambiar de pala: alternativas a la tuya",
  description:
    "Dinos qué pala usas, qué quieres conservar y qué quieres cambiar, y te enseñamos las palas a la venta que más se le parecen y cumplen lo que buscas.",
  path: routes.upgrade,
  // El resultado depende de lo que elige cada persona: no es una página que indexar.
  index: false,
});

const list = (value: string | string[] | undefined) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const first = (value: string | string[] | undefined) => list(value)[0] ?? "";

function Checkbox({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-2.5 text-base">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="grid size-5 flex-none place-items-center rounded-md border-2 border-carbon text-xs text-transparent peer-checked:bg-carbon peer-checked:text-lime peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-carbon"
      >
        ✓
      </span>
      {label}
    </label>
  );
}

// «Tengo esta pala y quiero cambiar…»: la otra entrada del recomendador. Usa el
// mismo motor que las alternativas de la ficha (lib/alternatives.ts); todo el
// estado va en la URL y funciona sin JavaScript.
export default async function UpgradePage({ searchParams }: UpgradePageProps) {
  const params = await searchParams;
  const slug = SLUG.test(first(params[PARAMS.pala])) ? first(params[PARAMS.pala]) : "";
  const search = first(params[PARAMS.search]).trim().slice(0, 80);
  const wants = list(params[PARAMS.wants]).filter((item): item is UpgradeWant => (UPGRADE_WANTS as readonly string[]).includes(item));
  const keeps = list(params[PARAMS.keeps]).filter((item): item is UpgradeKeep => (UPGRADE_KEEPS as readonly string[]).includes(item));
  const budget = BUDGETS.find((value) => String(value) === first(params[PARAMS.budget])) ?? null;

  const current = slug ? await getPalaBySlug(slug) : null;
  const matches = !current && search.length >= 2 ? (await searchCatalog({ ...DEFAULT_QUERY, q: search }, { pageSize: SEARCH_RESULTS })).items : [];
  const asked = current !== null && (wants.length > 0 || keeps.length > 0 || budget !== null);
  const target = current ? alternativeTarget(current) : null;
  const result = target && asked ? findUpgrades(target, await getAlternativeCandidates(), { wants, keeps, maxPrice: budget }, RESULT_COUNT) : null;
  const unknown = current ? missingData(current) : [];

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Pala ideal", href: routes.idealPala },
          { label: "Cambiar de pala", href: routes.upgrade },
        ]}
      />
      <div className="mx-auto max-w-[1080px] pb-12 lg:pb-20">
        <PageHeading
          title="Cambiar de pala"
          lead="Dinos qué pala usas, qué te gusta de ella y qué quieres cambiar. Te enseñamos palas a la venta que se le parecen en lo que quieres conservar."
        />

        <div className="px-5 pt-6 lg:px-12 lg:pt-8">
          {!current && (
            <section aria-labelledby="paso-pala">
              <h2 id="paso-pala" className="text-xl font-black tracking-[-0.02em]">
                1. ¿Qué pala usas ahora?
              </h2>
              {slug && <p className="mt-2 text-base text-ink">No encontramos esa pala en el catálogo. Búscala por su nombre.</p>}
              <Form action={routes.upgrade} className="mt-3 flex max-w-[560px] gap-2">
                <label htmlFor="buscar-pala" className="sr-only">
                  Marca o modelo de tu pala
                </label>
                <input
                  id="buscar-pala"
                  name={PARAMS.search}
                  type="search"
                  defaultValue={search}
                  placeholder="Marca o modelo, por ejemplo «vertex 04»"
                  className="h-12 min-w-0 flex-1 rounded-2xl border-[1.5px] border-carbon px-4 text-base"
                />
                <button type="submit" className={buttonClass({ variant: "dark" })}>
                  Buscar
                </button>
              </Form>

              {search.length >= 2 && matches.length === 0 && (
                <p className="mt-4 text-base leading-normal text-ink">
                  No hay ninguna pala con «{search}» en el catálogo. Prueba solo con el modelo, o{" "}
                  <Link href={routes.idealPala} className="font-bold underline">
                    haz el test de Pala ideal
                  </Link>{" "}
                  si no la encuentras.
                </p>
              )}
              {matches.length > 0 && (
                <ul className="mt-4 grid gap-2.5 lg:grid-cols-2">
                  {matches.map((pala) => (
                    <li key={pala.id}>
                      <Link
                        href={`${routes.upgrade}?${PARAMS.pala}=${pala.slug}`}
                        className="flex items-center gap-3 rounded-2xl border border-line p-2.5 hover:border-carbon"
                      >
                        <PalaPhoto src={pala.image} alt="" sizes="56px" className="size-14 flex-none rounded-2xl" />
                        <span className="min-w-0">
                          <span className="block text-base leading-snug font-extrabold">
                            {pala.brand.name} {pala.model}
                          </span>
                          <span className="text-sm text-muted">
                            {pala.year} · {SHAPE_LABELS[pala.shape]}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-6 text-sm text-muted">
                ¿No tienes pala todavía?{" "}
                <Link href={routes.idealPala} className="font-bold text-carbon underline">
                  Haz el test de Pala ideal
                </Link>
              </p>
            </section>
          )}

          {current && (
            <>
              <section aria-labelledby="tu-pala" className="flex items-center gap-4 rounded-3xl bg-mist p-4">
                <PalaPhoto src={current.images[0] ?? null} alt={palaAlt(current)} sizes="96px" className="h-[110px] w-[88px] flex-none rounded-2xl" />
                <div className="min-w-0">
                  <p className="text-sm text-muted">Tu pala</p>
                  <h2 id="tu-pala" className="text-xl leading-[1.1] font-black">
                    <Link href={routes.pala(current.slug)} className="underline-offset-2 hover:underline">
                      {palaName(current)} {current.year}
                    </Link>
                  </h2>
                  <p className="mt-0.5 text-sm text-ink">
                    {SHAPE_LABELS[current.shape]}
                    {target?.price != null && ` · hoy desde ${formatEuro(target.price)}`}
                  </p>
                  <Link href={routes.upgrade} className="mt-1 inline-flex min-h-11 items-center text-sm font-bold underline">
                    Cambiar de pala
                  </Link>
                </div>
              </section>
              {unknown.length > 0 && (
                <p className="mt-3 text-sm leading-normal text-muted">
                  De tu pala no tenemos: {unknown.join(", ")}. Lo que no se sabe no se puede comparar ni exigir a otra pala.
                </p>
              )}

              <Form action={routes.upgrade} className="mt-7 grid gap-7 lg:grid-cols-3 lg:gap-10">
                <input type="hidden" name={PARAMS.pala} value={current.slug} />
                <fieldset>
                  <legend className="text-lg font-black">2. ¿Qué quieres conservar?</legend>
                  <p className="mb-1 text-sm text-muted">Las palas que te enseñemos lo compartirán con la tuya.</p>
                  {UPGRADE_KEEPS.map((keep) => (
                    <Checkbox key={keep} name={PARAMS.keeps} value={keep} label={KEEP_LABELS[keep]} checked={keeps.includes(keep)} />
                  ))}
                </fieldset>
                <fieldset>
                  <legend className="text-lg font-black">3. ¿Qué quieres cambiar?</legend>
                  <p className="mb-1 text-sm text-muted">Basta con que cumplan alguna; te decimos cuáles.</p>
                  {UPGRADE_WANTS.map((want) => {
                    const mode = ALTERNATIVE_MODES.find((item) => item.id === want);
                    // «Más barata» no tiene sentido si tu pala no tiene precio con el que comparar.
                    if (!mode || (want === "mas-barata" && target?.price === null)) return null;
                    return <Checkbox key={want} name={PARAMS.wants} value={want} label={mode.label} checked={wants.includes(want)} />;
                  })}
                </fieldset>
                <div>
                  <label htmlFor="presupuesto" className="block text-lg font-black">
                    4. Presupuesto
                  </label>
                  <p className="mb-2 text-sm text-muted">Con el precio de hoy en las tiendas que seguimos.</p>
                  <select
                    id="presupuesto"
                    name={PARAMS.budget}
                    defaultValue={budget === null ? "" : String(budget)}
                    className="h-12 w-full rounded-2xl border-[1.5px] border-carbon bg-white px-3 text-base"
                  >
                    <option value="">Sin tope</option>
                    {BUDGETS.map((value) => (
                      <option key={value} value={value}>
                        Hasta {value} €
                      </option>
                    ))}
                  </select>
                  <button type="submit" className={buttonClass({ className: "mt-4 w-full" })}>
                    Ver palas
                  </button>
                </div>
              </Form>

              {!asked && (
                <p className="mt-6 text-base leading-normal text-ink">
                  Elige al menos una cosa que conservar, que cambiar o un presupuesto. Si solo quieres ver palas parecidas, están en{" "}
                  <Link href={`${routes.pala(current.slug)}#alternativas`} className="font-bold underline">
                    la ficha de tu pala
                  </Link>
                  .
                </p>
              )}

              {result && (
                <section aria-labelledby="resultado" className="mt-10">
                  <h2 id="resultado" className="text-2xl leading-[1.1] font-black tracking-[-0.025em] lg:text-3xl">
                    {result.items.length > 0 ? "Palas que encajan con lo que pides" : "Ninguna pala a la venta cumple todo eso"}
                  </h2>
                  {result.unknownKeeps.length > 0 && (
                    <p className="mt-2 rounded-2xl bg-mist px-4 py-3 text-sm leading-normal text-ink">
                      No hemos podido exigir {result.unknownKeeps.map((keep) => KEEP_LABELS[keep].toLowerCase()).join(" ni ")}: tu pala
                      no lo declara, así que no hay con qué comparar.
                    </p>
                  )}
                  {result.items.length === 0 ? (
                    <p className="mt-3 text-base leading-normal text-ink">
                      Lo que conservas y el presupuesto son requisitos: quien no los cumple no aparece. Prueba a conservar una cosa
                      menos o a subir el presupuesto. Solo proponemos palas con precio hoy.
                    </p>
                  ) : (
                    <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {result.items.map((item) => (
                        <li key={item.pala.id}>
                          <PalaCard pala={item.pala} variant="alternative" badge={item.reasons[0]} photoClassName="h-[200px]" />
                          <ul className="mt-1.5 text-sm leading-snug text-ink">
                            {item.reasons.slice(1).map((reason) => (
                              <li key={reason} className="mt-0.5">
                                {reason}
                              </li>
                            ))}
                            {item.satisfied.length > 0 && (
                              <li className="mt-1 font-bold text-forest">Cumple: {item.satisfied.join(", ").toLowerCase()}</li>
                            )}
                            {item.unmet.length > 0 && <li className="mt-0.5 text-muted">No cumple: {item.unmet.join(", ").toLowerCase()}</li>}
                          </ul>
                          <Link href={comparePath(current.slug, item.pala.slug)} className="mt-1 flex min-h-11 items-center text-sm font-bold underline">
                            Comparar con la tuya
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-5 text-xs leading-normal text-muted">
                    Se comparan los datos declarados de cada pala y su precio de hoy. Lo que una pala no declara no se da por igual. Es
                    una orientación para acotar: no promete que una pala vaya a jugar mejor que la tuya.
                  </p>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
