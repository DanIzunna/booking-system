"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "../../lib/auth/session-provider";
import { AppSidebar } from "./app-sidebar";
import { ProfileMenu } from "./profile-menu";

const SIDEBAR_COLLAPSE_KEY = "bookable-sidebar-collapsed";

export function OperatorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "true";
  });
  const organizationId = pathname.match(/^\/organizations\/([^/]+)/)?.[1];

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="flex h-[52px] items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        <Link
          className="flex min-w-0 items-center gap-2 text-[13px] font-semibold tracking-tight text-slate-950"
          href="/"
        >
          <span className="grid size-7 place-items-center rounded-[6px] bg-zinc-950 text-xs font-bold text-white">
            B
          </span>
          <span className="truncate">Bookable</span>
        </Link>
        <button
          className="grid size-10 place-items-center rounded-[6px] text-slate-700 hover:bg-slate-100 md:hidden"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen ? "true" : "false"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          <Menu className="size-5" />
        </button>
        <div className="hidden items-center gap-2 md:flex">
          <ProfileMenu user={user} logout={logout} />
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-52px)]">
        <div className="hidden md:block">
          <AppSidebar
            organizationId={organizationId}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
          />
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
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="grid size-7 place-items-center rounded-[6px] bg-zinc-950 text-xs font-bold text-white">
                  B
                </span>
                Bookable
              </div>
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
            <div className="border-t border-slate-200 p-3">
              <ProfileMenu user={user} logout={logout} mobile />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
