import Link from "next/link";
import { Logo } from "@/components/ui/icons";
import { footerBrandSlugs, mainNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { getCollection } from "@/content/collections";
import { alertsAvailable, getBrands, hasTestPrices } from "@/data";
import { routes } from "@/lib/routes";

/** Colecciones del pie, en este orden; el resto se alcanza desde el catálogo y las guías */
const FOOTER_COLLECTIONS = [
  "principiantes",
  "nivel-intermedio",
  "control",
  "potencia",
  "polivalentes",
  "redondas",
  "diamante",
  "menos-de-150-euros",
];

interface FooterColumnProps {
  title: string;
  links: { label: string; href: string }[];
}

function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div>
      {/* No es un encabezado: los del pie se repetían como h2 en todas las páginas. */}
      <p className="mb-1.5 font-extrabold text-white lg:mb-0">{title}</p>
      <ul>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="hover:text-white hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function Footer() {
  const brands = await getBrands();

  return (
    <footer className="border-t border-white/10 bg-carbon text-[13px] leading-[1.7] text-ash lg:text-sm">
      <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-x-[18px] gap-y-6 px-5 pt-7 pb-8 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:gap-10 lg:p-12">
        <div className="col-span-2 lg:col-span-1">
          <div className="mb-2.5 flex items-center gap-2 text-lg font-black text-white">
            <Logo inverse />
            {siteConfig.name}
          </div>
          <p className="max-w-[320px]">
            El lugar al que vas antes de comprar una pala: características, comparativas y precios
            de las tiendas que seguimos.
          </p>
          {hasTestPrices && (
            <p className="mt-3 max-w-[320px]">
              Versión en pruebas: las tiendas y los precios que ves son datos de prueba, no
              ofertas reales.
            </p>
          )}
        </div>

        <FooterColumn
          title="Palas por marca"
          links={footerBrandSlugs.flatMap((slug) => {
            const brand = brands.find((item) => item.slug === slug);
            return brand ? [{ label: brand.name, href: routes.brand(brand.slug) }] : [];
          })}
        />
        <FooterColumn
          title="Palas por tipo"
          links={FOOTER_COLLECTIONS.flatMap((slug) => {
            const collection = getCollection(slug);
            return collection ? [{ label: collection.label, href: routes.collection(collection.slug) }] : [];
          })}
        />
        <FooterColumn
          title={siteConfig.name}
          links={[
            ...mainNav,
            { label: "Informes", href: routes.reports },
            { label: "Favoritas", href: routes.favorites },
            // Solo si las alertas se pueden crear: sin ellas la página no tendría nada que enseñar.
            ...(alertsAvailable() ? [{ label: "Mis alertas", href: routes.myAlerts }] : []),
            { label: "Privacidad", href: routes.privacy },
          ]}
        />
      </div>
    </footer>
  );
}
