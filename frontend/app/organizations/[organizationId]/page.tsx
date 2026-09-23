"use client";

import Link from "next/link";
import {
  ArrowRight,
  Archive,
  CalendarDays,
  CalendarClock,
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  FilePenLine,
  Globe2,
  Inbox,
  Plus,
  X,
} from "lucide-react";
import { use } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, getUserFacingError } from "../../../lib/api/client";
import { getOrganization } from "../../../lib/api/organizations";
import { listBookables } from "../../../lib/api/bookables";
import {
  approveOrganizationReservation,
  listOrganizationReservations,
  rejectOrganizationReservation,
} from "../../../lib/api/reservations";
import { useSession } from "../../../lib/auth/session-provider";
import { formatMoneyMinorUnits } from "../../../lib/currency";
import { formatZonedDateTime } from "../../../lib/timezone";
import type { Organization } from "../../../types/organizations";
import type { Bookable } from "../../../types/bookables";
import type { OrganizationReservation } from "../../../types/reservations";
import { PageContainer } from "../../../components/layout/page-container";
import { BookableOverview } from "../../../components/dashboard/bookable-overview";
import { EmptyState } from "../../../components/empty-state";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";

interface OrganizationPageProps {
  params: Promise<{ organizationId: string }>;
}

export default function OrganizationPage({ params }: OrganizationPageProps) {
  const { organizationId } = use(params);
  const router = useRouter();
  const { status, user } = useSession();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loadedOrganizationId, setLoadedOrganizationId] = useState<
    string | null
  >(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [bookables, setBookables] = useState<Bookable[]>([]);
  const [bookablesLoaded, setBookablesLoaded] = useState(false);
  const [reservations, setReservations] = useState<OrganizationReservation[]>(
    [],
  );
  const [reservationsLoaded, setReservationsLoaded] = useState(false);
  const [reservationError, setReservationError] = useState("");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [currentTime] = useState(() => Date.now());
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const publicBookingUrl =
    organization?.slug && origin
      ? `${origin}/book/${organization.slug}`
      : organization?.slug
        ? `/book/${organization.slug}`
        : null;
  const loading =
    status === "authenticated" && loadedOrganizationId !== organizationId;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    void Promise.all([
      getOrganization(organizationId),
      listBookables(organizationId),
      listOrganizationReservations(organizationId),
    ])
      .then(([nextOrganization, nextBookables, nextReservations]) => {
        if (cancelled) return;
        setOrganization(nextOrganization);
        setBookables(nextBookables);
        setReservations(nextReservations);
        setLoadedOrganizationId(organizationId);
        setBookablesLoaded(true);
        setReservationsLoaded(true);
      })
      .catch((caught) => {
        if (!cancelled) {
          setErrorStatus(caught instanceof ApiError ? caught.statusCode : 500);
          setLoadedOrganizationId(organizationId);
          setBookablesLoaded(true);
          setReservationsLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId, status]);

  const upcomingReservationList = reservations
    .filter(
      (reservation) =>
        new Date(reservation.startAt).getTime() > currentTime &&
        (reservation.status === "PENDING" ||
          reservation.status === "CONFIRMED"),
    )
    .sort(
      (left, right) =>
        new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
    );
  const upcomingReservations = upcomingReservationList.slice(0, 5);
  const pendingReservationList = reservations
    .filter(
      (reservation) =>
        reservation.status === "PENDING" &&
        reservation.bookable.confirmationPolicy === "REQUIRES_APPROVAL",
    )
    .sort(
      (left, right) =>
        new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
    );
  const pendingReservations = pendingReservationList.slice(0, 5);
  const publishedBookables = bookables.filter(
    ({ status: bookableStatus }) => bookableStatus === "PUBLISHED",
  ).length;
  const draftBookables = bookables.filter(
    ({ status: bookableStatus }) => bookableStatus === "DRAFT",
  ).length;
  const archivedBookables = bookables.filter(
    ({ status: bookableStatus }) => bookableStatus === "ARCHIVED",
  ).length;

  async function copyOrganizationLink() {
    if (!organization?.slug) return;
    const path = `/book/${organization.slug}`;
    const href = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setReservationError(
        "We could not copy the public booking link. Please try again.",
      );
    }
  }

  async function refreshReservations() {
    const nextReservations = await listOrganizationReservations(organizationId);
    setReservations(nextReservations);
  }

  async function handleReservationAction(
    reservation: OrganizationReservation,
    action: "approve" | "reject",
  ) {
    setPendingActionId(reservation.id);
    setReservationError("");
    try {
      if (action === "approve") {
        await approveOrganizationReservation(organizationId, reservation.id);
      } else {
        await rejectOrganizationReservation(organizationId, reservation.id);
      }
      await refreshReservations();
    } catch (caught) {
      setReservationError(
        getUserFacingError(
          caught,
          action === "approve"
            ? "Unable to approve this reservation."
            : "Unable to reject this reservation.",
        ),
      );
    } finally {
      setPendingActionId(null);
    }
  }

  if (status === "loading")
    return (
      <main className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">
        Checking your session...
      </main>
    );
  if (!user) return null;

  return (
    <PageContainer>
      <main className="py-0">
        {loading && (
          <p className="text-sm text-slate-500">Loading workspace...</p>
        )}
        {!loading && errorStatus === 403 && (
          <WorkspaceStatePanel
            eyebrow="Access denied"
            title="You do not have access to this workspace"
            description="Ask an owner to share or confirm access before opening this workspace again."
            primaryHref="/dashboard"
            primaryLabel="Back to dashboard"
            secondaryHref="/organizations"
            secondaryLabel="View workspaces"
          />
        )}
        {!loading && errorStatus === 404 && (
          <WorkspaceStatePanel
            eyebrow="Workspace unavailable"
            title="We could not find this workspace"
            description="This workspace may have been removed, archived, or is no longer available to your account."
            primaryHref="/dashboard"
            primaryLabel="Back to dashboard"
            secondaryHref="/organizations"
            secondaryLabel="View workspaces"
          />
        )}
        {!loading &&
          errorStatus !== null &&
          errorStatus !== 403 &&
          errorStatus !== 404 && (
            <WorkspaceStatePanel
              eyebrow="Temporary issue"
              title="We could not open this workspace right now"
              description="Something went wrong while loading this workspace. Please try again in a moment."
              primaryHref="/dashboard"
              primaryLabel="Back to dashboard"
              secondaryHref="/organizations"
              secondaryLabel="View workspaces"
            />
          )}
        {!loading && errorStatus === null && organization && (
          <section className="space-y-6">
            <header className="rounded-[18px] border border-slate-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Workspace overview
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {organization.name}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                      {organization.slug}
                    </span>
                    <span>{organization.timezone}</span>
                  </div>
                </div>

                <div className="flex max-w-full flex-wrap items-center gap-2 sm:justify-end">
                  {publicBookingUrl && (
                    <>
                      <a
                        className="inline-flex min-h-10 min-w-0 max-w-full items-center gap-2 rounded-[6px] border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                        href={publicBookingUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open public booking page"
                      >
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                        Public page
                      </a>
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-w-10 px-3"
                        onClick={() => void copyOrganizationLink()}
                        aria-label={
                          copied
                            ? "Copied public booking link"
                            : "Copy public booking link"
                        }
                        title={copied ? "Copied" : "Copy link"}
                      >
                        {copied ? (
                          <Check className="size-4" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                        <span className="hidden sm:inline">
                          {copied ? "Copied" : "Copy link"}
                        </span>
                      </Button>
                    </>
                  )}
                  <Button
                    className="max-w-full"
                    onClick={() =>
                      router.push(
                        `/organizations/${organizationId}/bookables/new`,
                      )
                    }
                  >
                    <Plus className="size-4" /> Create Bookable
                  </Button>
                </div>
              </div>
            </header>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryStat
                label="Total bookables"
                value={bookables.length}
                icon={ClipboardList}
              />
              <SummaryStat
                label="Published"
                value={publishedBookables}
                icon={Globe2}
              />
              <SummaryStat
                label="Draft"
                value={draftBookables}
                icon={FilePenLine}
              />
              <SummaryStat
                label="Archived"
                value={archivedBookables}
                icon={Archive}
              />
              <SummaryStat
                label="Pending reservations"
                value={pendingReservationList.length}
                icon={Inbox}
              />
              <SummaryStat
                label="Upcoming reservations"
                value={upcomingReservationList.length}
                icon={CalendarClock}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.78fr)]">
              <section className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Public booking catalog
                </p>
                <h2 className="mt-2 text-base font-semibold text-slate-950">
                  Share this workspace
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Customers browse published bookables from this page.
                </p>
                {publicBookingUrl ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <code className="min-w-0 max-w-full truncate rounded-[6px] bg-slate-100 px-2 py-2 text-[11px] text-slate-600">
                      {publicBookingUrl}
                    </code>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    A public booking link will be available when this workspace
                    has a slug.
                  </p>
                )}
              </section>

              <section className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Quick actions
                </p>
                <div className="mt-4 grid gap-2">
                  <Button
                    className="justify-between"
                    onClick={() =>
                      router.push(
                        `/organizations/${organizationId}/bookables/new`,
                      )
                    }
                  >
                    <span className="inline-flex items-center gap-2">
                      <Plus className="size-4" /> Create Bookable
                    </span>
                    <ArrowRight className="size-4" />
                  </Button>
                  <Link
                    className="flex min-h-10 items-center justify-between rounded-[6px] border border-slate-300 px-4 text-[13px] font-medium text-slate-800 hover:bg-slate-50"
                    href={`/organizations/${organizationId}/bookables`}
                  >
                    Manage Bookables <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    className="flex min-h-10 items-center justify-between rounded-[6px] border border-slate-300 px-4 text-[13px] font-medium text-slate-800 hover:bg-slate-50"
                    href={`/organizations/${organizationId}/reservations`}
                  >
                    View Reservations <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    className="flex min-h-10 items-center justify-between rounded-[6px] border border-slate-300 px-4 text-[13px] font-medium text-slate-800 hover:bg-slate-50"
                    href={`/organizations/${organizationId}/settings/payments`}
                  >
                    Workspace Settings <ArrowRight className="size-4" />
                  </Link>
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 pb-1">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    Bookables
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Resources customers can reserve in this workspace
                  </p>
                </div>
                <Link
                  className="inline-flex items-center gap-2 rounded-[6px] border border-slate-300 bg-white px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
                  href={`/organizations/${organizationId}/bookables`}
                >
                  View all
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
              {!bookablesLoaded ? (
                <div className="divide-y divide-slate-200 border-y border-slate-200">
                  <Skeleton className="h-20 rounded-none" />
                  <Skeleton className="h-20 rounded-none" />
                </div>
              ) : bookables.length === 0 ? (
                <EmptyState
                  title="No Bookables yet"
                  description="Create your first Bookable to start accepting reservations"
                  action={
                    <Button
                      onClick={() =>
                        router.push(
                          `/organizations/${organizationId}/bookables/new`,
                        )
                      }
                    >
                      Create Bookable
                    </Button>
                  }
                />
              ) : (
                <BookableOverview
                  organizationId={organizationId}
                  bookables={bookables.slice(0, 4)}
                />
              )}
            </div>

            <ReservationSection
              title="Upcoming reservations"
              description="Confirmed and pending bookings with a future start time"
              reservations={upcomingReservations}
              organizationTimezone={organization.timezone}
              loaded={reservationsLoaded}
              emptyTitle="No upcoming reservations"
              emptyDescription="Future bookings will appear here once customers reserve a published bookable."
              footerHref={`/organizations/${organizationId}/reservations`}
              footerLabel="View all"
            />

            <section>
              <div className="flex items-end justify-between gap-4 pb-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    Pending requests
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Reservations waiting for operator approval
                  </p>
                </div>
                <Link
                  className="inline-flex shrink-0 items-center gap-2 rounded-[6px] border border-slate-300 bg-white px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
                  href={`/organizations/${organizationId}/reservations?status=PENDING`}
                >
                  View pending
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
              {reservationError && (
                <p
                  className="mb-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  role="alert"
                >
                  {reservationError}
                </p>
              )}
              {!reservationsLoaded ? (
                <ReservationSkeleton />
              ) : pendingReservations.length === 0 ? (
                <EmptyState
                  title="No pending requests"
                  description="Approval requests will appear here when a customer submits one."
                />
              ) : (
                <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
                  {pendingReservations.map((reservation) => (
                    <ReservationRow
                      key={reservation.id}
                      reservation={reservation}
                      organizationTimezone={organization.timezone}
                      actionId={pendingActionId}
                      onAction={handleReservationAction}
                      showActions
                    />
                  ))}
                </div>
              )}
            </section>
          </section>
        )}
      </main>
    </PageContainer>
  );
}

function WorkspaceStatePanel({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}) {
  return (
    <section className="mx-auto max-w-2xl rounded-[18px] border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-8">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
        <span aria-hidden="true">!</span>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-[6px] bg-indigo-500 px-4 text-[13px] font-medium text-white hover:bg-indigo-600"
          href={primaryHref}
        >
          {primaryLabel}
        </Link>
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-[6px] border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          href={secondaryHref}
        >
          {secondaryLabel}
        </Link>
      </div>
    </section>
  );
}

function SummaryStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof ClipboardList;
}) {
  return (
    <div className="rounded-[12px] border border-slate-200 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
          {label}
        </p>
        <Icon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  );
}

function ReservationSection({
  title,
  description,
  reservations,
  organizationTimezone,
  loaded,
  emptyTitle,
  emptyDescription,
  footerHref,
  footerLabel,
}: {
  title: string;
  description: string;
  reservations: OrganizationReservation[];
  organizationTimezone: string;
  loaded: boolean;
  emptyTitle: string;
  emptyDescription: string;
  footerHref: string;
  footerLabel: string;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 pb-3">
        <div className="min-w-0">
          <h2 className="min-w-0 truncate text-base font-semibold text-slate-950">
            {title}
          </h2>
          <p className="mt-1 hidden text-sm text-slate-500 sm:block">
            {description}
          </p>
        </div>
        <Link
          className="inline-flex shrink-0 items-center gap-2 rounded-[6px] border border-slate-300 bg-white px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
          href={footerHref}
        >
          {footerLabel}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
      {!loaded ? (
        <ReservationSkeleton />
      ) : reservations.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
          {reservations.map((reservation) => (
            <ReservationRow
              key={reservation.id}
              reservation={reservation}
              organizationTimezone={organizationTimezone}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReservationRow({
  reservation,
  organizationTimezone,
  actionId,
  onAction,
  showActions = false,
}: {
  reservation: OrganizationReservation;
  organizationTimezone: string;
  actionId?: string | null;
  onAction?: (
    reservation: OrganizationReservation,
    action: "approve" | "reject",
  ) => void;
  showActions?: boolean;
}) {
  const processing = actionId === reservation.id;
  const paymentStatus = reservation.payment?.status;

  return (
    <div className="grid gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(190px,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-950">
            {reservation.customer.name}
          </p>
          <Badge
            className="shrink-0"
            variant={reservation.status === "CONFIRMED" ? "success" : "warning"}
          >
            {reservation.status}
          </Badge>
        </div>
        <p
          className="mt-1 hidden truncate text-xs text-slate-500 lg:block"
          title={reservation.bookable.name}
        >
          {reservation.customer.email} · {reservation.bookable.name}
        </p>
        <p
          className="mt-1 truncate text-xs text-slate-500 lg:hidden"
          title={reservation.bookable.name}
        >
          {reservation.bookable.name}
        </p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-slate-700 lg:hidden">
        <span className="min-w-0 truncate">
          {formatZonedDateTime(reservation.startAt, organizationTimezone)}
        </span>
        <span className="shrink-0 font-medium text-slate-900">
          {formatMoneyMinorUnits(reservation.amount, reservation.currency)}
        </span>
      </div>
      <div className="hidden text-sm text-slate-700 lg:block">
        <div className="flex items-center gap-2">
          <CalendarDays
            className="size-3.5 text-slate-400"
            aria-hidden="true"
          />
          <span>
            {formatZonedDateTime(reservation.startAt, organizationTimezone)}
          </span>
        </div>
        <p className="text-slate-500 lg:mt-1 lg:pl-5">
          Ends {formatZonedDateTime(reservation.endAt, organizationTimezone)} ·{" "}
          {reservation.quantity} guest{reservation.quantity === 1 ? "" : "s"}
        </p>
      </div>
      <div
        className={`flex flex-wrap items-center gap-2 lg:justify-end ${
          showActions ? "" : "hidden lg:flex"
        }`}
      >
        <span className="hidden text-xs font-medium text-slate-700 lg:inline">
          {formatMoneyMinorUnits(reservation.amount, reservation.currency)}
        </span>
        {paymentStatus && (
          <Badge
            className="hidden lg:inline-flex"
            variant={paymentStatus === "SUCCEEDED" ? "success" : "neutral"}
          >
            {paymentStatus}
          </Badge>
        )}
        {showActions && onAction && (
          <div className="flex gap-2">
            <Button
              type="button"
              className="min-h-9 px-3 text-xs"
              disabled={processing}
              onClick={() => onAction(reservation, "approve")}
            >
              <Check className="size-3.5" /> Approve
            </Button>
            <Button
              type="button"
              variant="danger"
              className="min-h-9 px-3 text-xs"
              disabled={processing}
              onClick={() => onAction(reservation, "reject")}
            >
              <X className="size-3.5" /> Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReservationSkeleton() {
  return (
    <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
      <Skeleton className="h-24 rounded-none" />
      <Skeleton className="h-24 rounded-none" />
    </div>
  );
}
