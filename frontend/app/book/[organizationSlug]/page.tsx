"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Search,
  Users,
} from "lucide-react";
import { use, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../../lib/api/client";
import {
  getPublicOrganization,
  type PublicOrganizationCatalog,
} from "../../../lib/api/public-booking";
import { formatMoneyMinorUnits } from "../../../lib/currency";
import { EmptyState } from "../../../components/empty-state";
import { PublicShell } from "../../../components/public/public-shell";

interface PublicOrganizationPageProps {
  params: Promise<{ organizationSlug: string }>;
}

export default function PublicOrganizationPage({
  params,
}: PublicOrganizationPageProps) {
  const { organizationSlug } = use(params);
  const [organization, setOrganization] =
    useState<PublicOrganizationCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getPublicOrganization(organizationSlug)
      .then((nextOrganization) => {
        if (!cancelled) setOrganization(nextOrganization);
      })
      .catch((caught) => {
        if (!cancelled) {
          setErrorStatus(caught instanceof ApiError ? caught.statusCode : 500);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationSlug]);

  const filteredBookables = useMemo(() => {
    if (!organization) return [];
    const query = search.trim().toLowerCase();
    if (!query) return organization.bookables;
    return organization.bookables.filter((bookable) => {
      const searchableText = [
        bookable.name,
        bookable.description ?? "",
        bookable.pricingType,
      ]
        .join(" ")
        .toLowerCase();
      return searchableText.includes(query);
    });
  }, [organization, search]);

  return (
    <PublicShell context="Public catalog">
      {loading ? (
        <CatalogLoadingState />
      ) : errorStatus !== null || !organization ? (
        <CatalogStatePanel
          title={
            errorStatus === 404
              ? "This organization is unavailable"
              : "We could not load this organization"
          }
          message={
            errorStatus === 404
              ? "Check the link and try again."
              : "Please try again shortly."
          }
        />
      ) : (
        <div className="rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <header className="border-b border-slate-200 px-5 pb-6 pt-6 sm:px-6 sm:pb-8 sm:pt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Public booking
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {organization.name}
                </h1>
              </div>
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600">
                {organization.bookables.length} available
              </div>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
              Book a resource from this organization.
            </p>
          </header>

          <section className="px-5 pb-6 pt-6 sm:px-6 sm:pb-8" aria-labelledby="available-bookables-heading">
            {organization.bookables.length > 0 && (
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <label htmlFor="bookable-search" className="sr-only">
                    Search bookables
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                      id="bookable-search"
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search bookables..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>
                <div className="text-sm text-slate-500">
                  {filteredBookables.length} result{filteredBookables.length === 1 ? "" : "s"}
                </div>
              </div>
            )}

            {organization.bookables.length === 0 ? (
              <EmptyState
                title="Nothing available to book"
                description="This organization does not currently have any available bookings."
              />
            ) : filteredBookables.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                <p className="text-base font-medium text-slate-900">No matching bookables</p>
                <p className="mt-2 text-sm text-slate-500">
                  Try a different search term to find a resource for this workspace.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredBookables.map((bookable) => (
                  (() => {
                    const imageUrl =
                      bookable.images?.find((image) => image.isPrimary)?.url ??
                      bookable.images?.[0]?.url ??
                      null;

                    return (
                      <Link
                        key={bookable.slug}
                        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
                        href={`/book/${organization.slug}/${bookable.slug}`}
                      >
                        <div className="relative aspect-[16/9] overflow-hidden border-b border-slate-200 bg-zinc-100">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={bookable.name}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="rounded-full border border-slate-200 bg-white/80 p-4 text-slate-700 backdrop-blur-sm">
                                <CalendarDays
                                  className="size-6"
                                  aria-hidden="true"
                                />
                              </div>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.8),_transparent_55%)]" />
                          <div className="absolute left-4 top-4 z-10 inline-flex items-center rounded-full border border-slate-200/80 bg-white/90 px-2.5 py-1 text-[10px] font-medium tracking-[0.12em] text-slate-700 backdrop-blur-sm">
                            {bookable.pricingType === "FREE" ? "FREE" : "PAID"}
                          </div>
                        </div>

                        <div className="flex flex-1 flex-col p-4">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-lg font-semibold tracking-tight text-slate-950">
                                {bookable.name}
                              </h3>
                            </div>
                            <span
                              className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                bookable.pricingType === "FREE"
                                  ? "border border-slate-200 bg-slate-100 text-slate-700"
                                  : "bg-slate-950 text-white"
                              }`}
                            >
                              {bookable.pricingType === "FREE"
                                ? "Free"
                                : formatMoneyMinorUnits(
                                    bookable.price,
                                    bookable.currency,
                                  )}
                            </span>
                          </div>

                          {bookable.description && (
                            <p className="line-clamp-3 text-sm leading-6 text-slate-600">
                              {bookable.description}
                            </p>
                          )}

                          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                              <Users className="size-3.5" aria-hidden="true" />
                              {bookable.capacity} seats
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                              {bookable.pricingType === "FREE"
                                ? "No payment"
                                : "Paid booking"}
                            </span>
                          </div>

                          <div className="mt-auto pt-5">
                            <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3.5 py-2.5 text-sm font-medium text-white transition-colors group-hover:bg-indigo-600">
                              Book now
                              <ArrowRight className="size-4" aria-hidden="true" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })()
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </PublicShell>
  );
}

function CatalogLoadingState() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-4 w-32 animate-pulse rounded-[6px] bg-slate-200" />
      <div className="h-12 w-2/3 animate-pulse rounded-[6px] bg-slate-200" />
      <div className="h-4 w-full animate-pulse rounded-[6px] bg-slate-200" />
      <div className="h-48 rounded-[8px] border border-slate-200 bg-white" />
    </div>
  );
}

function CatalogStatePanel({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <section className="border-y border-slate-200 bg-white px-5 py-8">
      <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
      <Link
        className="mt-6 inline-flex min-h-10 items-center rounded-[6px] border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
        href="/"
      >
        Return to Bookable
      </Link>
    </section>
  );
}
