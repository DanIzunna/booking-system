"use client";

import Link from "next/link";
import { Archive, ArrowLeft, ArrowRight, Pencil } from "lucide-react";
import { FormEvent, use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../../../lib/api/client";
import {
  archiveBookable,
  getBookable,
  restoreBookable,
  updateBookable,
} from "../../../../../lib/api/bookables";
import { listAvailabilityWindows } from "../../../../../lib/api/availability";
import { listOrganizations } from "../../../../../lib/api/organizations";
import { useSession } from "../../../../../lib/auth/session-provider";
import { formatLocalTime } from "../../../../../lib/timezone";
import {
  formatMoneyMinorUnits,
  toMajorUnits,
} from "../../../../../lib/currency";
import type {
  Bookable,
  BookableStatus,
  PricingType,
} from "../../../../../types/bookables";
import type { AvailabilityWindow } from "../../../../../types/availability";
import type { MembershipRole } from "../../../../../types/organizations";
import styles from "../../../../dashboard.module.css";
import { PageContainer } from "../../../../../components/layout/page-container";
import { BookableStatus as BookableStatusBadge } from "../../../../../components/bookables/bookable-status";
import { PublicBookingLink } from "../../../../../components/bookables/public-booking-link";
import { BookableImageManager } from "../../../../../components/bookables/bookable-image-manager";
import { Button } from "../../../../../components/ui/button";

const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const shortWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface BookablePageProps {
  params: Promise<{ organizationId: string; bookableId: string }>;
}

export default function BookablePage({ params }: BookablePageProps) {
  const { organizationId, bookableId } = use(params);
  const router = useRouter();
  const { status, user } = useSession();
  const [bookable, setBookable] = useState<Bookable | null>(null);
  const [role, setRole] = useState<MembershipRole | null>(null);
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [organizationTimezone, setOrganizationTimezone] = useState("UTC");
  const [availability, setAvailability] = useState<AvailabilityWindow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [pricingType, setPricingType] = useState<PricingType>("FREE");
  const [confirmationPolicy, setConfirmationPolicy] = useState<
    "AUTOMATIC" | "REQUIRES_APPROVAL"
  >("AUTOMATIC");
  const [durationMode, setDurationMode] = useState<"FIXED" | "FLEXIBLE">(
    "FIXED",
  );
  const [fixedDuration, setFixedDuration] = useState("3600");
  const [minimumDuration, setMinimumDuration] = useState("3600");
  const [maximumDuration, setMaximumDuration] = useState("7200");

  const fixedDurationOptions = [
    { label: "1 hour", value: "3600" },
    { label: "2 hours", value: "7200" },
    { label: "3 hours", value: "10800" },
    { label: "4 hours", value: "14400" },
  ];

  const flexibleDurationOptions = [
    { label: "1 hour", value: "3600" },
    { label: "2 hours", value: "7200" },
    { label: "3 hours", value: "10800" },
    { label: "4 hours", value: "14400" },
    { label: "6 hours", value: "21600" },
    { label: "8 hours", value: "28800" },
  ];
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const loading = status === "authenticated" && !loaded;
  const canManage = role === "OWNER";

  const recurringAvailability = useMemo(() => {
    const grouped = new Map<number, string[]>();

    for (const window of availability) {
      if (
        window.type !== "RECURRING" ||
        window.weekday === null ||
        !window.startTime ||
        !window.endTime
      ) {
        continue;
      }

      const label = `${formatLocalTime(window.startTime)} – ${formatLocalTime(window.endTime)}`;
      const values = grouped.get(window.weekday) ?? [];
      grouped.set(window.weekday, [...values, label]);
    }

    const byTimeSet = new Map<string, number[]>();

    for (const [weekdayIndex, labels] of Array.from(grouped.entries()).sort(
      ([left], [right]) => left - right,
    )) {
      const uniqueLabels = [...new Set(labels)];
      const key = uniqueLabels.join("||");
      const days = byTimeSet.get(key) ?? [];
      byTimeSet.set(key, [...days, weekdayIndex]);
    }

    return Array.from(byTimeSet.entries()).map(([key, weekdayIndexes]) => {
      const labels = key.split("||");
      const ranges = buildDayRanges(weekdayIndexes);

      return {
        dayLabel: ranges
          .map(({ startIndex, endIndex }) =>
            formatDayRange(startIndex, endIndex),
          )
          .join(", "),
        labels,
      };
    });
  }, [availability]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    void Promise.all([
      getBookable(bookableId),
      listOrganizations(),
      listAvailabilityWindows(bookableId),
    ])
      .then(([nextBookable, organizations, nextAvailability]) => {
        if (cancelled) return;
        if (nextBookable.organizationId !== organizationId) {
          setErrorStatus(404);
          setLoaded(true);
          return;
        }

        const organization = organizations.find(
          ({ id }) => id === organizationId,
        );
        setBookable(nextBookable);
        setRole(organization?.role ?? null);
        setOrganizationSlug(organization?.slug ?? "");
        setOrganizationTimezone(organization?.timezone ?? "UTC");
        setAvailability(
          nextAvailability.filter((window) => window.type === "RECURRING"),
        );
        setName(nextBookable.name);
        setDescription(nextBookable.description ?? "");
        setCapacity(String(nextBookable.capacity));
        setPricingType(nextBookable.pricingType);
        setPrice(
          nextBookable.price === null
            ? ""
            : String(toMajorUnits(nextBookable.price)),
        );
        setCurrency(nextBookable.currency?.toUpperCase() ?? "");
        setConfirmationPolicy(nextBookable.confirmationPolicy ?? "AUTOMATIC");
        setDurationMode(nextBookable.reservationRule?.durationMode ?? "FIXED");
        setFixedDuration(
          String(nextBookable.reservationRule?.fixedDuration ?? 3600),
        );
        setMinimumDuration(
          String(nextBookable.reservationRule?.minimumDuration ?? 3600),
        );
        setMaximumDuration(
          String(nextBookable.reservationRule?.maximumDuration ?? 7200),
        );
        setLoaded(true);
      })
      .catch((caught) => {
        if (cancelled) return;
        setErrorStatus(caught instanceof ApiError ? caught.statusCode : 500);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [bookableId, organizationId, status]);

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationError("");

    if (pricingType === "PAID") {
      const parsedPrice = Number(price);
      if (!Number.isInteger(parsedPrice) || parsedPrice < 1) {
        setMutationError("Price must be a positive integer for paid Bookables.");
        return;
      }
      if (!/^[A-Z]{3}$/.test(currency.trim().toUpperCase())) {
        setMutationError("Currency must be exactly 3 uppercase letters.");
        return;
      }
    }

    if (durationMode === "FIXED") {
      const parsedFixedDuration = Number(fixedDuration);
      if (!Number.isFinite(parsedFixedDuration) || parsedFixedDuration <= 0) {
        setMutationError("Choose a valid fixed duration greater than zero.");
        return;
      }
    } else {
      const parsedMinimumDuration = Number(minimumDuration);
      const parsedMaximumDuration = Number(maximumDuration);

      if (
        !Number.isFinite(parsedMinimumDuration) ||
        parsedMinimumDuration <= 0
      ) {
        setMutationError("Minimum duration must be greater than zero.");
        return;
      }
      if (
        !Number.isFinite(parsedMaximumDuration) ||
        parsedMaximumDuration <= 0
      ) {
        setMutationError("Maximum duration must be greater than zero.");
        return;
      }
      if (parsedMinimumDuration > parsedMaximumDuration) {
        setMutationError("Minimum duration cannot exceed maximum duration.");
        return;
      }
    }

    setPendingAction("update");
    try {
      const updated = await updateBookable(bookableId, {
        name: name.trim(),
        description: description.trim() || undefined,
        capacity: Number(capacity),
        pricingType,
        price: pricingType === "PAID" ? Number(price) : null,
        currency: pricingType === "PAID" ? currency.trim().toUpperCase() : null,
        confirmationPolicy,
        reservationRule: {
          durationMode,
          ...(durationMode === "FIXED"
            ? { fixedDuration: Number(fixedDuration) }
            : {
                minimumDuration: Number(minimumDuration),
                maximumDuration: Number(maximumDuration),
              }),
        },
      });
      setBookable(updated);
      setEditing(false);
    } catch (caught) {
      setMutationError(
        caught instanceof ApiError
          ? formatMutationError(caught)
          : "Unable to update this bookable.",
      );
    } finally {
      setPendingAction("");
    }
  }

  function handlePricingTypeChange(nextPricingType: PricingType) {
    setPricingType(nextPricingType);
    setPrice("");
    setCurrency("");
    setMutationError("");
  }

  async function handleStatus(statusValue: BookableStatus) {
    if (!bookable) return;
    const label = statusValue === "PUBLISHED" ? "publish" : "archive";
    setMutationError("");
    setPendingAction(label);
    try {
      const updated =
        statusValue === "ARCHIVED"
          ? await archiveBookable(bookableId)
          : await updateBookable(bookableId, { status: statusValue });
      setBookable(updated);
      if (statusValue === "PUBLISHED") {
        router.push(`/organizations/${organizationId}/bookables`);
        return;
      }
    } catch (caught) {
      setMutationError(
        caught instanceof ApiError
          ? formatMutationError(caught)
          : `Unable to ${label} this bookable.`,
      );
    } finally {
      setPendingAction("");
    }
  }

  async function handleRestore() {
    if (!bookable) return;
    setMutationError("");
    setPendingAction("restore");
    try {
      const updated = await restoreBookable(bookableId);
      setBookable(updated);
      setConfirmRestore(false);
    } catch (caught) {
      setMutationError(
        caught instanceof ApiError
          ? formatMutationError(caught)
          : "Unable to restore this bookable.",
      );
    } finally {
      setPendingAction("");
    }
  }

  const canPublish = Boolean(bookable?.reservationRule);

  if (status === "loading")
    return (
      <main className="min-h-screen bg-slate-50 p-10 text-sm text-slate-500">
        Checking your session...
      </main>
    );
  if (!user) return null;

  return (
    <PageContainer>
      <main className="px-0 py-0">
        <Link
          className="mb-8 flex min-h-11 w-fit items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
          href={`/organizations/${organizationId}/bookables`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to bookables</span>
        </Link>
        {loading && <p className={styles.message}>Loading bookable...</p>}
        {!loading && errorStatus === 403 && (
          <ErrorState
            title="Access denied"
            message="You do not have permission to view this bookable."
          />
        )}
        {!loading && errorStatus === 404 && (
          <ErrorState
            title="Bookable not found"
            message="This resource is unavailable or does not belong to this workspace."
          />
        )}
        {!loading &&
          errorStatus !== null &&
          errorStatus !== 403 &&
          errorStatus !== 404 && (
            <ErrorState
              title="Unable to load bookable"
              message="Please try again shortly."
            />
          )}
        {!loading && errorStatus === null && bookable && (
          <>
            <p className={styles.eyebrow}>Bookable</p>
            <div className={styles.pageHeading}>
              <div>
                <h1>{bookable.name}</h1>
              </div>
            </div>

            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className={styles.sectionLabel}>Details</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <DetailItem
                  label="Status"
                  value={<BookableStatusBadge status={bookable.status} />}
                />
                <DetailItem
                  label="Capacity"
                  value={formatCapacity(bookable.capacity)}
                />
                <DetailItem
                  label="Pricing"
                  value={
                    bookable.pricingType === "FREE"
                      ? "Free"
                      : formatMoneyMinorUnits(bookable.price, bookable.currency)
                  }
                />
                <DetailItem
                  label="Confirmation"
                  value={formatConfirmationPolicy(bookable.confirmationPolicy)}
                />
                <DetailItem
                  label="Reservation duration"
                  value={formatReservationDuration(bookable.reservationRule)}
                />
              </div>
              <p className="mt-4 text-sm text-slate-600">
                {bookable.description || "No description provided."}
              </p>
            </section>

            {role !== null && <BookableImageManager bookableId={bookableId} />}

            <section className={styles.availabilitySection}>
              <p className={styles.sectionLabel}>Availability</p>
              <h2>Weekly schedule</h2>
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Timezone:</span>{" "}
                  {organizationTimezone}
                </p>
                {recurringAvailability.length === 0 ? (
                  <p className={styles.message}>
                    No recurring availability configured yet.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm text-slate-700">
                    {recurringAvailability.map(({ dayLabel, labels }) => (
                      <li key={`${dayLabel}-${labels.join("|")}`}>
                        <span className="font-semibold text-slate-900">
                          {dayLabel}
                        </span>
                        <span className="text-slate-600">
                          {" "}
                          · {labels.join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Link
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
                href={`/organizations/${organizationId}/bookables/${bookableId}/availability`}
              >
                <span>Manage availability</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </section>

            <section className={styles.availabilitySection}>
              <p className={styles.sectionLabel}>Public booking</p>
              <h2>Share this Bookable</h2>
              <p className={styles.message}>
                Customers can use this link to make reservations once the
                Bookable is published.
              </p>
              <PublicBookingLink
                organizationSlug={organizationSlug}
                slug={bookable.slug}
                enabled={bookable.status === "PUBLISHED"}
              />
            </section>
            {mutationError && (
              <p className={styles.error} role="alert">
                {mutationError}
              </p>
            )}
            {confirmArchive && (
              <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
                <p className="text-sm font-semibold text-rose-900">
                  Archive this bookable?
                </p>
                <p className="mt-2 text-sm text-rose-700">
                  It will no longer be active for reservations.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className="min-h-10 rounded-[6px] border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                    type="button"
                    onClick={() => setConfirmArchive(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="min-h-10 rounded-[6px] border border-rose-200 bg-rose-600 px-4 text-[13px] font-medium text-white hover:bg-rose-500"
                    type="button"
                    onClick={() => {
                      setConfirmArchive(false);
                      void handleStatus("ARCHIVED");
                    }}
                  >
                    Archive
                  </button>
                </div>
              </div>
            )}
            {confirmRestore && (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <p className="text-sm font-semibold text-amber-900">
                  Restore this bookable?
                </p>
                <p className="mt-2 text-sm text-amber-700">
                  It will return as a Draft and will not immediately become
                  publicly bookable.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className="min-h-10 rounded-[6px] border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                    type="button"
                    onClick={() => setConfirmRestore(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="min-h-10 rounded-[6px] border border-amber-200 bg-amber-600 px-4 text-[13px] font-medium text-white hover:bg-amber-500"
                    type="button"
                    onClick={() => {
                      void handleRestore();
                    }}
                  >
                    {pendingAction === "restore" ? "Restoring..." : "Restore"}
                  </button>
                </div>
              </div>
            )}
            {canManage && !editing && (
              <div className={styles.actionRow}>
                <Button
                  type="button"
                  className="min-h-11 min-w-11 px-3 sm:min-h-10 sm:min-w-0 sm:px-4"
                  onClick={() => setEditing(true)}
                  aria-label="Edit details"
                  title="Edit details"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Edit details</span>
                </Button>
                {bookable.status === "DRAFT" && (
                  <button
                    className={styles.primaryButton}
                    type="button"
                    disabled={Boolean(pendingAction) || !canPublish}
                    onClick={() => void handleStatus("PUBLISHED")}
                  >
                    {pendingAction === "publish" ? "Publishing..." : "Publish"}
                  </button>
                )}
                {bookable.status === "ARCHIVED" ? (
                  <button
                    className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[6px] border border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber-800 transition-colors hover:border-amber-300 hover:bg-amber-100 sm:min-h-10 sm:min-w-0 sm:px-4"
                    type="button"
                    disabled={Boolean(pendingAction)}
                    onClick={() => setConfirmRestore(true)}
                    aria-label="Restore bookable"
                    title="Restore bookable"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {pendingAction === "restore" ? "Restoring..." : "Restore"}
                    </span>
                  </button>
                ) : (
                  <button
                    className={`${styles.dangerButton} inline-flex min-h-11 min-w-11 items-center justify-center gap-2 px-3 sm:min-h-10 sm:min-w-0 sm:px-4`}
                    type="button"
                    disabled={Boolean(pendingAction)}
                    onClick={() => setConfirmArchive(true)}
                    aria-label="Archive bookable"
                    title="Archive bookable"
                  >
                    <Archive className="size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {pendingAction === "archive" ? "Archiving..." : "Archive"}
                    </span>
                  </button>
                )}
              </div>
            )}
            {canManage && bookable.status === "DRAFT" && !canPublish && (
              <p className={styles.note} role="status">
                Configure a reservation length before publishing this Bookable.
                Use Edit details to add one.
              </p>
            )}
            {editing && canManage && (
              <form className={styles.bookableForm} onSubmit={handleUpdate}>
                <label className={styles.formField}>
                  Name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </label>
                <label className={styles.formField}>
                  Description
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={styles.formField}>
                    Capacity
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={capacity}
                      onChange={(event) => setCapacity(event.target.value)}
                      required
                    />
                  </label>
                  <fieldset className={styles.formField}>
                    <legend>Pricing</legend>
                    <select
                      value={pricingType}
                      onChange={(event) =>
                        handlePricingTypeChange(event.target.value as PricingType)
                      }
                    >
                      <option value="FREE">Free</option>
                      <option value="PAID">Paid</option>
                    </select>
                    {pricingType === "PAID" && (
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <label className={styles.formField}>
                          Price
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={price}
                            onChange={(event) => setPrice(event.target.value)}
                            required
                          />
                        </label>
                        <label className={styles.formField}>
                          Currency
                          <select
                            value={currency}
                            onChange={(event) =>
                              setCurrency(event.target.value)
                            }
                            required
                          >
                            <option value="">Select a currency</option>
                            <option value="NGN">NGN</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                          </select>
                        </label>
                      </div>
                    )}
                    {pricingType === "FREE" && (
                      <p className="mt-2 text-sm text-slate-500">
                        Free Bookables do not require a price or currency.
                      </p>
                    )}
                  </fieldset>
                </div>
                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                      Confirmation policy
                    </p>
                    <div className="space-y-3">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={confirmationPolicy === "AUTOMATIC"}
                        onClick={() => setConfirmationPolicy("AUTOMATIC")}
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${
                          confirmationPolicy === "AUTOMATIC"
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <span className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className={`mt-0.5 grid size-4 place-items-center rounded-full border ${
                              confirmationPolicy === "AUTOMATIC"
                                ? "border-white bg-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            <span
                              className={`size-2 rounded-full ${confirmationPolicy === "AUTOMATIC" ? "bg-slate-900" : "bg-transparent"}`}
                            />
                          </span>
                          <span className="flex-1">
                            <span className="block font-medium">Automatic</span>
                            <span
                              className={`mt-1 block text-xs ${confirmationPolicy === "AUTOMATIC" ? "text-slate-200" : "text-slate-500"}`}
                            >
                              Confirm reservations automatically.
                            </span>
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        role="radio"
                        aria-checked={
                          confirmationPolicy === "REQUIRES_APPROVAL"
                        }
                        onClick={() =>
                          setConfirmationPolicy("REQUIRES_APPROVAL")
                        }
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${
                          confirmationPolicy === "REQUIRES_APPROVAL"
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <span className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className={`mt-0.5 grid size-4 place-items-center rounded-full border ${
                              confirmationPolicy === "REQUIRES_APPROVAL"
                                ? "border-white bg-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            <span
                              className={`size-2 rounded-full ${confirmationPolicy === "REQUIRES_APPROVAL" ? "bg-slate-900" : "bg-transparent"}`}
                            />
                          </span>
                          <span className="flex-1">
                            <span className="block font-medium">
                              Requires approval
                            </span>
                            <span
                              className={`mt-1 block text-xs ${confirmationPolicy === "REQUIRES_APPROVAL" ? "text-slate-200" : "text-slate-500"}`}
                            >
                              Reservations remain pending until an operator
                              approves them.
                            </span>
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>
                <fieldset className={styles.formField}>
                  <legend className="mb-3 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                    Reservation duration
                  </legend>
                  <div className="space-y-3">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={durationMode === "FIXED"}
                      onClick={() => setDurationMode("FIXED")}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        durationMode === "FIXED"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 grid size-4 place-items-center rounded-full border ${
                            durationMode === "FIXED"
                              ? "border-white bg-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          <span
                            className={`size-2 rounded-full ${durationMode === "FIXED" ? "bg-slate-900" : "bg-transparent"}`}
                          />
                        </span>
                        <span className="flex-1">
                          <span className="block font-medium">
                            Fixed duration
                          </span>
                          <span
                            className={`mt-1 block text-xs ${durationMode === "FIXED" ? "text-slate-200" : "text-slate-500"}`}
                          >
                            Customers book predefined time slots.
                          </span>
                        </span>
                      </span>
                    </button>

                    {durationMode === "FIXED" && (
                      <div className="ml-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:ml-2">
                        <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                          Duration
                        </label>
                        <select
                          aria-label="Reservation length"
                          value={fixedDuration}
                          onChange={(event) =>
                            setFixedDuration(event.target.value)
                          }
                          className={`${styles.formInput} mt-2`}
                        >
                          {fixedDurationOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      type="button"
                      role="radio"
                      aria-checked={durationMode === "FLEXIBLE"}
                      onClick={() => setDurationMode("FLEXIBLE")}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        durationMode === "FLEXIBLE"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 grid size-4 place-items-center rounded-full border ${
                            durationMode === "FLEXIBLE"
                              ? "border-white bg-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          <span
                            className={`size-2 rounded-full ${durationMode === "FLEXIBLE" ? "bg-slate-900" : "bg-transparent"}`}
                          />
                        </span>
                        <span className="flex-1">
                          <span className="block font-medium">
                            Flexible duration
                          </span>
                          <span
                            className={`mt-1 block text-xs ${durationMode === "FLEXIBLE" ? "text-slate-200" : "text-slate-500"}`}
                          >
                            Customers choose a duration within a defined range.
                          </span>
                        </span>
                      </span>
                    </button>

                    {durationMode === "FLEXIBLE" && (
                      <div className="ml-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:ml-2">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                            Minimum duration
                            <select
                              aria-label="Minimum duration"
                              value={minimumDuration}
                              onChange={(event) =>
                                setMinimumDuration(event.target.value)
                              }
                              className={`${styles.formInput} mt-2`}
                            >
                              {flexibleDurationOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                            Maximum duration
                            <select
                              aria-label="Maximum duration"
                              value={maximumDuration}
                              onChange={(event) =>
                                setMaximumDuration(event.target.value)
                              }
                              className={`${styles.formInput} mt-2`}
                            >
                              {flexibleDurationOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </fieldset>
                <div className={styles.actionRow}>
                  <button
                    className={styles.primaryButton}
                    type="submit"
                    disabled={Boolean(pendingAction)}
                  >
                    {pendingAction === "update" ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {!canManage && (
              <p className={styles.note}>
                Only workspace owners can edit, publish, or archive bookables.
              </p>
            )}
          </>
        )}
      </main>
    </PageContainer>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-sm text-slate-900">{value}</div>
    </div>
  );
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <section className={styles.state}>
      <p className={styles.eyebrow}>{title}</p>
      <h1>We could not open this bookable.</h1>
      <p className={styles.message}>{message}</p>
    </section>
  );
}

function formatConfirmationPolicy(policy?: Bookable["confirmationPolicy"]) {
  if (policy === "REQUIRES_APPROVAL") return "Requires approval";
  if (policy === "AUTOMATIC") return "Automatic";
  return "Not configured";
}

function formatCapacity(capacity: number): string {
  return String(capacity);
}

function formatReservationDuration(rule: Bookable["reservationRule"]) {
  if (!rule) return "Not configured";
  if (rule.durationMode === "FIXED") {
    return rule.fixedDuration
      ? `${rule.fixedDuration / 60} minutes`
      : "Not configured";
  }

  const minimum = rule.minimumDuration ?? 0;
  const maximum = rule.maximumDuration ?? 0;
  if (!minimum || !maximum) return "Flexible";
  return `${minimum / 60}–${maximum / 60} minutes`;
}

function buildDayRanges(weekdayIndexes: number[]) {
  if (weekdayIndexes.length === 0) return [];

  const ranges: { startIndex: number; endIndex: number }[] = [];
  let start = weekdayIndexes[0];
  let previous = weekdayIndexes[0];

  for (let index = 1; index < weekdayIndexes.length; index += 1) {
    const current = weekdayIndexes[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }

    ranges.push({ startIndex: start, endIndex: previous });
    start = current;
    previous = current;
  }

  ranges.push({ startIndex: start, endIndex: previous });
  return ranges;
}

function formatDayRange(startIndex: number, endIndex: number) {
  const startName = shortWeekdays[startIndex] ?? `Day ${startIndex}`;
  const endName = shortWeekdays[endIndex] ?? `Day ${endIndex}`;

  if (startIndex === endIndex) {
    return weekdays[startIndex] ?? `Day ${startIndex}`;
  }

  return `${startName}–${endName}`;
}

function formatMutationError(error: ApiError): string {
  if (error.statusCode === 403)
    return "Only a workspace owner can change this bookable.";
  if (error.statusCode === 404) return "This bookable is no longer available.";
  if (error.statusCode === 409)
    return "That slug is already in use. Choose another one.";
  if (error.statusCode === 400)
    return error.message || "Check the bookable details and try again.";
  return "Unable to save this change. Please try again.";
}
