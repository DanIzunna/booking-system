"use client";

import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WorkspaceSwitcher } from "./workspace-switcher";

interface AppSidebarProps {
  organizationId?: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AppSidebar({
  organizationId,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: AppSidebarProps) {
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
        {
          label: "Reservations",
          href: `/organizations/${organizationId}/reservations`,
          icon: ClipboardList,
        },
      ]
    : [{ label: "Overview", href: "/dashboard", icon: LayoutDashboard }];

  return (
    <aside
      className={`flex h-full ${collapsed ? "w-16" : "w-[240px]"} shrink-0 flex-col border-r border-slate-200 bg-white px-2 py-4`}
    >
      <div
        className={`mb-4 flex items-center ${collapsed ? "justify-center" : "justify-between gap-2"}`}
      >
        {!collapsed && (
          <div className="min-w-0 flex-1 px-1">
            <WorkspaceSwitcher
              organizationId={organizationId}
              onNavigate={onNavigate}
            />
          </div>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            className={`grid place-items-center rounded-[6px] border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 ${collapsed ? "size-9" : "size-8"}`}
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        )}
      </div>
      <nav className="space-y-1" aria-label="Workspace navigation">
        {items.map(({ label, href, icon: Icon }) => {
          const active =
            pathname === href ||
            (label === "Bookables" && pathname.includes("/bookables")) ||
            (label === "Reservations" && pathname.startsWith(`${href}/`));

          return (
            <Link
              className={navClass(active, collapsed)}
              href={href}
              key={href}
              onClick={onNavigate}
              title={label}
              aria-label={label}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
              {!collapsed && (
                <ChevronRight className="ml-auto size-3.5 opacity-50" />
              )}
              {collapsed && <span className="sr-only">{label}</span>}
            </Link>
          );
        })}
        {organizationId && (
          <>
            {!collapsed && (
              <span className="mt-6 block px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                More soon
              </span>
            )}
            <span
              className={navClass(false, collapsed, true)}
              title="Schedule"
              aria-label="Schedule"
            >
              <CalendarDays className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">Schedule</span>}
              {collapsed && <span className="sr-only">Schedule</span>}
            </span>
            <Link
              className={navClass(
                pathname.startsWith(`/organizations/${organizationId}/settings`),
                collapsed,
              )}
              href={`/organizations/${organizationId}/settings/payments`}
              onClick={onNavigate}
              title="Settings"
              aria-label="Settings"
            >
              <Settings2 className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">Settings</span>}
              {!collapsed && (
                <ChevronRight className="ml-auto size-3.5 opacity-50" />
              )}
              {collapsed && <span className="sr-only">Settings</span>}
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
}

function navClass(active: boolean, collapsed: boolean, subdued = false) {
  return `flex min-h-10 items-center ${collapsed ? "justify-center px-0" : "gap-3 px-3"} rounded-[6px] text-[13px] font-medium ${
    active
      ? "bg-slate-100 text-slate-950"
      : subdued
        ? "text-slate-400"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
  }`;
}
