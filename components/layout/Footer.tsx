import Link from "next/link";
import { Logo } from "@/components/ui/icons";
import { catalogShortcuts, mainNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { getBrands, isDemoData } from "@/data";
import { catalogHref } from "@/lib/catalog/query";
import { routes } from "@/lib/routes";

interface FooterColumnProps {
  title: string;
  links: { label: string; href: string }[];
}

function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div>
      <h2 className="mb-1.5 font-extrabold text-white lg:mb-0">{title}</h2>
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
            El lugar al que vas antes de comprar una pala: opiniones, comparativas y precios en
            todas las tiendas.
          </p>
          {isDemoData && (
            <p className="mt-3 max-w-[320px]">
              Versión de demostración: los precios, las tiendas y las opiniones que ves son datos
              de ejemplo.
            </p>
          )}
        </div>

        <FooterColumn
          title="Palas por marca"
          links={brands.map((brand) => ({ label: brand.name, href: routes.brand(brand.slug) }))}
        />
        <FooterColumn
          title="Palas por tipo"
          links={catalogShortcuts.map((shortcut) => ({
            label: shortcut.shortLabel,
            href: catalogHref(shortcut.query),
          }))}
        />
        <FooterColumn title={siteConfig.name} links={mainNav} />
      </div>
    </footer>
  );
}
