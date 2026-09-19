"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCcw } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-950">
      <section className="w-full max-w-lg rounded-[20px] border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-8">
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
          <span className="grid size-9 place-items-center rounded-full border border-amber-200 bg-amber-50 text-amber-700">
            <AlertTriangle className="size-4" aria-hidden="true" />
          </span>
          Something went wrong
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
          We hit an unexpected error
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Please try again. If the problem continues, return to the home page and
          retry from there.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-11 items-center gap-2 rounded-[6px] bg-indigo-500 px-4 text-sm font-medium text-white hover:bg-indigo-600"
          >
            <RefreshCcw className="size-4" aria-hidden="true" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-[6px] border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
