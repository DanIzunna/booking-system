import type { ReactNode } from "react";
import { AppHeader } from "./app-header";

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-slate-50 text-slate-950"><AppHeader /><main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main></div>;
}