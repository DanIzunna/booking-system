"use client";

import { ChevronDown, LogOut, Settings, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AuthenticatedUser } from "../../types/auth";

interface ProfileMenuProps {
  user: AuthenticatedUser | null;
  logout: () => Promise<void>;
  role?: string | null;
  workspaceName?: string | null;
  mobile?: boolean;
  onSwitchWorkspace?: () => void;
}

export function ProfileMenu({
  user,
  logout,
  role,
  workspaceName,
  mobile = false,
  onSwitchWorkspace,
}: ProfileMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const initials =
    user?.name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U";

  async function confirmLogout() {
    setLogoutConfirmOpen(false);
    setOpen(false);
    await logout();
  }

  function handleSwitchWorkspace() {
    setOpen(false);
    onSwitchWorkspace?.();
    router.push("/dashboard");
  }

  return (
    <div className={`relative ${mobile ? "w-full" : ""}`}>
      <button
        type="button"
        className={
          mobile
            ? "flex min-h-11 w-full items-center justify-between rounded-[6px] border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            : "flex items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        }
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open profile menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
            {initials}
          </span>
          <span className={mobile ? "truncate" : "hidden truncate lg:inline"}>
            {user?.name ?? "Profile"}
          </span>
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-slate-500" />
      </button>
      {open && (
        <div
          className={`z-30 w-64 rounded-[10px] border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/80 ${mobile ? "absolute bottom-full left-0 mb-2" : "absolute right-0 top-12"}`}
          role="menu"
        >
          <div className="border-b border-slate-200 px-2 pb-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {initials}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {user?.name ?? "Account"}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {user?.email ?? ""}
                </div>
              </div>
            </div>
            {workspaceName && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-slate-500">
                  {workspaceName}
                </span>
                {role && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    {role === "OWNER" ? "Owner" : "Member"}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="mt-2 space-y-1">
            <Link
              href="/account"
              className="flex min-h-10 items-center gap-2 rounded-[6px] px-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <Settings className="size-4" />
              User Settings
            </Link>
            <button
              type="button"
              className="flex min-h-10 w-full items-center gap-2 rounded-[6px] px-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              role="menuitem"
              onClick={handleSwitchWorkspace}
            >
              <UserRound className="size-4" />
              Switch Workspace
            </button>
            <button
              type="button"
              className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-[6px] px-2.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setLogoutConfirmOpen(true);
              }}
            >
              <LogOut className="size-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4">
          <div
            className="relative w-full max-w-md rounded-[12px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
          >
            <button
              type="button"
              className="absolute right-3 top-3 grid size-8 place-items-center rounded-[6px] text-slate-500 hover:bg-slate-100 hover:text-slate-950"
              aria-label="Close logout confirmation"
              onClick={() => setLogoutConfirmOpen(false)}
            >
              <X className="size-4" />
            </button>
            <p
              id="logout-dialog-title"
              className="pr-8 text-base font-semibold text-slate-900"
            >
              Sign out of Bookable?
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              You&apos;ll need to sign in again to access your workspaces.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="min-h-10 rounded-[6px] border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                onClick={() => setLogoutConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="min-h-10 rounded-[6px] border border-rose-200 bg-rose-600 px-4 text-[13px] font-medium text-white hover:bg-rose-500"
                onClick={() => void confirmLogout()}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
