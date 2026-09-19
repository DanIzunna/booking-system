import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="mt-12 w-full border-t border-slate-300/80 bg-white/45 pt-6 text-xs text-slate-400 sm:mt-16 sm:pt-7">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-6 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:pb-7">
        <div>
          <Link
            className="font-semibold tracking-tight text-slate-700"
            href="/"
          >
            Bookable
          </Link>
          <p className="mt-1 text-slate-400">Make anything bookable</p>
        </div>
        <p>© {new Date().getFullYear()} Bookable</p>
      </div>
    </footer>
  );
}
