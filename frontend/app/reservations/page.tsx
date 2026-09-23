"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../lib/api/client";
import { listCustomerReservations } from "../../lib/api/reservations";
import { useSession } from "../../lib/auth/session-provider";
import { formatMoneyMinorUnits } from "../../lib/currency";
import { formatZonedDateTime } from "../../lib/timezone";
import type { ReservationResult, ReservationStatus } from "../../types/reservations";
import { EmptyState } from "../../components/empty-state";
import { CustomerContainer } from "../../components/layout/customer-shell";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";

export default function ReservationsPage() {
  const router = useRouter();
  const { status, user } = useSession();
  const [reservations, setReservations] = useState<ReservationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;
    void listCustomerReservations()
      .then((nextReservations) => {
        if (!cancelled) setReservations(nextReservations);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "Unable to load your reservations.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [retryToken, status]);

  function retryLoading() {
    if (loading) return;
    setError("");
    setReservations([]);
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

  return (
    <CustomerContainer>
      <main className="px-0 py-0">
        <header className="mt-8 border-b border-slate-200 pb-7">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Customer account
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Your reservations
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Review bookings made with your Bookable account.
          </p>
        </header>

        {loading ? (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-28 w-full rounded-[8px]" />
            <Skeleton className="h-28 w-full rounded-[8px]" />
            <Skeleton className="h-28 w-full rounded-[8px]" />
          </div>
        ) : error ? (
          <section className="mt-8 max-w-xl rounded-[8px] border border-red-200 bg-red-50 p-5">
            <h2 className="text-base font-semibold text-red-900">
              We could not load your reservations.
            </h2>
            <p className="mt-2 text-sm text-red-700">{error}</p>
            <Button
              type="button"
              variant="secondary"
              className="mt-4 border-red-300 text-red-800 hover:bg-red-100"
              onClick={retryLoading}
              disabled={loading}
            >
              Try again
            </Button>
          </section>
        ) : reservations.length === 0 ? (
          <div className="mt-8 max-w-xl">
            <EmptyState
              title="No reservations yet"
              description="Reservations you make will appear here."
            />
          </div>
        ) : (
          <section className="mt-8 grid gap-3" aria-label="Your reservations">
            {reservations.map((reservation) => (
              <ReservationRow key={reservation.id} reservation={reservation} />
            ))}
          </section>
        )}
      </main>
    </CustomerContainer>
  );
}

function ReservationRow({ reservation }: { reservation: ReservationResult }) {
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <Link
      href={`/reservations/${reservation.id}`}
      className="group block rounded-[10px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:p-5"
    >
      <article>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold text-slate-950">
                {reservation.bookable.name}
              </h2>
              <StatusBadge status={reservation.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-4 text-slate-400" aria-hidden="true" />
                {formatZonedDateTime(reservation.startAt, browserTimeZone)}
              </span>
              <span>
                Ends {formatZonedDateTime(reservation.endAt, browserTimeZone)}
              </span>
            </div>
          </div>
          <div className="grid shrink-0 gap-2 text-left text-sm sm:text-right">
            <span className="text-slate-500">
              Quantity <strong className="font-medium text-slate-900">{reservation.quantity}</strong>
            </span>
            <span className="font-medium text-slate-900">
              {formatMoneyMinorUnits(reservation.amount, reservation.currency)}
            </span>
          </div>
        </div>
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
          Times shown in your local timezone · Reservation ID {reservation.id}
        </p>
      </article>
    </Link>
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
