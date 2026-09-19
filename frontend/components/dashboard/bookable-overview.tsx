import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import type { Bookable } from "../../types/bookables";
import { BookableStatus } from "../bookables/bookable-status";

export function BookableOverview({
  organizationId,
  bookables,
}: {
  organizationId: string;
  bookables: Bookable[];
}) {
  return (
    <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
      {bookables.map((bookable) => (
        <div
          key={bookable.id}
          className="grid gap-3 py-3 md:grid-cols-[minmax(0,2.2fr)_150px_96px] md:items-center"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="truncate text-sm font-semibold text-slate-950 transition-colors hover:text-slate-700"
                href={`/organizations/${organizationId}/bookables/${bookable.id}`}
              >
                {bookable.name}
              </Link>
              <BookableStatus status={bookable.status} />
            </div>
            {bookable.description ? (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                {bookable.description}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">No description</p>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Users className="size-3.5 text-slate-400" aria-hidden="true" />
            <span>
              {bookable.capacity} guest{bookable.capacity === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex justify-start md:justify-end">
            <Link
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 transition-colors hover:text-slate-950"
              href={`/organizations/${organizationId}/bookables/${bookable.id}`}
            >
              Open
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
