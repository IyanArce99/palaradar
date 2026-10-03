import { cn } from "@/lib/cn";

interface PageHeadingProps {
  title: string;
  lead?: React.ReactNode;
  className?: string;
}

/** Cabecera de página de listado: h1 + entradilla. */
export function PageHeading({ title, lead, className }: PageHeadingProps) {
  return (
    <header className={cn("px-5 pt-1 lg:px-12 lg:pt-3", className)}>
      <h1 className="text-[32px] leading-none font-black tracking-[-0.035em] text-balance lg:text-[52px]">
        {title}
      </h1>
      {lead && (
        <p className="mt-2 max-w-[720px] text-sm leading-[1.45] text-pretty text-muted lg:mt-3 lg:text-[17px] lg:leading-[1.6] lg:text-ink">
          {lead}
        </p>
      )}
    </header>
  );
}
