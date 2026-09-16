"use client";

import { LogOut, Menu, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useSession } from "../../lib/auth/session-provider";
import { AppSidebar } from "./app-sidebar";
import { Button } from "../ui/button";

export function OperatorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const organizationId = pathname.match(/^\/organizations\/([^/]+)/)?.[1];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="flex h-[52px] items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            className="grid size-10 place-items-center rounded-[6px] text-slate-700 hover:bg-slate-100 md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <Link
            className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-slate-950"
            href="/"
          >
            <span className="grid size-7 place-items-center rounded-[6px] bg-zinc-950 text-xs font-bold text-white">
              B
            </span>{" "}
            Bookable
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 text-[13px] text-slate-600 sm:flex">
            <UserRound className="size-4" />
            {user?.name}
          </span>
          <Button
            variant="ghost"
            className="min-h-10 px-2"
            aria-label="Sign out"
            onClick={() => void logout()}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-52px)]">
        <div className="hidden md:block">
          <AppSidebar organizationId={organizationId} />
        </div>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            className="absolute inset-0 bg-slate-950/20"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-[min(84vw,280px)] bg-white shadow-xl">
            <div className="flex h-[52px] items-center justify-between border-b border-slate-200 px-4">
              <span className="text-sm font-semibold">Navigation</span>
              <button
                className="grid size-10 place-items-center rounded-[6px] hover:bg-slate-100"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>
            <AppSidebar
              organizationId={organizationId}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
