import type { ReactNode } from "react";
import { OperatorShell } from "./operator-shell";

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <OperatorShell>
      <div className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </div>
    </OperatorShell>
  );
}
