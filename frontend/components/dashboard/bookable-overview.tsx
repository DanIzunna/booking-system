import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ImageIcon, Users } from "lucide-react";
import type { Bookable } from "../../types/bookables";
import { BookableStatus } from "../bookables/bookable-status";

export function BookableOverview({
  organizationId,
  bookables,
}: {
  organizationId: string;
  bookables: Bookable[];
}) {
  const primaryImageUrl = (bookable: Bookable) =>
    bookable.images.find((image) => image.isPrimary)?.url ?? null;

  return (
    <div className="divide-y divide-slate-200 overflow-hidden rounded-[12px] border border-slate-200 bg-white">
      {bookables.map((bookable) => (
        <Link
          key={bookable.id}
          href={`/organizations/${organizationId}/bookables/${bookable.id}`}
          className="group block transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          <div className="grid gap-3 p-3 sm:grid-cols-[86px_minmax(0,1fr)_auto] sm:items-center sm:p-4">
            <div className="relative aspect-[16/9] overflow-hidden rounded-[8px] border border-slate-200 bg-slate-100">
              {primaryImageUrl(bookable) ? (
                <Image
                  src={primaryImageUrl(bookable)!}
                  alt={bookable.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.8),_transparent_55%),linear-gradient(135deg,#f8fafc,#e2e8f0)] text-slate-500">
                  <ImageIcon className="size-5" aria-hidden="true" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-950">
                  {bookable.name}
                </span>
                <BookableStatus status={bookable.status} />
              </div>
              {bookable.description ? (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                  {bookable.description}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">No description</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                  <Users className="size-3 text-slate-500" aria-hidden="true" />
                  {bookable.capacity} guest{bookable.capacity === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-start sm:justify-end">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                Open
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
