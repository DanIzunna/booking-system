"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ImageIcon,
  RotateCcw,
  SquareArrowOutUpRight,
  Users,
} from "lucide-react";
import { useState } from "react";
import { restoreBookable } from "../../lib/api/bookables";
import { formatMoneyMinorUnits } from "../../lib/currency";
import type { Bookable } from "../../types/bookables";
import { BookableStatus } from "./bookable-status";

export function BookableRow({
  organizationId,
  organizationSlug,
  bookable,
}: {
  organizationId: string;
  organizationSlug: string;
  bookable: Bookable;
}) {
  const [restoring, setRestoring] = useState(false);
  const statusText =
    bookable.status === "PUBLISHED"
      ? "Publicly bookable"
      : bookable.status === "DRAFT"
        ? "Not published"
        : "Not publicly bookable";
  const priceText =
    bookable.pricingType === "FREE"
      ? "Free"
      : formatMoneyMinorUnits(bookable.price, bookable.currency);

  async function handleRestore() {
    setRestoring(true);
    try {
      await restoreBookable(bookable.id);
      window.location.reload();
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white first:border-t-0 transition-colors hover:bg-slate-50/80">
      <div className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,2.4fr)_170px_150px_140px_180px] md:items-center md:px-4">
        <Link
          href={`/organizations/${organizationId}/bookables/${bookable.id}`}
          className="group min-w-0 rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          <div className="flex items-start gap-3">
            <div className="relative hidden h-14 w-20 shrink-0 overflow-hidden rounded-[8px] border border-slate-200 bg-slate-100 sm:block">
              {bookable.imageUrl ? (
                <Image
                  src={bookable.imageUrl}
                  alt={bookable.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.8),_transparent_55%),linear-gradient(135deg,#f8fafc,#e2e8f0)] text-slate-500">
                  <ImageIcon className="size-4" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
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
          </div>
        </Link>

        <div className="text-sm text-slate-600 md:pl-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400 md:hidden">
            Status
          </div>
          <div className="mt-1 md:mt-0">{statusText}</div>
        </div>

        <div className="text-sm text-slate-600 md:pl-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400 md:hidden">
            Capacity
          </div>
          <div className="mt-1 md:mt-0">Capacity · {bookable.capacity}</div>
        </div>

        <div className="text-sm font-medium text-slate-800 md:pl-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400 md:hidden">
            Price
          </div>
          <div className="mt-1 md:mt-0">{priceText}</div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 md:justify-start">
          {bookable.status === "ARCHIVED" ? (
            <button
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-amber-200 bg-white px-2.5 py-2 text-xs font-medium text-amber-800 transition-colors hover:border-amber-300 hover:bg-amber-50"
              type="button"
              onClick={() => void handleRestore()}
              disabled={restoring}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {restoring ? "Restoring..." : "Restore"}
            </button>
          ) : null}
          <Link
            className="inline-flex items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            href={`/organizations/${organizationId}/bookables/${bookable.id}`}
          >
            View
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
          {bookable.status === "PUBLISHED" ? (
            <a
              className="inline-flex items-center gap-2 rounded-[6px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100"
              href={`/book/${organizationSlug}/${bookable.slug}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open public booking page for ${bookable.name}`}
            >
              <SquareArrowOutUpRight className="size-3.5" aria-hidden="true" />
              Open
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
