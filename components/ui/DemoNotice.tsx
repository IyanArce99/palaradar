import { isDemoData } from "@/data";
import { cn } from "@/lib/cn";

interface DemoNoticeProps {
  children: React.ReactNode;
  className?: string;
}

/** Aviso de datos de ejemplo. Deja de mostrarse al conectar datos reales. */
export function DemoNotice({ children, className }: DemoNoticeProps) {
  if (!isDemoData) return null;

  return <p className={cn("text-xs text-muted", className)}>{children}</p>;
}
