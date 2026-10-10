import Link from "next/link";
import { FavoritesLink } from "@/components/favorites/FavoritesLink";
import { ButtonLink } from "@/components/ui/Button";
import { Logo, SearchIcon } from "@/components/ui/icons";
import { mainNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { routes } from "@/lib/routes";
import { SearchForm } from "./SearchForm";

export function Header() {
  return (
    <header className="border-line bg-white lg:border-b">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-[30px] px-5 py-3 lg:px-12 lg:py-4">
        <Link href={routes.home} className="flex items-center gap-2">
          <Logo />
          <span className="text-lg font-black tracking-[-0.02em] lg:text-xl">
            {siteConfig.name}
          </span>
        </Link>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex gap-6 text-base font-bold whitespace-nowrap">
            {/* «Pala ideal» no va en la lista: es el botón de la derecha. */}
            {mainNav
              .filter((item) => item.href !== routes.idealPala)
              .map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>

        <SearchForm variant="header" className="hidden max-w-[360px] flex-1 lg:flex" />

        {/* La acción principal es encontrar una pala: el buscador y, para quien no sabe cuál, el recomendador. */}
        <div className="ml-auto hidden items-center gap-2.5 lg:flex">
          <FavoritesLink />
          <ButtonLink href={routes.idealPala} size="nav" pill>
            Encontrar mi pala
          </ButtonLink>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <FavoritesLink />
          <Link
            href={`${routes.catalog}#buscar`}
            aria-label="Buscar palas"
            className="grid size-11 place-items-center rounded-full bg-mist"
          >
            <SearchIcon />
          </Link>
        </div>
      </div>
    </header>
  );
}
