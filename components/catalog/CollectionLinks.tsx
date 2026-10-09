import Link from "next/link";
import { COLLECTION_GROUPS, collections, type Collection } from "@/content/collections";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";

const pillClass = "flex h-11 items-center rounded-full border border-line px-4 text-sm font-bold hover:bg-mist lg:h-10";

interface CollectionLinksProps {
  /** id del titular, para etiquetar la navegación */
  id: string;
  title: string;
  /** Colecciones que se enlazan; por defecto, todas, agrupadas */
  items?: Collection[];
  className?: string;
}

/** Enlaces a las colecciones del catálogo (/palas-padel/[colección]/): por forma, juego, nivel y precio. */
export function CollectionLinks({ id, title, items, className }: CollectionLinksProps) {
  const groups = Object.entries(COLLECTION_GROUPS) as [Collection["group"], string][];
  if (items?.length === 0) return null;

  return (
    <nav aria-labelledby={id} className={className}>
      <h2 id={id} className="mb-3 text-[15px] font-extrabold">
        {title}
      </h2>
      {items ? (
        <ul className="flex flex-wrap gap-2">
          {items.map((collection) => (
            <li key={collection.slug}>
              <Link href={routes.collection(collection.slug)} className={pillClass}>
                {collection.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {groups.flatMap(([group]) =>
            collections
              .filter((collection) => collection.group === group)
              .map((collection) => (
                <li key={collection.slug}>
                  <Link href={routes.collection(collection.slug)} className={cn(pillClass)}>
                    {collection.label}
                  </Link>
                </li>
              )),
          )}
        </ul>
      )}
    </nav>
  );
}
