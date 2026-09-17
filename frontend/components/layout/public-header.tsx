"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "../../lib/auth/session-provider";
import { ProfileMenu } from "./profile-menu";

export function PublicHeader() {
  const pathname = usePathname();
  const { status, user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const authenticated = status === "authenticated" && user;

  return (
    <nav className="border-b border-zinc-200 bg-white">
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
        <div className="hidden items-center gap-3 text-[13px] font-medium text-zinc-600 md:flex">
          {!authenticated && (
            <>
              <a href="#how-it-works">How it works</a>
              <a href="#organizations">For organizations</a>
              <a href="#customers">For customers</a>
            </>
          )}
          {authenticated && (
            <>
              <Link
                className={navClass(pathname === "/dashboard")}
                href="/dashboard"
              >
                Dashboard
              </Link>
              <span className="border-l border-zinc-200 pl-3">
                <ProfileMenu user={user} logout={logout} />
              </span>
            </>
          )}
        </div>
        {!authenticated && (
          <div className="hidden items-center gap-2 md:flex">
            <Link
              className="rounded-full px-3 py-2 text-[13px] font-semibold text-zinc-600"
              href="/login"
            >
              Sign in
            </Link>
            <Link
              className="rounded-full bg-zinc-950 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-zinc-800"
              href="/register"
            >
              Get started
            </Link>
          </div>
        )}
        <button
          className="rounded-md p-2 text-zinc-700 md:hidden"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open ? "true" : "false"}
          onClick={() => setOpen(!open)}
        >
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="border-t border-zinc-200 px-4 py-3 md:hidden">
          {authenticated ? (
            <>
              <Link
                className="block py-2 text-sm font-medium"
                href="/dashboard"
                onClick={() => setOpen(false)}
              >
                Dashboard
              </Link>
              <div className="mt-2 border-t border-zinc-200 pt-3">
                <ProfileMenu user={user} logout={logout} mobile />
              </div>
            </>
          ) : (
            <>
              <a
                className="block py-2 text-sm font-medium"
                href="#how-it-works"
                onClick={() => setOpen(false)}
              >
                How it works
              </a>
              <Link
                className="block py-2 text-sm font-medium"
                href="/login"
                onClick={() => setOpen(false)}
              >
                Sign in
              </Link>
              <Link
                className="mt-2 block rounded-full bg-zinc-950 px-3 py-2.5 text-center text-sm font-semibold text-white"
                href="/register"
                onClick={() => setOpen(false)}
              >
                Get started
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

function navClass(active: boolean) {
  return `rounded-full px-3 py-2 font-semibold ${active ? "bg-zinc-100 text-zinc-950" : "hover:bg-zinc-50 hover:text-zinc-950"}`;
}
