import type { ReactNode } from "react";
import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";

export function PublicShell({
  children,
  context,
}: {
  children: ReactNode;
  context: string;
}) {
  return (
    <main className="flex min-h-screen flex-col overflow-x-hidden bg-slate-50 text-slate-950">
      <PublicHeader context={context} />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-6">
        <div className="min-w-0 flex-1 pt-8 lg:pt-10">{children}</div>
      </div>
      <PublicFooter />
    </main>
  );
}
