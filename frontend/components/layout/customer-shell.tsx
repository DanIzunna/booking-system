"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "../../lib/auth/session-provider";
import { ProfileMenu } from "./profile-menu";

export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useSession();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[52px] max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            className="flex min-w-0 items-center gap-2 text-[13px] font-semibold tracking-tight text-slate-950"
            href="/"
          >
            <span className="grid size-7 place-items-center rounded-[6px] bg-zinc-950 text-xs font-bold text-white">
              B
            </span>
            <span className="truncate">Bookable</span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Account navigation">
            <Link
              className={`rounded-[6px] px-3 py-2 text-[13px] font-medium ${
                pathname.startsWith("/reservations")
                  ? "bg-slate-100 text-slate-950"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
              href="/reservations"
            >
              Reservations
            </Link>
            <ProfileMenu user={user} logout={logout} />
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

export function CustomerContainer({ children }: { children: ReactNode }) {
  return (
    <CustomerShell>
      <div className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </div>
    </CustomerShell>
  );
}