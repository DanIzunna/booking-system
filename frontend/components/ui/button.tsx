import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const variantClass = variant === "primary" ? "rounded-full bg-zinc-950 text-white hover:bg-zinc-800" : variant === "secondary" ? "rounded-full border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50" : variant === "ghost" ? "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950" : "rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100";
  return <button className={cn("inline-flex min-h-10 items-center justify-center gap-2 px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-wait disabled:opacity-50", variantClass, className)} {...props} />;
}