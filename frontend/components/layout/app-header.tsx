"use client";

import Link from "next/link";
import {
  ChevronDown,
  Check,
  LogOut,
  Menu,
  Plus,
  UserRound,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listOrganizations } from "../../lib/api/organizations";
import { useSession } from "../../lib/auth/session-provider";
import type { OrganizationSummary } from "../../types/organizations";
import { Button } from "../ui/button";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const organizationId = pathname.match(/^\/organizations\/([^/]+)/)?.[1];

  useEffect(() => {
    void listOrganizations()
      .then(setOrganizations)
      .catch(() => setOrganizations([]));
  }, []);

  const current = organizations.find(({ id }) => id === organizationId);

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-bold tracking-tight text-zinc-950"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-zinc-950 text-white">
            B
          </span>{" "}
          Bookable
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
          <span className="ml-2 flex items-center gap-2 border-l border-zinc-200 pl-4 text-[13px] text-zinc-600">
            <UserRound className="size-4" /> {user?.name}
          </span>
          <Button
            variant="ghost"
            className="min-h-9 px-2"
            aria-label="Sign out"
            onClick={() => void logout()}
          >
            <LogOut className="size-4" />
          </Button>
        </nav>
        <button
          className="rounded-md p-2 text-zinc-700 md:hidden"
          aria-label="Open navigation"
          onClick={() => setOpen(!open)}
        >
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <nav className="border-t border-zinc-200 px-4 py-3 md:hidden">
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
          <button
            className="flex items-center gap-2 py-2 text-sm font-medium text-red-700"
            onClick={() => void logout()}
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </nav>
      )}
    </header>
  );
}

function navClass(active: boolean) {
  return `rounded-full px-3 py-2 text-[13px] font-semibold ${active ? "bg-zinc-100 text-zinc-950" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"}`;
}
