import Form from "next/form";
import { buttonClass } from "@/components/ui/Button";
import { SearchIcon } from "@/components/ui/icons";
import { PARAMS } from "@/lib/catalog/query";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";

const VARIANTS = {
  header: "h-11 gap-2.5 bg-mist px-3.5 text-sm text-muted",
  page: "h-[50px] gap-2.5 border-2 border-carbon bg-white px-4 text-base",
  hero: "h-[58px] gap-2.5 border-2 border-carbon bg-white px-[18px] text-base lg:h-[68px] lg:gap-3 lg:pr-2 lg:pl-6 lg:text-lg",
} as const;

interface SearchFormProps {
  variant: keyof typeof VARIANTS;
  id?: string;
  defaultValue?: string;
  className?: string;
}

/** Buscador: envía la consulta al catálogo (?q=) y funciona sin JavaScript. */
export function SearchForm({ variant, id, defaultValue, className }: SearchFormProps) {
  return (
    <Form
      id={id}
      action={routes.catalog}
      role="search"
      className={cn("flex items-center rounded-full", VARIANTS[variant], className)}
    >
      <SearchIcon className="shrink-0" />
      <input
        type="search"
        name={PARAMS.q}
        defaultValue={defaultValue}
        placeholder="Busca una pala, marca o modelo…"
        aria-label="Buscar palas por marca o modelo"
        className="min-w-0 flex-1 bg-transparent text-carbon outline-none placeholder:text-muted"
      />
      {variant === "hero" && (
        <span className="hidden lg:block">
          <button type="submit" className={buttonClass({ variant: "dark", pill: true })}>
            Buscar
          </button>
        </span>
      )}
    </Form>
  );
}
