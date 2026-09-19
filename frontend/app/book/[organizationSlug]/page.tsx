"use client";

import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { use } from "react";
import { useEffect, useState } from "react";
import { ApiError } from "../../../lib/api/client";
import { getPublicOrganization } from "../../../lib/api/public-booking";
import { formatMoneyMinorUnits } from "../../../lib/currency";
import type { PublicOrganization } from "../../../types/public-booking";
import { EmptyState } from "../../../components/empty-state";
import { PublicShell } from "../../../components/public/public-shell";

interface PublicOrganizationPageProps {
  params: Promise<{ organizationSlug: string }>;
}

export default function PublicOrganizationPage({
  params,
}: PublicOrganizationPageProps) {
  const { organizationSlug } = use(params);
  const [organization, setOrganization] = useState<PublicOrganization | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

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
        <>
          <header className="border-b border-slate-200 pb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Public booking
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              {organization.name}
            </h1>
            <p className="mt-4 text-sm text-slate-500">
              Book a resource from this organization.
            </p>
          </header>

          <section
            className="mt-9"
            aria-labelledby="available-bookables-heading"
          >
            <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Available now
                </p>
                <h2
                  id="available-bookables-heading"
                  className="mt-2 text-xl font-semibold text-slate-950"
                >
                  Choose a Bookable
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                {organization.bookables.length} available
              </span>
            </div>

            {organization.bookables.length === 0 ? (
              <EmptyState
                title="Nothing available to book"
                description="This organization does not currently have any available bookings."
              />
            ) : (
              <div className="divide-y divide-slate-200 border-b border-slate-200">
                {organization.bookables.map((bookable) => (
                  <Link
                    key={bookable.slug}
                    className="group grid gap-4 py-5 transition-colors hover:bg-white sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-3"
                    href={`/book/${organization.slug}/${bookable.slug}`}
                  >
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-slate-950">
                        {bookable.name}
                      </h3>
                      {bookable.description && (
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                          {bookable.description}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                        <span className="font-medium text-slate-800">
                          {bookable.pricingType === "FREE"
                            ? "Free"
                            : formatMoneyMinorUnits(
                                bookable.price,
                                bookable.currency,
                              )}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="size-3.5" aria-hidden="true" />
                          Capacity {bookable.capacity}
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex min-h-10 w-fit items-center gap-2 rounded-[6px] border border-slate-300 bg-white px-4 text-xs font-medium text-slate-800 transition-colors group-hover:border-slate-500">
                      View
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
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
