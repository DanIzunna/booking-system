import Link from "next/link";

export function PublicHeader({ context }: { context: string }) {
  return (
    <header className="w-full border-y border-slate-200 bg-white/90">
      <div className="mx-auto flex min-h-16 w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:min-h-[4.5rem] sm:px-6 sm:py-4">
        <Link
          className="inline-flex min-h-10 min-w-0 items-center gap-2.5 text-[15px] font-semibold tracking-tight text-slate-950"
          href="/"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-[6px] bg-zinc-950 text-xs font-bold text-white shadow-sm">
            B
          </span>
          <span className="truncate">Bookable</span>
        </Link>
        <span className="inline-flex min-h-8 items-center rounded-[5px] border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-medium text-slate-500 sm:px-3 sm:text-xs">
          {context}
        </span>
      </div>
    </header>
  );
}
