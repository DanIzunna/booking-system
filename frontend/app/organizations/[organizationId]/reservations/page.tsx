"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  CircleX,
  Filter,
  X,
} from "lucide-react";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, getUserFacingError } from "../../../../lib/api/client";
import { listBookables } from "../../../../lib/api/bookables";
import {
  approveOrganizationReservation,
  listOrganizationReservations,
  rejectOrganizationReservation,
} from "../../../../lib/api/reservations";
import { getOrganization } from "../../../../lib/api/organizations";
import { useSession } from "../../../../lib/auth/session-provider";
import { formatMoneyMinorUnits } from "../../../../lib/currency";
import { PageContainer } from "../../../../components/layout/page-container";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/empty-state";
import { Skeleton } from "../../../../components/ui/skeleton";
import type { Bookable } from "../../../../types/bookables";
import type { Organization } from "../../../../types/organizations";
import type {
  OrganizationReservation,
  ReservationStatus,
} from "../../../../types/reservations";

const RESERVATION_STATUS_OPTIONS: ReservationStatus[] = [
  "PENDING",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
  "COMPLETED",
];

export default function OrganizationReservationsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = use(params);
  const router = useRouter();
  const { status, user } = useSession();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [bookables, setBookables] = useState<Bookable[]>([]);
  const [reservations, setReservations] = useState<OrganizationReservation[]>(
    [],
  );
  const [selectedBookableId, setSelectedBookableId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<
    ReservationStatus | "all"
  >("all");
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] =
    useState<OrganizationReservation | null>(null);

  const hasActiveFilters = useMemo(
    () =>
      selectedBookableId !== "all" || selectedStatus !== "all" || !!dateFilter,
    [dateFilter, selectedBookableId, selectedStatus],
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    void Promise.all([
      getOrganization(organizationId),
      listBookables(organizationId),
    ])
      .then(([nextOrganization, nextBookables]) => {
        if (cancelled) return;
        setOrganization(nextOrganization);
        setBookables(nextBookables);
      })
      .catch((caught) => {
        if (!cancelled) {
          setErrorStatus(caught instanceof ApiError ? caught.statusCode : 500);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId, retryToken, status]);

  useEffect(() => {
    if (status !== "authenticated" || !organization) return;

    let cancelled = false;
    const loadReservations = async () => {
      setLoading(true);
      setPageError(null);

      try {
        const nextReservations = await listOrganizationReservations(
          organizationId,
          {
            bookableId:
              selectedBookableId === "all" ? undefined : selectedBookableId,
            status: selectedStatus === "all" ? undefined : selectedStatus,
            date: dateFilter || undefined,
          },
        );
        if (!cancelled) setReservations(nextReservations);
      } catch (caught) {
        if (!cancelled) {
          setPageError(
            getUserFacingError(caught, "Unable to load reservations."),
          );
          setReservations([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadReservations();

    return () => {
      cancelled = true;
    };
  }, [
    dateFilter,
    organization,
    organizationId,
    retryToken,
    selectedBookableId,
    selectedStatus,
    status,
  ]);

  const handleApprove = async (reservationId: string) => {
    if (!organization) return;
    setPendingActionId(reservationId);
    setPageError(null);

    try {
      await approveOrganizationReservation(organizationId, reservationId);
      const refreshed = await listOrganizationReservations(organizationId, {
        bookableId:
          selectedBookableId === "all" ? undefined : selectedBookableId,
        status: selectedStatus === "all" ? undefined : selectedStatus,
        date: dateFilter || undefined,
      });
      setReservations(refreshed);
    } catch (caught) {
      setPageError(
        `Approval failed. ${getUserFacingError(caught, "Please try again.")}`,
      );
    } finally {
      setPendingActionId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !organization) return;
    setPendingActionId(rejectTarget.id);
    setPageError(null);

    try {
      await rejectOrganizationReservation(organizationId, rejectTarget.id);
      const refreshed = await listOrganizationReservations(organizationId, {
        bookableId:
          selectedBookableId === "all" ? undefined : selectedBookableId,
        status: selectedStatus === "all" ? undefined : selectedStatus,
        date: dateFilter || undefined,
      });
      setReservations(refreshed);
      setRejectTarget(null);
    } catch (caught) {
      setPageError(
        `Rejection failed. ${getUserFacingError(caught, "Please try again.")}`,
      );
    } finally {
      setPendingActionId(null);
    }
  };

  function resetFilters() {
    setSelectedBookableId("all");
    setSelectedStatus("all");
    setDateFilter("");
  }

  function retryLoading() {
    setErrorStatus(null);
    setPageError(null);
    setLoading(true);
    setRetryToken((current) => current + 1);
  }

  const canManageReservation = (reservation: OrganizationReservation) =>
    reservation.status === "PENDING" &&
    reservation.bookable.confirmationPolicy === "REQUIRES_APPROVAL";

  const isAwaitingPayment = (reservation: OrganizationReservation) =>
    reservation.status === "PENDING" &&
    reservation.bookable.confirmationPolicy !== "REQUIRES_APPROVAL" &&
    reservation.payment?.status === "PENDING";

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">
        Checking your session...
      </main>
    );
  }

  if (!user) return null;

  return (
    <PageContainer>
      <main className="px-0 py-0">
        {errorStatus !== null && (
          <section className="mt-6 max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-red-700">
              {errorStatus === 403
                ? "Access denied"
                : errorStatus === 404
                  ? "Workspace not found"
                  : "Unable to load"}
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950">
              We could not open this reservations page.
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Try again shortly or return to your workspace.
            </p>
            <Button className="mt-5" type="button" onClick={retryLoading}>
              Try again
            </Button>
          </section>
        )}

        {errorStatus === null && organization && (
          <>
            <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  Reservations
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
                  Review pending bookings and manage reservations in this
                  workspace.
                </p>
              </div>
              <p className="shrink-0 text-xs text-slate-500 sm:pt-2">
                Times shown in {organization.timezone}
              </p>
            </header>

            <section className="mt-4 flex flex-col gap-3 rounded-[8px] border border-slate-200 bg-white p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1">
                  <label
                    className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500"
                    htmlFor="reservation-date"
                  >
                    Date
                  </label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="reservation-date"
                      type="date"
                      value={dateFilter}
                      onChange={(event) => setDateFilter(event.target.value)}
                      className="min-h-10 w-full rounded-[6px] border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <label
                    className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500"
                    htmlFor="reservation-bookable"
                  >
                    Bookable
                  </label>
                  <div className="relative">
                    <Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <select
                      id="reservation-bookable"
                      value={selectedBookableId}
                      onChange={(event) =>
                        setSelectedBookableId(event.target.value)
                      }
                      className="min-h-10 w-full appearance-none rounded-[6px] border border-slate-300 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    >
                      <option value="all">All bookables</option>
                      {bookables.map((bookable) => (
                        <option key={bookable.id} value={bookable.id}>
                          {bookable.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <label
                    className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500"
                    htmlFor="reservation-status"
                  >
                    Status
                  </label>
                  <div className="relative">
                    <select
                      id="reservation-status"
                      value={selectedStatus}
                      onChange={(event) => {
                        const nextValue = event.target.value as
                          | ReservationStatus
                          | "all";
                        setSelectedStatus(nextValue);
                      }}
                      className="min-h-10 w-full appearance-none rounded-[6px] border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    >
                      <option value="all">All statuses</option>
                      {RESERVATION_STATUS_OPTIONS.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {humanizeStatus(statusOption)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>

                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetFilters}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </section>

            {pageError && (
              <div
                className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                <span>{pageError}</span>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-9 px-3 text-xs"
                  onClick={retryLoading}
                >
                  Try again
                </Button>
              </div>
            )}

            {loading ? (
              <div className="mt-6 overflow-hidden rounded-[8px] border border-slate-200 bg-white">
                <div className="hidden md:block">
                  <div className="grid grid-cols-[1.2fr_1fr_1.2fr_0.8fr_0.8fr_1.2fr] gap-4 bg-slate-50 px-4 py-3">
                    {Array.from({ length: 6 }, (_, index) => (
                      <Skeleton key={index} className="h-3 w-3/4" />
                    ))}
                  </div>
                  {Array.from({ length: 3 }, (_, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[1.2fr_1fr_1.2fr_0.8fr_0.8fr_1.2fr] items-start gap-4 border-t border-slate-200 px-4 py-4"
                    >
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full max-w-40" />
                      </div>
                      <Skeleton className="h-4 w-4/5" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-3 w-3/5" />
                      </div>
                      <Skeleton className="h-5 w-20" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-9 w-14" />
                        <Skeleton className="h-9 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-slate-200 md:hidden">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div key={index} className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-5 w-20" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-4/5" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-9 w-32" />
                        <Skeleton className="h-9 flex-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : reservations.length === 0 ? (
              <div className="mt-8 max-w-xl">
                <EmptyState
                  title={
                    hasActiveFilters
                      ? "No reservations match the current filters"
                      : "No reservations yet"
                  }
                  description={
                    hasActiveFilters
                      ? "Try a different date, bookable, or status to broaden the results."
                      : "There are no reservations in this workspace yet."
                  }
                  action={
                    hasActiveFilters ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={resetFilters}
                      >
                        Clear filters
                      </Button>
                    ) : null
                  }
                />
              </div>
            ) : (
              <section className="mt-6 overflow-hidden rounded-[8px] border border-slate-200 bg-white">
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Bookable</th>
                        <th className="px-4 py-3">Date / time</th>
                        <th className="px-4 py-3 text-right">Qty</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map((reservation) => (
                        <tr
                          key={reservation.id}
                          className="border-t border-slate-200 align-top transition-colors hover:bg-slate-50"
                        >
                          <td className="px-4 py-3">
                            <Link
                              className="block rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                              href={`/organizations/${organizationId}/reservations/${reservation.id}`}
                              aria-label={`View reservation for ${reservation.customer.name}`}
                            >
                              <div className="font-medium text-slate-900">
                                {reservation.customer.name}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {reservation.customer.email}
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              className="block rounded-[6px] font-medium text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                              href={`/organizations/${organizationId}/reservations/${reservation.id}`}
                            >
                              {reservation.bookable.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            <Link
                              className="block rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                              href={`/organizations/${organizationId}/reservations/${reservation.id}`}
                            >
                              <div className="font-medium text-slate-900">
                                {formatDateTime(
                                  reservation.startAt,
                                  organization.timezone,
                                )}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                to{" "}
                                {formatDateTime(
                                  reservation.endAt,
                                  organization.timezone,
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                            <Link
                              className="block rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                              href={`/organizations/${organizationId}/reservations/${reservation.id}`}
                            >
                              {reservation.quantity}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              className="block rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                              href={`/organizations/${organizationId}/reservations/${reservation.id}`}
                            >
                              <Badge variant={statusVariant(reservation.status)}>
                                {humanizeStatus(reservation.status)}
                              </Badge>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                            <Link
                              className="block rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                              href={`/organizations/${organizationId}/reservations/${reservation.id}`}
                            >
                              <div className="font-medium text-slate-900">
                                {formatMoney(
                                  reservation.amount,
                                  reservation.currency,
                                )}
                              </div>
                              {reservation.payment && (
                                <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                                  {humanizeStatus(reservation.payment.status)}
                                </div>
                              )}
                            </Link>
                          </td>
                          <td
                            className="px-4 py-3"
                          >
                            <div className="flex flex-wrap items-center justify-end gap-3">
                              {(canManageReservation(reservation) ||
                                isAwaitingPayment(reservation)) && (
                                <div className="flex flex-wrap items-center gap-2 border-l border-slate-200 pl-3">
                                  {canManageReservation(reservation) && (
                                    <>
                                  {reservation.payment?.status ===
                                    "SUCCEEDED" && (
                                      <Badge variant="success">
                                        Paid · Awaiting approval
                                      </Badge>
                                    )}
                                  <Button
                                    type="button"
                                    variant="primary"
                                    className="min-h-9 px-3 text-[12px]"
                                    disabled={
                                      pendingActionId === reservation.id
                                    }
                                    onClick={() =>
                                      void handleApprove(reservation.id)
                                    }
                                  >
                                    {pendingActionId === reservation.id
                                      ? "Approving..."
                                      : "Approve"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    className="min-h-9 px-3 text-[12px]"
                                    disabled={
                                      pendingActionId === reservation.id
                                    }
                                    onClick={() => setRejectTarget(reservation)}
                                  >
                                    Reject
                                  </Button>
                                    </>
                                  )}
                                  {!canManageReservation(reservation) &&
                                    isAwaitingPayment(reservation) && (
                                      <Badge variant="warning">
                                        Awaiting payment
                                      </Badge>
                                    )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-slate-200">
                  {reservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      className="cursor-pointer p-4 transition-colors hover:bg-slate-50"
                    >
                      <Link
                        className="block rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                        href={`/organizations/${organizationId}/reservations/${reservation.id}`}
                        aria-label={`View reservation for ${reservation.customer.name}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-950">
                              {reservation.customer.name}
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-500">
                              {reservation.bookable.name}
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-500">
                              {reservation.customer.email}
                            </div>
                          </div>
                          <Badge variant={statusVariant(reservation.status)}>
                            {humanizeStatus(reservation.status)}
                          </Badge>
                        </div>

                        <dl className="mt-3 space-y-2 text-xs text-slate-600">
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500">When</dt>
                            <dd className="text-right text-slate-700">
                              <span className="block">
                                {formatDateTime(
                                  reservation.startAt,
                                  organization.timezone,
                                )}
                              </span>
                              <span className="block text-slate-500">
                                to {formatDateTime(reservation.endAt, organization.timezone)}
                              </span>
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500">Qty</dt>
                            <dd className="tabular-nums text-slate-700">
                              {reservation.quantity}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500">Amount</dt>
                            <dd className="tabular-nums text-slate-700">
                              {formatMoney(
                                reservation.amount,
                                reservation.currency,
                              )}
                            </dd>
                          </div>
                          {reservation.payment && (
                            <div className="flex justify-between gap-3">
                              <dt className="text-slate-500">Payment</dt>
                              <dd className="text-slate-700">
                                {humanizeStatus(reservation.payment.status)}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </Link>

                      {canManageReservation(reservation) && (
                        <div
                          className="mt-4 flex gap-2"
                        >
                          {reservation.payment?.status === "SUCCEEDED" && (
                            <Badge variant="success">
                              Paid · Awaiting approval
                            </Badge>
                          )}
                          <Button
                            type="button"
                            variant="primary"
                            className="flex-1 min-h-9 text-[12px]"
                            disabled={pendingActionId === reservation.id}
                            onClick={() => void handleApprove(reservation.id)}
                          >
                            {pendingActionId === reservation.id
                              ? "Approving..."
                              : "Approve"}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="flex-1 min-h-9 text-[12px]"
                            disabled={pendingActionId === reservation.id}
                            onClick={() => setRejectTarget(reservation)}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {!canManageReservation(reservation) &&
                        isAwaitingPayment(reservation) && (
                          <div
                            className="mt-4 flex"
                          >
                            <Badge variant="warning">Awaiting payment</Badge>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {rejectTarget && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4">
            <div
              className="w-full max-w-md rounded-[12px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reject-reservation-title"
            >
              <button
                type="button"
                className="absolute right-3 top-3 grid size-8 place-items-center rounded-[6px] text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                aria-label="Close rejection dialog"
                onClick={() => setRejectTarget(null)}
              >
                <X className="size-4" />
              </button>

              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-red-50 text-red-700">
                  <CircleX className="size-5" />
                </span>
                <div>
                  <p
                    id="reject-reservation-title"
                    className="text-base font-semibold text-slate-900"
                  >
                    Reject reservation?
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">
                  {rejectTarget.customer.name}
                </div>
                <div className="mt-1">{rejectTarget.bookable.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {formatDateTime(
                    rejectTarget.startAt,
                    organization?.timezone ?? "UTC",
                  )}
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setRejectTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={pendingActionId === rejectTarget.id}
                  onClick={() => void handleReject()}
                >
                  {pendingActionId === rejectTarget.id
                    ? "Rejecting..."
                    : "Reject reservation"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </PageContainer>
  );
}

function formatDateTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function humanizeStatus(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusVariant(
  value: ReservationStatus,
): "neutral" | "success" | "warning" | "error" {
  switch (value) {
    case "PENDING":
      return "warning";
    case "CONFIRMED":
      return "success";
    case "REJECTED":
    case "CANCELLED":
      return "error";
    case "EXPIRED":
    case "COMPLETED":
    default:
      return "neutral";
  }
}

function formatMoney(amount: number, currency: string): string {
  return formatMoneyMinorUnits(amount, currency);
}
