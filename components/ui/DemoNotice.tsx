import { hasTestPrices } from "@/data";
import { cn } from "@/lib/cn";

interface DemoNoticeProps {
  children: React.ReactNode;
  className?: string;
}

/** Aviso de precios de prueba. Deja de mostrarse cuando los precios son reales. */
export function DemoNotice({ children, className }: DemoNoticeProps) {
  if (!hasTestPrices) return null;

  return <p className={cn("text-xs text-muted", className)}>{children}</p>;
}
