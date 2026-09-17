"use client";

import {
  ChevronDown,
  LogOut,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import type { AuthenticatedUser } from "../../types/auth";

interface ProfileMenuProps {
  user: AuthenticatedUser | null;
  logout: () => Promise<void>;
  mobile?: boolean;
}

export function ProfileMenu({ user, logout, mobile = false }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  async function confirmLogout() {
    setLogoutConfirmOpen(false);
    setOpen(false);
    await logout();
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
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700">
            <UserRound className="size-4" />
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
          <div className="px-2 pb-2 pt-1">
            <div className="text-sm font-semibold text-slate-900">
              {user?.name ?? "Account"}
            </div>
            <div className="mt-1 truncate text-xs text-slate-500">
              {user?.email ?? ""}
            </div>
          </div>
          <button
            type="button"
            className="flex min-h-10 w-full items-center gap-2 rounded-[6px] px-2.5 text-left text-sm text-slate-500"
            disabled
            aria-disabled="true"
            role="menuitem"
            title="Settings is not available yet"
          >
            <Settings className="size-4" />
            Settings
            <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-slate-400">
              Soon
            </span>
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
            Log out
          </button>
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
            <p id="logout-dialog-title" className="pr-8 text-base font-semibold text-slate-900">
              Log out of Bookable?
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
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
