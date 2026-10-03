import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const VARIANTS = {
  lime: "bg-lime text-carbon",
  dark: "bg-carbon text-white",
  outline: "border-[1.5px] border-carbon bg-white text-carbon",
  soft: "border-[1.5px] border-line bg-white text-carbon",
  inverse: "border-[1.5px] border-white/35 text-white",
} as const;

const SIZES = {
  sm: "h-11 px-3.5 text-[13px] font-bold",
  nav: "h-11 px-4 text-base font-extrabold",
  md: "h-12 px-5 text-[15px] font-extrabold",
  lg: "h-[54px] px-5 text-[15px] font-extrabold",
} as const;

interface ButtonStyle {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Bordes completamente redondeados (CTA de escáner, buscador) */
  pill?: boolean;
  className?: string;
}

export function buttonClass({ variant = "lime", size = "md", pill = false, className }: ButtonStyle) {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    pill ? "rounded-full" : "rounded-[14px]",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type ButtonLinkProps = ButtonStyle & Omit<ComponentProps<typeof Link>, "className">;

export function ButtonLink({ variant, size, pill, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, size, pill, className })} {...props} />;
}
