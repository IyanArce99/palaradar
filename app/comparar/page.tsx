import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { PageHeading } from "@/components/ui/PageHeading";
import { routes } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Comparador de palas de pádel",
  description:
    "Compara dos palas de pádel cara a cara: sensaciones, nivel recomendado, opiniones y mejor precio.",
  path: routes.compare,
  index: false,
});

export default function ComparePage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Comparar", href: routes.compare },
        ]}
      />
      <div className="mx-auto max-w-[1280px] pb-10 lg:pb-[72px]">
        <PageHeading
          title="Comparar palas"
          lead="¿Dudas entre dos? Aquí podrás ponerlas cara a cara: cómo se sienten, para quién es cada una y cuál está a mejor precio."
        />
        <div className="px-5 pt-6 lg:px-12 lg:pt-8">
          <ComingSoon>
            El comparador todavía no está disponible. Mientras tanto, en cada ficha encontrarás
            las alternativas que más se comparan con esa pala.
          </ComingSoon>
        </div>
      </div>
    </>
  );
}
