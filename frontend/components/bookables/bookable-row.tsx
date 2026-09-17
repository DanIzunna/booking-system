import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Bookable } from "../../types/bookables";
import { BookableStatus } from "./bookable-status";
import { PublicBookingLink } from "./public-booking-link";

export function BookableRow({ organizationId, bookable }: { organizationId: string; bookable: Bookable }) {
  return <div className="grid gap-4 border-b border-slate-200 py-4 lg:grid-cols-[minmax(180px,1fr)_110px_120px_minmax(220px,1.2fr)_auto] lg:items-center"><div className="min-w-0"><Link className="block truncate text-sm font-semibold text-slate-950 hover:text-slate-600" href={`/organizations/${organizationId}/bookables/${bookable.id}`}>{bookable.name}</Link><p className="mt-1 truncate text-xs text-slate-500">{bookable.description || bookable.slug}</p></div><div><BookableStatus status={bookable.status} /></div><p className="text-xs tabular-nums text-slate-600">Capacity {bookable.capacity}</p><PublicBookingLink slug={bookable.slug} enabled={bookable.status === "PUBLISHED"} /><Link className="inline-flex min-h-10 items-center gap-2 text-xs font-medium text-slate-700 hover:text-slate-950" href={`/organizations/${organizationId}/bookables/${bookable.id}`}>Open <ArrowRight className="size-3.5" /></Link></div>;
}
