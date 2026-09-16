"use client";

import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WorkspaceSwitcher } from "./workspace-switcher";

interface AppSidebarProps {
  organizationId?: string;
  onNavigate?: () => void;
}

export function AppSidebar({ organizationId, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const items = organizationId
    ? [
        {
          label: "Overview",
          href: `/organizations/${organizationId}`,
          icon: LayoutDashboard,
        },
        {
          label: "Bookables",
          href: `/organizations/${organizationId}/bookables`,
          icon: ClipboardList,
        },
      ]
    : [{ label: "Overview", href: "/dashboard", icon: LayoutDashboard }];

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4">
      <div className="mb-5 px-1">
        <WorkspaceSwitcher
          organizationId={organizationId}
          onNavigate={onNavigate}
        />
      </div>
      <nav className="space-y-1" aria-label="Workspace navigation">
        {items.map(({ label, href, icon: Icon }) => (
          <Link
            className={navClass(
              pathname === href ||
                (label === "Bookables" && pathname.includes("/bookables")),
            )}
            href={href}
            key={href}
            onClick={onNavigate}
          >
            <Icon className="size-4" />
            {label}
            <ChevronRight className="ml-auto size-3.5 opacity-50" />
          </Link>
        ))}
        {organizationId && (
          <>
            <span className="mt-6 block px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
              Coming later
            </span>
            <span className="flex min-h-10 items-center gap-3 rounded-[6px] px-3 text-[13px] text-slate-400">
              <CalendarDays className="size-4" /> Schedule
            </span>
            <span className="flex min-h-10 items-center gap-3 rounded-[6px] px-3 text-[13px] text-slate-400">
              <ClipboardList className="size-4" /> Reservations
            </span>
            <span className="flex min-h-10 items-center gap-3 rounded-[6px] px-3 text-[13px] text-slate-400">
              <Settings2 className="size-4" /> Settings
            </span>
          </>
        )}
      </nav>
    </aside>
  );
}

function navClass(active: boolean) {
  return `flex min-h-10 items-center gap-3 rounded-[6px] px-3 text-[13px] font-medium ${active ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`;
}
