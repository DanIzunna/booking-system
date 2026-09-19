"use client";

import Link from "next/link";
import {
  ArrowLeft,
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
import { ApiError } from "../../../lib/api/client";
import {
  getOrganization,
  listOrganizations,
} from "../../../lib/api/organizations";
import { listBookables } from "../../../lib/api/bookables";
import {
  approveOrganizationReservation,
  listOrganizationReservations,
  rejectOrganizationReservation,
} from "../../../lib/api/reservations";
import { useSession } from "../../../lib/auth/session-provider";
import { formatMoneyMinorUnits } from "../../../lib/currency";
import { formatZonedDateTime } from "../../../lib/timezone";
import type {
  Organization,
  MembershipRole,
} from "../../../types/organizations";
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
  const [role, setRole] = useState<MembershipRole | null>(null);
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
      listOrganizations(),
      listBookables(organizationId),
      listOrganizationReservations(organizationId),
    ])
      .then(
        ([
          nextOrganization,
          memberships,
          nextBookables,
          nextReservations,
        ]) => {
        if (cancelled) return;
        setOrganization(nextOrganization);
        setRole(
          memberships.find(({ id }) => id === organizationId)?.role ?? null,
        );
        setBookables(nextBookables);
        setReservations(nextReservations);
        setLoadedOrganizationId(organizationId);
        setBookablesLoaded(true);
        setReservationsLoaded(true);
      },
      )
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
      setReservationError("Unable to copy the public booking link.");
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
        caught instanceof ApiError
          ? caught.message
          : `Unable to ${action} this reservation.`,
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
      <main className="-mt-3 px-0 py-0">
        <Link
          className="mb-8 flex min-h-11 w-fit items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
          href="/dashboard"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to workspaces
        </Link>
        {loading && (
          <p className="mt-10 text-sm text-slate-500">Loading workspace...</p>
        )}
        {!loading && errorStatus === 403 && (
          <section className="mt-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">
              Access denied
            </p>
            <h1 className="mt-3 text-3xl font-bold">
              You cannot access this workspace.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Your account does not have permission to view this workspace.
            </p>
          </section>
        )}
        {!loading && errorStatus === 404 && (
          <section className="mt-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">
              Workspace not found
            </p>
            <h1 className="mt-3 text-3xl font-bold">
              This workspace is unavailable.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              The workspace may not exist, or you may no longer belong to it.
            </p>
          </section>
        )}
        {!loading &&
          errorStatus !== null &&
          errorStatus !== 403 &&
          errorStatus !== 404 && (
            <section className="mt-10 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">
                Unable to load
              </p>
              <h1 className="mt-3 text-3xl font-bold">
                We could not open this workspace.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Please try again shortly.
              </p>
            </section>
          )}
        {!loading && errorStatus === null && organization && (
          <section className="mt-8 space-y-10">
            <div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Workspace overview
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {organization.name}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  {organization.slug} · {organization.timezone}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Organization role: {role ?? "MEMBER"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-950">
                    {user.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Signed in</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
              <section className="border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Public booking catalog
                </p>
                <h2 className="mt-2 text-base font-semibold text-slate-950">
                  Share this workspace
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Customers can browse published bookables from this page.
                </p>
                {organization.slug ? (
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <code className="min-w-0 max-w-full truncate rounded-[4px] bg-slate-100 px-2 py-2 text-xs text-slate-600">
                      {origin
                        ? `${origin}/book/${organization.slug}`
                        : `/book/${organization.slug}`}
                    </code>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-w-10 px-3"
                      onClick={() => void copyOrganizationLink()}
                      aria-label={
                        copied ? "Copied public booking link" : "Copy public booking link"
                      }
                      title={copied ? "Copied" : "Copy link"}
                    >
                      {copied ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      <span className="hidden sm:inline">
                        {copied ? "Copied" : "Copy"}
                      </span>
                    </Button>
                    <a
                      className="inline-flex min-h-10 items-center gap-1 rounded-[6px] px-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      href={`/book/${organization.slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="size-3.5" />
                      Open
                    </a>
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-slate-400">
                    A public booking link will be available when this workspace has a slug.
                  </p>
                )}
              </section>

              <section className="border border-slate-200 bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Quick actions
                </p>
                <div className="mt-4 grid gap-2">
                  <Button
                    className="justify-between"
                    onClick={() =>
                      router.push(`/organizations/${organizationId}/bookables/new`)
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
                </div>
              </section>
            </div>

            <div>
              <div className="flex items-center justify-between pb-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    Bookables
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Resources customers can reserve in this workspace
                  </p>
                </div>
                <Link
                  className="text-sm font-medium text-slate-700 hover:text-slate-950"
                  href={`/organizations/${organizationId}/bookables`}
                >
                  View all
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
              footerLabel="View all reservations"
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
                  className="shrink-0 text-sm font-medium text-slate-700 hover:text-slate-950"
                  href={`/organizations/${organizationId}/reservations?status=PENDING`}
                >
                  View all
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
    <div className="border border-slate-200 bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
          {label}
        </p>
        <Icon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
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
      <div className="flex items-end justify-between gap-4 pb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <Link
          className="shrink-0 text-sm font-medium text-slate-700 hover:text-slate-950"
          href={footerHref}
        >
          {footerLabel}
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
    <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(190px,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-950">
            {reservation.customer.name}
          </p>
          <Badge variant={reservation.status === "CONFIRMED" ? "success" : "warning"}>
            {reservation.status}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">
          {reservation.customer.email} · {reservation.bookable.name}
        </p>
      </div>
      <div className="text-sm text-slate-700">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-3.5 text-slate-400" aria-hidden="true" />
          <span>{formatZonedDateTime(reservation.startAt, organizationTimezone)}</span>
        </div>
        <p className="mt-1 pl-5 text-xs text-slate-500">
          Ends {formatZonedDateTime(reservation.endAt, organizationTimezone)} · {reservation.quantity} guest{reservation.quantity === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <span className="text-xs font-medium text-slate-700">
          {formatMoneyMinorUnits(reservation.amount, reservation.currency)}
        </span>
        {paymentStatus && <Badge variant={paymentStatus === "SUCCEEDED" ? "success" : "neutral"}>{paymentStatus}</Badge>}
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
