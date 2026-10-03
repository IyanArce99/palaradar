import Image from "next/image";
import { cn } from "@/lib/cn";

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
}

/** Foto de producto. Sin imagen muestra el placeholder rayado del diseño. */
export function PalaPhoto({
  src,
  alt,
  className,
  sizes = "(min-width: 1024px) 25vw, 50vw",
  placeholderLabel,
  fit = "contain",
  imageClassName,
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
          className={
            imageClassName ?? (fit === "cover" ? "object-cover" : "object-contain p-[4%]")
          }
        />
      ) : (
        placeholderLabel && (
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center px-3 text-center font-mono text-[10px] font-medium text-[#8a8f86]"
          >
            {placeholderLabel}
          </span>
        )
      )}
    </div>
  );
}
