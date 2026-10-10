import Image from "next/image";
import { cn } from "@/lib/cn";
import { isProductPhoto } from "@/lib/media";

interface PalaPhotoProps {
  src: string | null;
  alt: string;
  /** Tamaño y radio del marco */
  className?: string;
  sizes?: string;
  /** Texto del placeholder mientras no haya foto */
  placeholderLabel?: string;
  /** contain: producto entero con aire alrededor · cover: imagen editorial a sangre */
  fit?: "contain" | "cover";
  /** Sustituye el encaje por defecto de la imagen (p. ej. distinto en móvil y escritorio) */
  imageClassName?: string;
  /** Carga prioritaria: solo para la imagen principal visible al abrir la página */
  priority?: boolean;
}

// Foto real: entera, sin deformar y con algo más de aire que una ilustración. El
// fondo blanco de la foto de catálogo se funde con el del marco (multiply), así
// la pala se ve como producto y no como un recuadro blanco.
const PHOTO_FIT = "object-contain p-[7%] mix-blend-multiply";
const ILLUSTRATION_FIT = "object-contain p-[4%]";

function defaultFit(src: string, fit: "contain" | "cover"): string {
  if (fit === "cover") return "object-cover";
  return isProductPhoto(src) ? PHOTO_FIT : ILLUSTRATION_FIT;
}

/**
 * Imagen de una pala: su foto real publicada o, si no la tiene, su ilustración
 * (la elige la capa de datos, ver lib/media.ts). Sin imagen muestra el
 * placeholder rayado del diseño. El marco fija el tamaño, así que no hay saltos
 * de maquetación al cargar.
 */
export function PalaPhoto({
  src,
  alt,
  className,
  sizes = "(min-width: 1024px) 25vw, 50vw",
  placeholderLabel,
  fit = "contain",
  imageClassName,
  priority = false,
}: PalaPhotoProps) {
  return (
    <div
      className={cn("relative overflow-hidden", src ? "bg-mist" : "photo-placeholder", className)}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={imageClassName ?? defaultFit(src, fit)}
        />
      ) : (
        placeholderLabel && (
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center px-3 text-center font-mono text-xs font-medium text-[#8a8f86]"
          >
            {placeholderLabel}
          </span>
        )
      )}
    </div>
  );
}
