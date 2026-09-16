import Link from "next/link";

export function SiteFooter() {
  return <footer className="border-t border-zinc-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 text-[13px] text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><div><Link href="/" className="font-semibold text-zinc-950">Bookable</Link><p className="mt-1">Make anything bookable</p></div><nav className="flex flex-wrap gap-5"><a href="#how-it-works">How it works</a><a href="#organizations">For organizations</a><a href="#customers">For customers</a></nav><p>© {new Date().getFullYear()} Bookable</p></div></footer>;
}
