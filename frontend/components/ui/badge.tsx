import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type BadgeVariant = "neutral" | "success" | "warning" | "error";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  const variantClass =
    variant === "success"
      ? "border-green-200 bg-green-50 text-green-700"
      : variant === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : variant === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-slate-200 bg-slate-100 text-slate-600";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[4px] border px-2 py-1 text-[11px] font-medium leading-4",
        variantClass,
        className,
      )}
      {...props}
    />
  );
}
