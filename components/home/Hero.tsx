import Link from "next/link";
import { SearchForm } from "@/components/layout/SearchForm";
import { ButtonLink } from "@/components/ui/Button";
import { ScanIcon } from "@/components/ui/icons";
import { PalaPhoto } from "@/components/ui/PalaPhoto";
import { siteConfig } from "@/config/site";
import { formatEuro } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { Pala } from "@/types/catalog";
import type { PriceSummary } from "@/types/pricing";

// Ilustración provisional (scripts/generate-art.mjs) hasta tener la foto de portada.
const HERO_IMAGE = "/img/hero-palas.svg";

interface HeroProps {
  featured: { pala: Pala; price: PriceSummary } | null;
}

/** Portada: el buscador lidera y «Escanear mi pala» es la función diferencial. */
export function Hero({ featured }: HeroProps) {
  return (
    <section className="mx-auto max-w-[1280px] px-5 pt-5 lg:grid lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-12 lg:pt-[72px] lg:pb-16">
      <div>
        <h1 className="text-[42px] leading-none font-black tracking-[-0.035em] text-balance lg:text-[76px]">
          {siteConfig.tagline}
        </h1>
        <p className="mt-3.5 text-[17px] leading-[1.6] text-pretty text-ink lg:mt-[22px] lg:text-xl">
          Compara cientos de palas, descubre qué opinan otros jugadores y encuentra el mejor precio.
        </p>
        <SearchForm variant="hero" className="mt-[22px] max-w-[580px] lg:mt-8" />
        <div className="mt-2.5 flex flex-col gap-3.5 lg:mt-4 lg:flex-row lg:items-center">
          <ButtonLink href={routes.scan} size="lg" pill>
            <ScanIcon />
            Escanear mi pala
          </ButtonLink>
          <span className="hidden text-sm text-muted lg:inline">
            ¿No sabes cuál es? Hazle una foto.
          </span>
        </div>
      </div>

      <div className="relative mt-7 lg:mt-0">
        <PalaPhoto
          src={HERO_IMAGE}
          alt=""
          sizes="(min-width: 1024px) 50vw, 100vw"
          // En móvil la tarjeta de precio tapa la parte baja: se encuadra arriba.
          imageClassName="object-cover object-top pt-3 lg:object-contain lg:object-center lg:p-[4%]"
          placeholderLabel="foto · palas sobre fondo neutro"
          className="h-[250px] rounded-[22px] lg:h-[520px] lg:rounded-[28px]"
        />
        {featured && (
          <Link
            href={routes.pala(featured.pala.slug)}
            className="absolute inset-x-3.5 bottom-3.5 flex items-center justify-between gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-[0_10px_30px_rgb(21_23_26/0.12)] lg:right-auto lg:bottom-10 lg:-left-7 lg:w-[300px] lg:rounded-[20px] lg:px-5 lg:py-[18px]"
          >
            <span>
              <span className="block text-sm font-extrabold lg:text-base">
                {featured.pala.brand.name} {featured.pala.model}
              </span>
              {featured.price.verdict.status === "good" && (
                <span className="block text-xs font-bold text-forest lg:text-[13px]">
                  <span aria-hidden="true">● </span>
                  {featured.price.verdict.label}
                </span>
              )}
            </span>
            <span className="text-right">
              <span className="block text-[11px] text-muted lg:text-[13px]">desde</span>
              <span className="block text-[19px] font-black whitespace-nowrap tabular-nums lg:text-[26px]">
                {formatEuro(featured.price.current)}
              </span>
            </span>
          </Link>
        )}
      </div>
    </section>
  );
}
