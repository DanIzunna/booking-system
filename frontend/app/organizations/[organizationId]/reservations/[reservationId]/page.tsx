"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, Check, CircleX, X } from "lucide-react";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../../../lib/api/client";
import {
  approveOrganizationReservation,
  getOrganizationReservation,
  rejectOrganizationReservation,
} from "../../../../../lib/api/reservations";
import { useSession } from "../../../../../lib/auth/session-provider";
import { formatMoneyMinorUnits } from "../../../../../lib/currency";
import { PageContainer } from "../../../../../components/layout/page-container";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent } from "../../../../../components/ui/card";
import { Skeleton } from "../../../../../components/ui/skeleton";
import type { OrganizationReservation } from "../../../../../types/reservations";

interface ReservationDetailPageProps {
  params: Promise<{ organizationId: string; reservationId: string }>;
}

type PendingAction = "approve" | "reject" | null;

export default function OrganizationReservationDetailPage({
  params,
}: ReservationDetailPageProps) {
  const { organizationId, reservationId } = use(params);
  const router = useRouter();
  const { status, user } = useSession();
  const [reservation, setReservation] =
    useState<OrganizationReservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    void getOrganizationReservation(organizationId, reservationId)
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
  }, [organizationId, reservationId, retryToken, status]);

  useEffect(() => {
    if (!rejectOpen) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusFrame = requestAnimationFrame(() => {
      document.getElementById("reject-reservation-cancel")?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && pendingAction === null) {
        closeRejectDialog();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pendingAction, rejectOpen]);

  async function refreshReservation() {
    const nextReservation = await getOrganizationReservation(
      organizationId,
      reservationId,
    );
    setReservation(nextReservation);
  }

  async function handleApprove() {
    if (!reservation) return;
    setPendingAction("approve");
    setActionError("");

    try {
      await approveOrganizationReservation(organizationId, reservation.id);
      await refreshReservation();
    } catch (caught) {
      setActionError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to approve this reservation.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReject() {
    if (!reservation) return;
    setPendingAction("reject");
    setActionError("");

    try {
      await rejectOrganizationReservation(organizationId, reservation.id);
      await refreshReservation();
      closeRejectDialog();
    } catch (caught) {
      setActionError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to reject this reservation.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function retryLoading() {
    if (loading) return;
    setErrorStatus(null);
    setErrorMessage("");
    setReservation(null);
    setLoading(true);
    setRetryToken((current) => current + 1);
  }

  function openRejectDialog() {
    if (pendingAction !== null) return;
    setRejectOpen(true);
  }

  function closeRejectDialog() {
    setRejectOpen(false);
    requestAnimationFrame(() => previousFocusRef.current?.focus());
  }

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">
        Checking your session...
      </main>
    );
  }

  if (!user) return null;

  const timezone = reservation?.bookable.organization.timezone ?? "UTC";
  const canManageReservation =
    reservation?.status === "PENDING" &&
    reservation.bookable.confirmationPolicy === "REQUIRES_APPROVAL";
  return (
    <PageContainer>
      <main className="px-0 py-0">
        <div className="mb-3">
          <Link
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
            href={`/organizations/${organizationId}/reservations`}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Reservations
          </Link>
        </div>

        {loading ? (
          <section className="mt-8 space-y-4" aria-busy="true" aria-label="Loading reservation">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
              <div className="space-y-3">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-4 w-80 max-w-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-20" />
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-36 rounded-[8px]" />
              <Skeleton className="h-52 rounded-[8px]" />
              <Skeleton className="h-36 rounded-[8px]" />
              <Skeleton className="h-36 rounded-[8px]" />
              <Skeleton className="h-28 rounded-[8px] lg:col-span-2" />
            </div>
          </section>
        ) : errorStatus !== null || !reservation ? (
          <section className="mt-8 max-w-xl rounded-[8px] border border-slate-200 bg-white p-6">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {errorStatus === 403
                ? "Access denied"
                : errorStatus === 404
                  ? "Reservation unavailable"
                  : "Unable to load"}
            </p>
            <h1 className="mt-3 text-xl font-semibold text-slate-950">
              {errorStatus === 404
                ? "This reservation could not be found."
                : "We could not load this reservation."}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {errorStatus === 403
                ? "You do not have permission to view this reservation."
                : errorStatus === 404
                  ? "It may no longer be available, or it may not belong to this workspace."
                  : errorMessage || "Please try again shortly."}
            </p>
            {errorStatus !== 403 && errorStatus !== 404 && (
              <Button className="mt-5" type="button" onClick={retryLoading}>
                Try again
              </Button>
            )}
          </section>
        ) : (
          <>
            <header className="mt-3 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                    Reservation
                  </h1>
                  <StatusBadge status={reservation.status} />
                </div>
                <p className="mt-2 text-sm font-medium text-slate-700">
                  {reservation.customer.name}
                  <span className="px-2 text-slate-400">·</span>
                  {reservation.bookable.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Times shown in {timezone}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canManageReservation && (
                  <>
                    <Button
                      type="button"
                      disabled={pendingAction !== null}
                      onClick={() => void handleApprove()}
                    >
                      <Check className="size-4" />
                      {pendingAction === "approve" ? "Approving..." : "Approve"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pendingAction !== null}
                      onClick={openRejectDialog}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </header>

            {actionError && (
              <div
                className="mt-6 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {actionError}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                    <section>
                      <h2 className="text-base font-semibold text-slate-950">
                        Customer
                      </h2>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <DetailItem label="Name" value={reservation.customer.name} />
                        <DetailItem label="Email" value={reservation.customer.email} />
                      </div>
                    </section>

                    <section className="border-slate-200 lg:border-l lg:pl-6">
                      <h2 className="text-base font-semibold text-slate-950">
                        Booking
                      </h2>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <DetailItem
                          label="Bookable"
                          value={reservation.bookable.name}
                        />
                        <DetailItem
                          label="Date"
                          value={formatDate(reservation.startAt, timezone)}
                          icon={<CalendarDays className="size-4" />}
                        />
                        <DetailItem
                          label="Start time"
                          value={formatTime(reservation.startAt, timezone)}
                        />
                        <DetailItem
                          label="End time"
                          value={formatTime(reservation.endAt, timezone)}
                        />
                        <DetailItem
                          label="Duration"
                          value={formatDuration(reservation.startAt, reservation.endAt)}
                        />
                        <DetailItem
                          label="Quantity"
                          value={String(reservation.quantity)}
                        />
                      </div>
                    </section>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-3">
              <DetailSection title="Payment" compact>
                <DetailItem
                  label="Amount"
                  value={formatMoneyMinorUnits(
                    reservation.amount,
                    reservation.currency,
                  )}
                />
                <DetailItem label="Currency" value={reservation.currency} />
                <DetailItem
                  label="Payment status"
                  value={reservation.payment ? humanizeStatus(reservation.payment.status) : "No payment record"}
                />
              </DetailSection>

              <DetailSection title="Approval" compact>
                <DetailItem
                  label="Confirmation policy"
                  value={humanizeStatus(reservation.bookable.confirmationPolicy)}
                />
                <DetailItem
                  label="Approval state"
                  value={approvalState(reservation)}
                />
                {reservation.approvedAt && (
                  <DetailItem
                    label="Approved"
                    value={formatDateTime(reservation.approvedAt, timezone)}
                  />
                )}
              </DetailSection>

              <DetailSection title="Metadata" compact>
                <DetailItem
                  label="Reservation ID"
                  value={compactReservationId(reservation.id)}
                  valueTitle={reservation.id}
                  valueAriaLabel={`Reservation ID ${reservation.id}`}
                />
                <DetailItem
                  label="Created"
                  value={formatDateTime(reservation.createdAt, timezone)}
                />
                <DetailItem
                  label="Updated"
                  value={formatDateTime(reservation.updatedAt, timezone)}
                />
              </DetailSection>
              </div>
            </div>
          </>
        )}

        {rejectOpen && reservation && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4">
            <div
              className="relative w-full max-w-md rounded-[12px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reject-reservation-title"
            >
              <button
                type="button"
                className="absolute right-3 top-3 grid size-8 place-items-center rounded-[6px] text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                aria-label="Close rejection dialog"
                onClick={closeRejectDialog}
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
                  {reservation.customer.name}
                </div>
                <div className="mt-1">{reservation.bookable.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {formatDateTime(reservation.startAt, timezone)}
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <Button
                  id="reject-reservation-cancel"
                  type="button"
                  variant="secondary"
                  disabled={pendingAction !== null}
                  onClick={closeRejectDialog}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={pendingAction !== null}
                  onClick={() => void handleReject()}
                >
                  {pendingAction === "reject" ? "Rejecting..." : "Reject reservation"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </PageContainer>
  );
}

function DetailSection({
  title,
  className = "",
  compact = false,
  children,
}: {
  title: string;
  className?: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardContent className={compact ? "p-4" : undefined}>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <div className={compact ? "mt-3 grid gap-3 sm:grid-cols-2" : "mt-4 grid gap-4 sm:grid-cols-2"}>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailItem({
  label,
  value,
  icon,
  valueTitle,
  valueAriaLabel,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueTitle?: string;
  valueAriaLabel?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p
        className="mt-2 flex items-center gap-2 break-words text-sm font-medium text-slate-900"
        title={valueTitle}
        aria-label={valueAriaLabel}
      >
        {icon && <span className="text-slate-400">{icon}</span>}
        {value}
      </p>
    </div>
  );
}

function compactReservationId(value: string): string {
  if (value.length <= 20) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function StatusBadge({ status }: { status: OrganizationReservation["status"] }) {
  return (
    <Badge
      variant={
        status === "CONFIRMED"
          ? "success"
          : status === "REJECTED" || status === "CANCELLED"
            ? "error"
            : status === "PENDING"
              ? "warning"
              : "neutral"
      }
    >
      {humanizeStatus(status)}
    </Badge>
  );
}

function approvalState(reservation: OrganizationReservation): string {
  if (reservation.status === "CONFIRMED") return "Approved";
  if (reservation.status === "REJECTED") return "Rejected";
  if (reservation.status === "CANCELLED") return "Cancelled";
  if (reservation.bookable.confirmationPolicy === "REQUIRES_APPROVAL") {
    return reservation.status === "PENDING" ? "Awaiting approval" : "Approval required";
  }
  return "Automatic confirmation";
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function formatDateTime(value: string, timeZone: string): string {
  if (!isValidDate(value)) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string, timeZone: string): string {
  if (!isValidDate(value)) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatTime(value: string, timeZone: string): string {
  if (!isValidDate(value)) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(startAt: string, endAt: string): string {
  const durationMinutes = Math.round(
    (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000,
  );
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return "Unavailable";
  }
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr${hours === 1 ? "" : "s"} ${minutes} min`;
}

function humanizeStatus(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
