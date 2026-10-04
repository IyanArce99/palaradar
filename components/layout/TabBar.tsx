"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanIcon } from "@/components/ui/icons";
import { mobileTabs, type TabItem } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";

// La ficha tiene su propia barra inferior de precio; el escáner ocupa toda la pantalla.
const HIDDEN_ON = ["/pala/", routes.scan];

function isActive(tab: TabItem, pathname: string): boolean {
  if (tab.match.length === 0) return pathname === tab.href;
  return tab.match.some((prefix) => pathname.startsWith(prefix));
}

/** Barra inferior móvil con el botón flotante «Escanear». */
export function TabBar() {
  const pathname = usePathname();

  if (HIDDEN_ON.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <nav
      aria-label="Navegación móvil"
      className="sticky bottom-0 z-20 border-t border-line bg-white px-1 pt-2 pb-[calc(14px+env(safe-area-inset-bottom))] lg:hidden"
    >
      <Link
        href={routes.scan}
        className="absolute -top-[66px] right-3.5 flex h-[52px] items-center gap-[9px] rounded-full bg-lime pr-5 pl-3.5 text-[15px] font-extrabold shadow-[0_8px_22px_rgb(21_23_26/0.22)]"
      >
        <ScanIcon />
        Escanear
      </Link>

      <ul className="flex justify-around">
        {mobileTabs.map((tab) => {
          const active = isActive(tab, pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-11 w-[72px] flex-col items-center justify-end gap-[5px]"
              >
                <span
                  aria-hidden="true"
                  className={cn("h-1 w-[22px] rounded-sm", active && "bg-carbon")}
                />
                <span
                  className={cn(
                    "text-xs whitespace-nowrap",
                    active ? "font-extrabold text-carbon" : "font-medium text-muted",
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
