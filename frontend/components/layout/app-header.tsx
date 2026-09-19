"use client";

import Link from "next/link";
import {
  Check,
  ChevronDown,
  LogOut,
  Menu,
  Plus,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listOrganizations } from "../../lib/api/organizations";
import { useSession } from "../../lib/auth/session-provider";
import type { OrganizationSummary } from "../../types/organizations";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const organizationId = pathname.match(/^\/organizations\/([^/]+)/)?.[1];

  useEffect(() => {
    void listOrganizations()
      .then(setOrganizations)
      .catch(() => setOrganizations([]));
  }, []);

  const current = organizations.find(({ id }) => id === organizationId);

  async function confirmLogout() {
    setLogoutConfirmOpen(false);
    setProfileOpen(false);
    await logout();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 text-sm font-bold tracking-tight text-zinc-950"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-zinc-950 text-white">
            B
          </span>
          <span className="truncate">Bookable</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <Link
            className={navClass(pathname === "/dashboard")}
            href="/dashboard"
          >
            Dashboard
          </Link>
          {organizationId && (
            <Link
              className={navClass(pathname.includes("/organizations/"))}
              href={`/organizations/${organizationId}`}
            >
              Workspace
            </Link>
          )}
          <div className="relative ml-3 border-l border-zinc-200 pl-3">
            <button
              className="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-2 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50"
              onClick={() => setSwitcherOpen(!switcherOpen)}
              aria-expanded={switcherOpen}
            >
              <span className="max-w-36 truncate">
                {current?.name ?? "Workspaces"}
              </span>
              <ChevronDown className="size-3.5" />
            </button>
            {switcherOpen && (
              <div className="absolute right-0 top-12 w-64 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg shadow-zinc-200/50">
                <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                  Your workspaces
                </p>
                {organizations.map((organization) => (
                  <button
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm hover:bg-zinc-50"
                    key={organization.id}
                    onClick={() => {
                      setSwitcherOpen(false);
                      router.push(`/organizations/${organization.id}`);
                    }}
                  >
                    <span>
                      <strong className="block font-semibold text-zinc-900">
                        {organization.name}
                      </strong>
                      <small className="text-xs text-zinc-500">
                        {organization.role}
                      </small>
                    </span>
                    {organization.id === organizationId && (
                      <Check className="size-4 text-zinc-950" />
                    )}
                  </button>
                ))}
                <button
                  className="mt-1 flex w-full items-center gap-2 border-t border-zinc-100 px-3 py-3 text-sm font-semibold text-zinc-700"
                  onClick={() => {
                    setSwitcherOpen(false);
                    router.push("/dashboard");
                  }}
                >
                  <Plus className="size-4" /> Create workspace
                </button>
              </div>
            )}
          </div>
          <div className="relative ml-2">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-2 text-[13px] font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
              aria-expanded={profileOpen}
              aria-label="Open profile menu"
              onClick={() => setProfileOpen((value) => !value)}
            >
              <span className="grid size-7 place-items-center rounded-full bg-zinc-100 text-zinc-700">
                <UserRound className="size-4" />
              </span>
              <span className="hidden lg:inline">
                {user?.name ?? "Profile"}
              </span>
              <ChevronDown className="size-3.5 text-zinc-500" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg shadow-zinc-200/50">
                <div className="px-2 pb-2 pt-1">
                  <div className="text-sm font-semibold text-zinc-900">
                    {user?.name ?? "Account"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {user?.email ?? ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-zinc-500"
                  disabled
                  aria-disabled="true"
                  title="Settings is not available yet"
                >
                  <Settings className="size-4" />
                  Settings
                </button>
                <button
                  type="button"
                  className="mt-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
                  onClick={() => {
                    setProfileOpen(false);
                    setLogoutConfirmOpen(true);
                  }}
                >
                  <LogOut className="size-4" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </nav>
        <button
          className="rounded-md p-2 text-zinc-700 md:hidden"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            className="absolute inset-0 bg-zinc-950/20"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-[min(84vw,280px)] bg-white shadow-xl">
            <div className="flex h-[52px] items-center justify-between border-b border-zinc-200 px-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <span className="grid size-7 place-items-center rounded-lg bg-zinc-950 text-xs font-bold text-white">
                  B
                </span>
                Bookable
              </div>
              <button
                className="grid size-10 place-items-center rounded-[6px] hover:bg-zinc-100"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="px-4 py-3">
              <Link
                className="block py-2 text-sm font-medium"
                href="/dashboard"
                onClick={() => setOpen(false)}
              >
                Dashboard
              </Link>
              {organizationId && (
                <Link
                  className="block py-2 text-sm font-medium"
                  href={`/organizations/${organizationId}`}
                  onClick={() => setOpen(false)}
                >
                  Workspace
                </Link>
              )}
              <p className="mt-3 border-t border-zinc-100 pt-3 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
                Workspaces
              </p>
              {organizations.map((organization) => (
                <Link
                  className="block py-2 text-sm"
                  href={`/organizations/${organization.id}`}
                  key={organization.id}
                  onClick={() => setOpen(false)}
                >
                  {organization.name}
                </Link>
              ))}
              <div className="mt-4 rounded-[10px] border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-sm font-semibold text-zinc-900">
                  {user?.name ?? "Account"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {user?.email ?? ""}
                </div>
              </div>
              <button
                type="button"
                className="mt-3 flex w-full items-center gap-2 rounded-[6px] border border-zinc-200 bg-white px-3 py-2 text-left text-sm text-zinc-500"
                disabled
                aria-disabled="true"
              >
                <Settings className="size-4" />
                Settings
              </button>
              <button
                className="mt-3 flex items-center gap-2 rounded-[6px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
                onClick={() => {
                  setOpen(false);
                  setLogoutConfirmOpen(true);
                }}
              >
                <LogOut className="size-4" /> Log out
              </button>
            </nav>
          </div>
        </div>
      )}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/30 p-4">
          <div className="w-full max-w-md rounded-[12px] border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/80">
            <p className="text-base font-semibold text-zinc-900">
              Log out of Bookable?
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Signing out will end your current session. You can sign back in at
              any time.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="min-h-10 rounded-[6px] border border-zinc-300 bg-white px-4 text-[13px] font-medium text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
                onClick={() => setLogoutConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="min-h-10 rounded-[6px] border border-rose-200 bg-rose-600 px-4 text-[13px] font-medium text-white hover:bg-rose-500"
                onClick={() => void confirmLogout()}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function navClass(active: boolean) {
  return `rounded-full px-3 py-2 text-[13px] font-semibold ${active ? "bg-zinc-100 text-zinc-950" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"}`;
}
