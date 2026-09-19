"use client";

import Link from "next/link";
import { ArrowRight, RotateCcw, SquareArrowOutUpRight } from "lucide-react";
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
    <div className="border-t border-slate-200 bg-white first:border-t-0">
      <div className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,2.4fr)_170px_150px_140px_180px] md:items-center md:px-4">
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
            className="inline-flex items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
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
