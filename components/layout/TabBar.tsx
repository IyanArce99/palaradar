"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TabIcon } from "@/components/ui/icons";
import { mobileTabs, type TabItem } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";

// La ficha tiene su propia barra inferior de precio; el escáner y el quiz «Pala
// ideal» ocupan toda la pantalla.
const HIDDEN_ON = ["/pala/", routes.scan, routes.idealPala];

function isActive(tab: TabItem, pathname: string): boolean {
  if (tab.match.length === 0) return pathname === tab.href;
  return tab.match.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Barra inferior móvil. No lleva ningún botón flotante encima: tapaba precios y
 * enlaces del contenido.
 */
export function TabBar() {
  const pathname = usePathname();

  if (HIDDEN_ON.some((prefix) => pathname.startsWith(prefix))) return null;
  // El resultado de una comparación lleva su propia barra, con el precio de cada pala.
  if (pathname.startsWith(routes.compare) && pathname !== routes.compare) return null;

  return (
    <nav
      aria-label="Navegación móvil"
      className="sticky bottom-0 z-20 border-t border-line bg-white px-1 pt-2 pb-[calc(10px+env(safe-area-inset-bottom))] lg:hidden"
    >
      <ul className="mx-auto grid max-w-[520px] grid-cols-5">
        {mobileTabs.map((tab) => {
          const active = isActive(tab, pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-[52px] flex-col items-center justify-end gap-1"
              >
                {/* La pestaña activa se marca con una pastilla lima tras el icono. */}
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full",
                    active ? "bg-lime text-carbon" : "text-muted",
                  )}
                >
                  <TabIcon name={tab.icon} size={22} />
                </span>
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
