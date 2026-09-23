"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api/client";
import { getCustomerReservation } from "../../../lib/api/reservations";
import { useSession } from "../../../lib/auth/session-provider";
import { formatMoneyMinorUnits } from "../../../lib/currency";
import { formatTimeZoneName, formatZonedDateTime } from "../../../lib/timezone";
import type { ReservationResult, ReservationStatus } from "../../../types/reservations";
import { CustomerContainer } from "../../../components/layout/customer-shell";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";

interface ReservationDetailPageProps {
  params: Promise<{ reservationId: string }>;
}

export default function ReservationDetailPage({
  params,
}: ReservationDetailPageProps) {
  const { reservationId } = use(params);
  const router = useRouter();
  const { status, user } = useSession();
  const [reservation, setReservation] = useState<ReservationResult | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;
    void getCustomerReservation(reservationId)
      .then((nextReservation) => {
        if (!cancelled) setReservation(nextReservation);
      })
      .catch((caught) => {
        if (!cancelled) {
          setErrorStatus(caught instanceof ApiError ? caught.statusCode : 500);
          setErrorMessage(
            caught instanceof ApiError
              ? caught.message
              : "Unable to load this reservation.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reservationId, retryToken, status]);

  function retryLoading() {
    if (loading) return;
    setErrorStatus(null);
    setErrorMessage("");
    setReservation(null);
    setLoading(true);
    setRetryToken((current) => current + 1);
  }

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">
        Checking your session...
      </main>
    );
  }

  if (!user) return null;

  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <CustomerContainer>
      <main className="px-0 py-0">
        <Link
          className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
          href="/reservations"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to reservations
        </Link>

        {loading ? (
          <section className="mt-8 max-w-2xl space-y-4">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-5 w-80" />
            <Skeleton className="h-72 w-full rounded-[8px]" />
          </section>
        ) : errorStatus !== null || !reservation ? (
          <section className="mt-8 max-w-xl rounded-[8px] border border-slate-200 bg-white p-6">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {errorStatus === 404 ? "Reservation unavailable" : "Unable to load"}
            </p>
            <h1 className="mt-3 text-xl font-semibold text-slate-950">
              {errorStatus === 404
                ? "This reservation could not be found."
                : "We could not load this reservation."}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {errorStatus === 404
                ? "It may no longer be available, or it may not belong to your account."
                : errorMessage || "Please try again shortly."}
            </p>
            {errorStatus !== 404 && (
              <Button
                type="button"
                variant="secondary"
                className="mt-4"
                onClick={retryLoading}
                disabled={loading}
              >
                Try again
              </Button>
            )}
          </section>
        ) : (
          <>
            <header className="mt-8 border-b border-slate-200 pb-7">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Reservation
                </p>
                <StatusBadge status={reservation.status} />
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                Reservation details
              </h1>
              <p className="mt-2 break-all text-xs text-slate-500">
                Reservation ID {reservation.id}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                {reservation.bookable.name}
              </p>
            </header>

            <section className="mt-8 max-w-3xl rounded-[8px] border border-slate-200 bg-white p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <DetailItem
                  label="Bookable"
                  value={reservation.bookable.name}
                />
                <DetailItem
                  label="Bookable ID"
                  value={reservation.bookableId}
                />
                <DetailItem
                  label="Quantity"
                  value={String(reservation.quantity)}
                />
                <DetailItem
                  label="Starts"
                  value={formatZonedDateTime(
                    reservation.startAt,
                    browserTimeZone,
                  )}
                  icon
                />
                <DetailItem
                  label="Ends"
                  value={formatZonedDateTime(reservation.endAt, browserTimeZone)}
                />
                <DetailItem
                  label="Amount"
                  value={formatMoneyMinorUnits(
                    reservation.amount,
                    reservation.currency,
                  )}
                />
                <DetailItem
                  label="Timezone"
                  value={formatTimeZoneName(browserTimeZone)}
                />
                {reservation.payment && (
                  <DetailItem
                    label="Payment status"
                    value={humanizeStatus(reservation.payment.status)}
                  />
                )}
                {reservation.expiresAt && (
                  <DetailItem
                    label="Expires"
                    value={formatZonedDateTime(
                      reservation.expiresAt,
                      browserTimeZone,
                    )}
                  />
                )}
                <DetailItem
                  label="Last updated"
                  value={formatZonedDateTime(
                    reservation.updatedAt,
                    browserTimeZone,
                  )}
                />
              </div>
            </section>
          </>
        )}
      </main>
    </CustomerContainer>
  );
}

function DetailItem({
  label,
  value,
  icon = false,
}: {
  label: string;
  value: string;
  icon?: boolean;
}) {
  return (
    <div className="rounded-[6px] border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 flex items-center gap-2 break-words text-sm font-medium text-slate-900">
        {icon && <CalendarDays className="size-4 shrink-0 text-slate-400" aria-hidden="true" />}
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <Badge
      variant={
        status === "CONFIRMED"
          ? "success"
          : status === "REJECTED" || status === "CANCELLED" || status === "EXPIRED"
            ? "error"
            : "neutral"
      }
    >
      {humanizeStatus(status)}
    </Badge>
  );
}

function humanizeStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
