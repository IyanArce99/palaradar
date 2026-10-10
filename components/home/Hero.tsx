import Link from "next/link";
import { SearchForm } from "@/components/layout/SearchForm";
import { ButtonLink } from "@/components/ui/Button";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { siteConfig } from "@/config/site";
import { formatEuro } from "@/lib/format";
import { isProductPhoto, palaAlt } from "@/lib/media";
import { routes } from "@/lib/routes";
import type { Pala } from "@/types/catalog";
import type { PriceSummary } from "@/types/pricing";

// Ilustración provisional (scripts/generate-art.mjs) hasta tener la foto de portada.
const HERO_IMAGE = "/img/hero-palas.svg";

interface HeroProps {
  featured: { pala: Pala; price: PriceSummary } | null;
}

/** Portada: el buscador lidera; debajo, el recomendador y el comparador. */
export function Hero({ featured }: HeroProps) {
  // Sin foto real de la destacada se mantiene la ilustración.
  const main = featured?.pala.images[0];
  const photo = featured && main && isProductPhoto(main) ? main : null;

  return (
    <section className="mx-auto max-w-[1280px] px-5 pt-5 lg:grid lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-12 lg:pt-[72px] lg:pb-16">
      <div>
        <h1 className="text-[40px] leading-none font-black tracking-[-0.035em] text-balance lg:text-[76px]">
          {siteConfig.tagline}
        </h1>
        <p className="mt-3.5 text-base leading-normal text-pretty text-ink lg:mt-6 lg:text-xl">
          Compara cientos de palas, consulta sus características y encuentra el mejor precio.
        </p>
        <SearchForm variant="hero" className="mt-6 max-w-[580px] lg:mt-8" />
        <div className="mt-2.5 flex flex-col gap-2.5 lg:mt-4 lg:flex-row lg:items-center lg:gap-3.5">
          <ButtonLink href={routes.idealPala} size="lg" pill>
            Encontrar mi pala ideal
          </ButtonLink>
          <ButtonLink href={routes.compare} size="lg" variant="outline" pill>
            Comparar dos palas
          </ButtonLink>
        </div>
      </div>

      <div className="relative mt-7 lg:mt-0">
        {photo && featured ? (
          // Foto real de la pala destacada: es la misma que anuncia la tarjeta de precio.
          <PalaPhoto
            src={photo}
            alt={palaAlt(featured.pala)}
            sizes="(min-width: 1024px) 50vw, 100vw"
            priority
            // En móvil la tarjeta de precio tapa la parte baja: se deja aire abajo.
            imageClassName="object-contain px-[12%] pt-[5%] pb-[30%] mix-blend-multiply lg:p-[9%] lg:pb-[20%]"
            className="h-[300px] rounded-3xl lg:h-[520px] lg:rounded-3xl"
          />
        ) : (
          <PalaPhoto
            src={HERO_IMAGE}
            alt=""
            sizes="(min-width: 1024px) 50vw, 100vw"
            // En móvil la tarjeta de precio tapa la parte baja: se encuadra arriba.
            imageClassName="object-cover object-top pt-3 lg:object-contain lg:object-center lg:p-[4%]"
            placeholderLabel="foto · palas sobre fondo neutro"
            className="h-[250px] rounded-3xl lg:h-[520px] lg:rounded-3xl"
          />
        )}
        {featured && (
          <Link
            href={routes.pala(featured.pala.slug)}
            className="absolute inset-x-3.5 bottom-3.5 flex items-center justify-between gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-[0_10px_30px_rgb(21_23_26/0.12)] lg:right-auto lg:bottom-10 lg:-left-7 lg:w-[300px] lg:rounded-3xl lg:px-5 lg:py-[18px]"
          >
            <span>
              <span className="block text-sm font-extrabold lg:text-base">
                {featured.pala.brand.name} {featured.pala.model}
              </span>
              {featured.price.verdict.status === "good" && (
                <span className="block text-xs font-bold text-forest lg:text-sm">
                  <span aria-hidden="true">● </span>
                  {featured.price.verdict.label}
                </span>
              )}
            </span>
            <span className="text-right">
              <span className="block text-xs text-muted lg:text-sm">desde</span>
              <span className="block text-lg font-black whitespace-nowrap tabular-nums lg:text-2xl">
                {formatEuro(featured.price.current)}
              </span>
            </span>
          </Link>
        )}
      </div>
    </section>
  );
}
