import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-10 w-full rounded-[6px] border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
        className,
      )}
      {...props}
    />
  );
}
