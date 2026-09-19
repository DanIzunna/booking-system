import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  const variantClass =
    variant === "primary"
      ? "border border-indigo-500 bg-indigo-500 text-white hover:border-indigo-600 hover:bg-indigo-600"
      : variant === "secondary"
        ? "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50"
        : variant === "ghost"
          ? "border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100";
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-[6px] px-4 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50",
        variantClass,
        className,
      )}
      {...props}
    />
  );
}
