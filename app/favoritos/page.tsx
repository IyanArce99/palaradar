import type { Metadata } from "next";
import { FavoritesList } from "@/components/favorites/FavoritesList";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeading } from "@/components/ui/PageHeading";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Mis palas favoritas",
  description: "Las palas de pádel que has guardado en este navegador, con su precio de hoy.",
  path: routes.favorites,
  // Es una página personal: su contenido depende de cada navegador.
  index: false,
});

export default function FavoritesPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Favoritas", href: routes.favorites },
        ]}
      />
      <div className="mx-auto max-w-[1280px] pb-12 lg:pb-20">
        <PageHeading
          title="Mis palas favoritas"
          lead="Las palas que has guardado en este navegador, con su precio de hoy y lo que ha cambiado desde que las guardaste."
        />
        <div className="px-5 pt-6 lg:px-12 lg:pt-8">
          <FavoritesList />
        </div>
      </div>
    </>
  );
}
