import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Badge } from "../ui/badge";
import type { Bookable } from "../../types/bookables";

export function BookableOverview({
  organizationId,
  bookables,
}: {
  organizationId: string;
  bookables: Bookable[];
}) {
  return (
    <div className="divide-y divide-slate-200 border-y border-slate-200">
      {bookables.map((bookable) => (
        <Link
          className="group flex min-h-20 items-center justify-between gap-4 py-4"
          href={`/organizations/${organizationId}/bookables/${bookable.id}`}
          key={bookable.id}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-slate-950">
                {bookable.name}
              </h3>
              <Badge
                variant={
                  bookable.status === "PUBLISHED"
                    ? "success"
                    : bookable.status === "ARCHIVED"
                      ? "error"
                      : "neutral"
                }
              >
                {bookable.status}
              </Badge>
            </div>
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <CalendarDays className="size-3.5" /> Capacity {bookable.capacity}{" "}
              <span className="text-slate-300">·</span> {bookable.slug}
            </p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-slate-950" />
        </Link>
      ))}
    </div>
  );
}
