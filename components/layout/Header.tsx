import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Logo, ScanIcon, SearchIcon } from "@/components/ui/icons";
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
          <span className="text-[19px] font-black tracking-[-0.02em] lg:text-xl">
            {siteConfig.name}
          </span>
        </Link>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex gap-[22px] text-[15px] font-bold whitespace-nowrap">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <SearchForm variant="header" className="hidden max-w-[360px] flex-1 lg:flex" />

        <div className="ml-auto hidden lg:block">
          <ButtonLink href={routes.scan} size="nav" pill>
            <ScanIcon size={20} />
            Escanear mi pala
          </ButtonLink>
        </div>

        <Link
          href={`${routes.catalog}#buscar`}
          aria-label="Buscar palas"
          className="grid size-11 place-items-center rounded-full bg-mist lg:hidden"
        >
          <SearchIcon />
        </Link>
      </div>
    </header>
  );
}
