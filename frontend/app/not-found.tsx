"use client";

import Link from "next/link";
import { ArrowLeft, Home, SearchX } from "lucide-react";
import { useRouter } from "next/navigation";
import { PublicHeader } from "../components/layout/public-header";

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <PublicHeader />
      <section className="mx-auto flex max-w-3xl flex-1 items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full rounded-[20px] border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-8 lg:p-10">
          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span className="grid size-9 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-700">
              <SearchX className="size-4" aria-hidden="true" />
            </span>
            Bookable
          </div>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Page not found
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
            The page you are looking for doesn&apos;t exist or may have moved.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-[6px] bg-indigo-500 px-4 text-sm font-medium text-white hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-2"
            >
              <Home className="size-4" aria-hidden="true" />
              Go to home
            </Link>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex min-h-11 items-center gap-2 rounded-[6px] border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Go back
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
