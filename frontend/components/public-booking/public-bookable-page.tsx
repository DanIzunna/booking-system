"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
} from "lucide-react";
import { use, useEffect, useState } from "react";
import { ApiError } from "../../lib/api/client";
import {
  confirmFreeReservation,
  createReservation,
} from "../../lib/api/reservations";
import {
  getPublicAvailability,
  getPublicBookable,
  checkPublicAvailability,
} from "../../lib/api/public-booking";
import { useSession } from "../../lib/auth/session-provider";
import {
  addLocalMinutes,
  formatTimeZoneName,
  formatZonedDateTime,
  localDateTimeToIso,
} from "../../lib/timezone";
import { formatMoneyMinorUnits } from "../../lib/currency";
import {
  buildFlexibleDurationOptions,
  formatDurationHuman,
} from "../../lib/duration";
import type {
  PublicAvailabilityResponse,
  PublicAvailabilitySlot,
  PublicBookable,
} from "../../types/public-booking";
import type {
  ReservationConfirmation,
  ReservationResult,
} from "../../types/reservations";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { CustomerShell } from "../layout/customer-shell";
import { PublicShell } from "../public/public-shell";
import {
  clearBookingSelection,
  loadBookingSelection,
  saveBookingSelection,
} from "../../lib/public-booking/booking-selection";

interface PublicBookingPageProps {
  params: Promise<{ organizationSlug: string; bookableSlug: string }>;
}

type BookingStep = "schedule" | "details" | "review";

export default function PublicBookingPage({ params }: PublicBookingPageProps) {
  const { organizationSlug, bookableSlug } = use(params);
  const { status: sessionStatus, user } = useSession();
  const [bookable, setBookable] = useState<PublicBookable | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [step, setStep] = useState<BookingStep>("schedule");
  const [date, setDate] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [availability, setAvailability] =
    useState<PublicAvailabilityResponse | null>(null);
  const [loadedQuantity, setLoadedQuantity] = useState<number | null>(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0);
  const [selectedSlot, setSelectedSlot] =
    useState<PublicAvailabilitySlot | null>(null);
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<number | null>(
    null,
  );
  const [availabilityCheck, setAvailabilityCheck] = useState<
    "idle" | "checking" | "available" | "unavailable"
  >("idle");
  const [availabilityCheckMessage, setAvailabilityCheckMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reservationError, setReservationError] = useState("");
  const [confirmation, setConfirmation] =
    useState<ReservationConfirmation | null>(null);
  const [requestSubmitted, setRequestSubmitted] =
    useState<ReservationResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPublicBookable(organizationSlug, bookableSlug)
      .then((nextBookable) => {
        if (!cancelled) setBookable(nextBookable);
      })
      .catch((caught) => {
        if (!cancelled)
          setErrorStatus(caught instanceof ApiError ? caught.statusCode : 500);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookableSlug, organizationSlug]);

  useEffect(() => {
    const saved = loadBookingSelection();
    if (
      !saved ||
      saved.organizationSlug !== organizationSlug ||
      saved.bookableSlug !== bookableSlug
    ) {
      if (saved) clearBookingSelection();
      return;
    }
    const timezone = bookable?.organization.timezone;
    if (!timezone) return;
    const localStart = formatLocalDateTimeInput(new Date(saved.startAt), timezone);
    if (!localStart.startsWith(`${saved.date}T`)) {
      clearBookingSelection();
      return;
    }

    const restore = window.setTimeout(() => {
      setDate(saved.date);
      setQuantity(String(saved.quantity));
      if (saved.endAt && saved.durationSeconds) {
        setSelectedStartTime(localStart);
        setSelectedDuration(saved.durationSeconds);
      } else {
        setSelectedSlot({
          startAt: saved.startAt,
          endAt: saved.startAt,
        });
      }
      clearBookingSelection();
    }, 0);
    return () => window.clearTimeout(restore);
  }, [bookable, bookableSlug, organizationSlug]);

  useEffect(() => {
    if (!date || !bookable) return;
    let cancelled = false;
    void getPublicAvailability(
      organizationSlug,
      bookableSlug,
      date,
      Number(quantity),
    )
      .then((result) => {
        if (!cancelled) {
          setAvailability(result);
          setLoadedQuantity(Number(quantity));
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setAvailabilityError(
            caught instanceof ApiError && caught.statusCode === 404
              ? "This booking page is no longer available."
              : "We could not load availability for that date.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    availabilityRefresh,
    bookable,
    bookableSlug,
    date,
    organizationSlug,
    quantity,
  ]);

  const reservationRule = bookable?.reservationRule;

  const isFlexible = reservationRule?.durationMode === "FLEXIBLE";
  const effectiveSelectedSlot =
    reservationRule?.durationMode === "FIXED" &&
    availability?.durationMode === "FIXED" &&
    selectedSlot &&
    selectedSlot.endAt === selectedSlot.startAt
      ? availability.slots.find((slot) => slot.startAt === selectedSlot.startAt) ??
        selectedSlot
      : selectedSlot;
  const flexibleStartTimes =
    isFlexible && availability?.durationMode === "FLEXIBLE"
      ? buildFlexibleStartTimes(
          availability.intervals,
          availability.timezone,
          reservationRule?.minimumDuration ?? null,
          date,
        )
      : [];
  const flexibleSelection =
    isFlexible && availability?.durationMode === "FLEXIBLE"
      ? deriveFlexibleSelection(
          selectedStartTime,
          selectedDuration,
          availability.intervals,
          availability.timezone,
        )
      : null;
  const flexibleInterval =
    isFlexible && availability?.durationMode === "FLEXIBLE"
      ? findFlexibleInterval(
          selectedStartTime,
          availability.intervals,
          availability.timezone,
        )
      : null;
  const flexibleDurationOptions = flexibleInterval
    ? buildFlexibleDurationOptions(
        reservationRule?.minimumDuration,
        Math.min(
          reservationRule?.maximumDuration ?? 0,
          flexibleInterval.maximumDuration,
        ),
      ).filter((duration) =>
        selectionFitsInterval(
          selectedStartTime,
          duration,
          flexibleInterval.interval,
          availability?.timezone ?? "UTC",
        ),
      )
    : [];

  useEffect(() => {
    if (
      !isFlexible ||
      !bookable ||
      !availability ||
      availability.durationMode !== "FLEXIBLE" ||
      availability.date !== date ||
      loadedQuantity !== Number(quantity) ||
      !selectedStartTime ||
      selectedDuration === null
    ) {
      return;
    }

    const selection = deriveFlexibleSelection(
      selectedStartTime,
      selectedDuration,
      availability.intervals,
      availability.timezone,
    );
    if (!selection) return;

    let cancelled = false;
    const check = async () => {
      setAvailabilityCheck("checking");
      setAvailabilityCheckMessage("");
      try {
        const result = await checkPublicAvailability(
          organizationSlug,
          bookableSlug,
          {
            startAt: selection.slot.startAt,
            endAt: selection.slot.endAt,
            quantity: Number(quantity),
          },
        );
        if (cancelled) return;
        setAvailabilityCheck(result.available ? "available" : "unavailable");
        setAvailabilityCheckMessage(
          result.available
            ? "Available"
            : availabilityReasonMessage(result.reason),
        );
      } catch (caught) {
        if (cancelled) return;
        setAvailabilityCheck("unavailable");
        setAvailabilityCheckMessage(
          caught instanceof ApiError && caught.statusCode === 409
            ? "This selection is no longer available. Choose another time."
            : "We could not check this selection. Try again.",
        );
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [
    availability,
    bookable,
    bookableSlug,
    date,
    isFlexible,
    loadedQuantity,
    organizationSlug,
    quantity,
    selectedDuration,
    selectedStartTime,
  ]);

  async function submitReservation() {
    const bookingSlot = isFlexible ? flexibleSelection?.slot : effectiveSelectedSlot;
    if (!bookable || !bookingSlot || sessionStatus !== "authenticated") return;
    setReservationError("");
    setSubmitting(true);
    try {
      const created = await createReservation(
        bookable.id,
        bookable.reservationRule?.durationMode === "FIXED"
          ? { startAt: bookingSlot.startAt, quantity: Number(quantity) }
          : {
              startAt: bookingSlot.startAt,
              endAt: bookingSlot.endAt,
              quantity: Number(quantity),
            },
      );
      if (bookable.pricingType === "PAID") {
        setReservationError(
          "Your reservation was created, but payment is not available yet.",
        );
        return;
      }
      clearBookingSelection();
      if (bookable.confirmationPolicy === "REQUIRES_APPROVAL") {
        setRequestSubmitted(created);
        return;
      }
      setConfirmation(await confirmFreeReservation(created.id));
    } catch (caught) {
      if (caught instanceof ApiError && caught.statusCode === 401) {
        setReservationError("Your session has expired. Sign in to continue.");
      } else if (caught instanceof ApiError && caught.statusCode === 409) {
        setReservationError(
          "That time is no longer available. Choose another slot.",
        );
        setStep("schedule");
        setAvailability(null);
        setSelectedSlot(null);
        setAvailabilityRefresh((value) => value + 1);
      } else {
        setReservationError(
          "We could not complete this reservation. Please try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const durationLabel = describeDuration(bookable?.reservationRule);
  const availabilityLoading = Boolean(
    date &&
    bookable &&
    !availabilityError &&
    (availability?.date !== date || loadedQuantity !== Number(quantity)),
  );

  if (loading)
    return (
      <BookingExperienceShell authenticated={sessionStatus === "authenticated" && !!user}>
        <LoadingState />
      </BookingExperienceShell>
    );
  if (errorStatus !== null || !bookable) {
    return (
      <BookingExperienceShell authenticated={sessionStatus === "authenticated" && !!user}>
        <StatePanel
          title={
            errorStatus === 404
              ? "This booking page is unavailable"
              : "We could not load this booking page"
          }
          message={
            errorStatus === 404
              ? "Check the link and try again, or ask the organizer for a current booking link."
              : "Please try again shortly."
          }
          returnHref={organizationSlug ? `/book/${organizationSlug}` : "/"}
          returnLabel={organizationSlug ? "Back to catalog" : "Return to Bookable"}
        />
      </BookingExperienceShell>
    );
  }
  if (confirmation)
    return sessionStatus === "authenticated" && user ? (
      <BookingExperienceShell authenticated>
        <ConfirmationState
          confirmation={confirmation}
          pricingType={bookable.pricingType}
        />
      </BookingExperienceShell>
    ) : (
      <BookingExperienceShell authenticated={false}>
        <ConfirmationState
          confirmation={confirmation}
          pricingType={bookable.pricingType}
        />
      </BookingExperienceShell>
    );
  if (requestSubmitted)
    return sessionStatus === "authenticated" && user ? (
      <BookingExperienceShell authenticated>
        <RequestSubmittedState reservation={requestSubmitted} />
      </BookingExperienceShell>
    ) : (
      <BookingExperienceShell authenticated={false}>
        <RequestSubmittedState reservation={requestSubmitted} />
      </BookingExperienceShell>
    );

  const fixedSlots =
    availability?.durationMode === "FIXED" ? availability.slots : [];
  const bookingSlot = isFlexible
    ? flexibleSelection?.slot ?? null
    : effectiveSelectedSlot ?? null;
  const canContinue = isFlexible
    ? Boolean(bookingSlot && availabilityCheck === "available")
    : Boolean(effectiveSelectedSlot);
  const total =
    bookable.pricingType === "PAID"
      ? (bookable.price ?? 0) * Number(quantity || 0)
      : 0;

  return (
    <BookingExperienceShell authenticated={sessionStatus === "authenticated" && !!user}>
      <header className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
        <Link
          className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          href={`/book/${organizationSlug}`}
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to organization
        </Link>

        <div className="relative overflow-hidden rounded-[14px] border border-slate-200 bg-slate-100">
          <div className="relative aspect-[16/9] w-full">
            {bookable.imageUrl ? (
              <Image
                src={bookable.imageUrl}
                alt={bookable.name}
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.8),_transparent_55%),linear-gradient(135deg,#f8fafc,#e2e8f0)] text-slate-500">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-200 bg-white/80 shadow-sm">
                  <CalendarDays className="size-8" aria-hidden="true" />
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {bookable.organization.name}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          {bookable.name}
        </h1>
        {bookable.description && (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {bookable.description}
          </p>
        )}
        <div className="mt-6 grid gap-2 border-t border-slate-100 pt-5 sm:grid-cols-3">
          <span className="inline-flex min-h-10 items-center gap-2 rounded-[6px] bg-slate-50 px-3 text-xs text-slate-600">
            <CalendarDays className="size-4" aria-hidden="true" />{" "}
            {formatTimeZoneName(bookable.organization.timezone)}
          </span>
          <span className="inline-flex min-h-10 items-center rounded-[6px] bg-slate-50 px-3 text-xs text-slate-600">
            Capacity {bookable.capacity} per reservation
          </span>
          <span className="inline-flex min-h-10 items-center rounded-[6px] bg-slate-50 px-3 text-xs text-slate-600">
            {bookable.pricingType === "FREE"
              ? "Free"
              : `${formatConfiguredMoney(bookable.price, bookable.currency)} per unit`}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge
            variant={
              bookable.confirmationPolicy === "REQUIRES_APPROVAL"
                ? "warning"
                : "success"
            }
          >
            {bookable.confirmationPolicy === "REQUIRES_APPROVAL"
              ? "Approval required"
              : "Instant confirmation"}
          </Badge>
          <span className="text-xs text-slate-500">
            {bookable.confirmationPolicy === "REQUIRES_APPROVAL"
              ? "Your request will be reviewed by the organization."
              : "Your reservation is confirmed after successful submission."}
          </span>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
        <section
          className="rounded-[8px] border border-slate-200 bg-slate-50 p-4 sm:p-5"
          aria-labelledby="booking-step-heading"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Booking
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {step === "schedule"
                  ? "Step 1"
                  : step === "details"
                    ? "Step 2"
                    : "Step 3"}
              </p>
              <h2
                id="booking-step-heading"
                className="mt-2 text-xl font-semibold text-slate-950"
              >
                {step === "schedule"
                  ? "Select a date and time"
                  : step === "details"
                    ? "Your details"
                    : "Review your request"}
              </h2>
            </div>
            <Badge>{formatTimeZoneName(bookable.organization.timezone)}</Badge>
          </div>

          {step === "schedule" && (
            <div className="mt-6 grid gap-5">
              <div className="rounded-[8px] border border-slate-200 bg-white p-5">
                <Label htmlFor="booking-date">Select a date</Label>
                <Input
                  id="booking-date"
                  className="mt-2"
                  type="date"
                  min={today}
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setAvailability(null);
                    setLoadedQuantity(null);
                    setAvailabilityError("");
                    setSelectedSlot(null);
                    setSelectedStartTime("");
                    setSelectedDuration(null);
                    setAvailabilityCheck("idle");
                    setAvailabilityCheckMessage("");
                  }}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Times are shown in the workspace timezone.
                </p>
              </div>
              <div className="rounded-[8px] border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <Clock3
                    className="mt-0.5 size-4 text-slate-500"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">
                      Available times
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {durationLabel ?? "Select a date to see availability."}
                    </p>
                  </div>
                </div>
                {availabilityLoading && (
                  <div className="mt-5 flex items-center gap-2" aria-live="polite">
                    <Badge variant="neutral">Checking</Badge>
                    <p className="text-sm text-slate-500">
                      Loading available times...
                    </p>
                  </div>
                )}
                {availabilityError && (
                  <div className="mt-5 flex items-start gap-2" role="alert">
                    <Badge variant="error">Unavailable</Badge>
                    <p className="text-sm leading-5 text-rose-700">
                      {availabilityError}
                    </p>
                  </div>
                )}
                {reservationError && (
                  <p className="mt-5 text-sm text-rose-700" role="alert">
                    {reservationError}
                  </p>
                )}
                {!availabilityLoading &&
                  !availabilityError &&
                  availability?.durationMode === null && (
                    <div className="mt-5 flex items-start gap-2 border-l-2 border-amber-300 bg-amber-50 px-3 py-2">
                      <Badge variant="warning">Unavailable</Badge>
                      <p className="text-sm leading-6 text-amber-900">
                        This booking is not available yet. The organizer has
                        not finished configuring booking times.
                      </p>
                    </div>
                  )}
                {!availabilityLoading &&
                  !availabilityError &&
                  availability?.durationMode === "FLEXIBLE" && (
                    <div className="mt-5 grid gap-4">
                      <div>
                        <Label htmlFor="booking-start-time">Start time</Label>
                        <select
                          id="booking-start-time"
                          value={selectedStartTime}
                          onChange={(event) => {
                            setSelectedStartTime(event.target.value);
                            setSelectedDuration(null);
                            setAvailabilityCheck("idle");
                            setAvailabilityCheckMessage("");
                          }}
                          className="mt-2 min-h-11 w-full rounded-[6px] border border-slate-300 bg-white px-3 text-sm text-slate-900"
                          disabled={flexibleStartTimes.length === 0}
                        >
                          <option value="">Select a start time</option>
                          {flexibleStartTimes.map((startTime) => (
                            <option key={startTime} value={startTime}>
                              {formatLocalTimeValue(startTime)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedStartTime && (
                        <div>
                          <Label htmlFor="booking-duration">Duration</Label>
                          <select
                            id="booking-duration"
                            value={selectedDuration ?? ""}
                            onChange={(event) => {
                              setSelectedDuration(
                                event.target.value
                                  ? Number(event.target.value)
                                  : null,
                              );
                              setAvailabilityCheck("idle");
                              setAvailabilityCheckMessage("");
                            }}
                            className="mt-2 min-h-11 w-full rounded-[6px] border border-slate-300 bg-white px-3 text-sm text-slate-900"
                            disabled={flexibleDurationOptions.length === 0}
                          >
                            <option value="">Select a duration</option>
                            {flexibleDurationOptions.map((duration) => (
                              <option key={duration} value={duration}>
                                {formatDurationHuman(duration)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {flexibleSelection && selectedDuration !== null && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <span>
                            Ends at {formatTime(flexibleSelection.slot.endAt, availability.timezone)}
                          </span>
                          <span
                            role="status"
                            aria-live="polite"
                          >
                            <Badge
                              variant={
                                availabilityCheck === "available"
                                  ? "success"
                                  : availabilityCheck === "unavailable"
                                    ? "error"
                                    : "neutral"
                              }
                            >
                              {availabilityCheck === "checking"
                                ? "Checking"
                                : availabilityCheckMessage || "Not checked"}
                            </Badge>
                          </span>
                        </div>
                      )}
                      {!flexibleStartTimes.length && (
                        <p className="text-sm text-slate-500">
                          No start times are available for this date.
                        </p>
                      )}
                    </div>
                  )}
                {!availabilityLoading &&
                  !availabilityError &&
                  availability?.durationMode === "FIXED" &&
                  fixedSlots.length === 0 && (
                    <div className="mt-5 flex items-center gap-2">
                      <Badge variant="warning">Unavailable</Badge>
                      <p className="text-sm text-slate-500">
                        No available times for this date. Try another date.
                      </p>
                    </div>
                  )}
                {!availabilityLoading &&
                  fixedSlots.length > 0 &&
                  availability && (
                    <div
                      className="mt-5 grid gap-2 sm:grid-cols-2"
                      aria-label="Available times"
                    >
                      {fixedSlots.map((slot) => (
                        <button
                          key={slot.startAt}
                          type="button"
                          aria-pressed={effectiveSelectedSlot?.startAt === slot.startAt}
                          className={`flex min-h-11 items-center justify-between rounded-[6px] border px-3 text-left text-sm font-medium transition-colors ${effectiveSelectedSlot?.startAt === slot.startAt ? "border-zinc-950 bg-zinc-950 text-white" : "border-slate-300 bg-white text-slate-800 hover:border-slate-500 hover:bg-slate-50"}`}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          <span>
                            {formatTime(slot.startAt, availability.timezone)}
                          </span>
                          <span className="text-xs opacity-70">
                            {durationLabel}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <Label htmlFor="booking-quantity">Quantity</Label>
                    <Input
                      id="booking-quantity"
                      className="mt-2 w-24"
                      type="number"
                      min="1"
                      max={bookable.capacity}
                      value={quantity}
                      onChange={(event) => {
                        setQuantity(event.target.value);
                        setAvailability(null);
                        setLoadedQuantity(null);
                        setAvailabilityError("");
                        setSelectedSlot(null);
                        setSelectedStartTime("");
                        setSelectedDuration(null);
                        setAvailabilityCheck("idle");
                        setAvailabilityCheckMessage("");
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={!canContinue}
                    onClick={() => setStep("details")}
                  >
                    Continue{" "}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          {step === "details" && (
            <DetailsStep
              organizationSlug={organizationSlug}
              bookableSlug={bookableSlug}
              date={date}
              slot={bookingSlot}
              durationSeconds={isFlexible ? selectedDuration ?? undefined : undefined}
              quantity={Number(quantity)}
              sessionStatus={sessionStatus}
              user={user}
              onBack={() => setStep("schedule")}
              onContinue={() => setStep("review")}
            />
          )}
          {step === "review" && (
            <ReviewStep
              bookable={bookable}
              date={date}
              slot={bookingSlot}
              timezone={
                availability?.timezone ?? bookable.organization.timezone
              }
              quantity={quantity}
              total={total}
              user={user}
              submitting={submitting}
              error={reservationError}
              onBack={() => setStep("details")}
              onConfirm={() => void submitReservation()}
            />
          )}
        </section>
        <aside className="h-fit rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 lg:sticky lg:top-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Booking summary
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-950">
            {bookable.name}
          </p>
          <dl className="mt-5 grid gap-3 text-sm">
            <SummaryRow
              label="Date"
              value={date ? formatDate(date) : "Not selected"}
            />
            <SummaryRow
              label="Time"
              value={
                effectiveSelectedSlot && availability
                  ? formatTimeRange(effectiveSelectedSlot, availability.timezone)
                  : "Not selected"
              }
            />
            <SummaryRow label="Quantity" value={quantity} />
            <div className="border-t border-slate-200 pt-3">
              <SummaryRow
                label="Total"
                value={
                  bookable.pricingType === "FREE"
                    ? "Free"
                    : formatMoneyMinorUnits(total, bookable.currency)
                }
              />
            </div>
          </dl>
          <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            {bookable.confirmationPolicy === "REQUIRES_APPROVAL"
              ? "Your request will be sent for approval."
              : "Your reservation will be confirmed after submission."}
          </p>
        </aside>
      </div>
    </BookingExperienceShell>
  );
}

function BookingExperienceShell({
  authenticated,
  children,
}: {
  authenticated: boolean;
  children: React.ReactNode;
}) {
  if (authenticated) {
    return (
      <CustomerShell>
        <div className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </CustomerShell>
    );
  }

  return <PublicShell context="Public booking">{children}</PublicShell>;
}

function DetailsStep({
  organizationSlug,
  bookableSlug,
  date,
  slot,
  durationSeconds,
  quantity,
  sessionStatus,
  user,
  onBack,
  onContinue,
}: {
  organizationSlug: string;
  bookableSlug: string;
  date: string;
  slot: PublicAvailabilitySlot | null;
  durationSeconds?: number;
  quantity: number;
  sessionStatus: string;
  user: { name: string; email: string } | null;
  onBack: () => void;
  onContinue: () => void;
}) {
  const returnTo = `/book/${organizationSlug}/${bookableSlug}`;

  function preserveSelection() {
    if (!date || !slot || !Number.isInteger(quantity) || quantity < 1) return;
    saveBookingSelection({
      organizationSlug,
      bookableSlug,
      date,
      startAt: slot.startAt,
      ...(durationSeconds
        ? { endAt: slot.endAt, durationSeconds }
        : {}),
      quantity,
    });
  }

  return (
    <div className="mt-6 rounded-[8px] border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-950">Customer details</h3>
      {sessionStatus === "authenticated" && user ? (
        <div className="mt-4 rounded-[6px] bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-950">{user.name}</p>
          <p className="mt-1 text-slate-500">{user.email}</p>
        </div>
      ) : (
        <div className="mt-4 border-l-2 border-slate-200 pl-3 text-sm leading-6 text-slate-600">
          Sign in before confirming a reservation.
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden="true" /> Back
        </Button>
        {sessionStatus === "authenticated" && user ? (
          <Button type="button" onClick={onContinue}>
            Review request <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-[6px] bg-zinc-950 px-4 text-[13px] font-medium text-white hover:bg-zinc-800"
            href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            onClick={preserveSelection}
          >
            Sign in to continue
          </Link>
        )}
      </div>
    </div>
  );
}

function ReviewStep({
  bookable,
  date,
  slot,
  timezone,
  quantity,
  total,
  user,
  submitting,
  error,
  onBack,
  onConfirm,
}: {
  bookable: PublicBookable;
  date: string;
  slot: PublicAvailabilitySlot | null;
  timezone: string;
  quantity: string;
  total: number;
  user: { name: string; email: string } | null;
  submitting: boolean;
  error: string;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const paid = bookable.pricingType === "PAID";
  return (
    <div className="mt-6 rounded-[8px] border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-950">Review request</h3>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <SummaryRow label="Bookable" value={bookable.name} />
        <SummaryRow label="Workspace" value={bookable.organization.name} />
        <SummaryRow label="Date" value={formatDate(date)} />
        <SummaryRow
          label="Time"
          value={slot ? formatTimeRange(slot, timezone) : "Not selected"}
        />
        <SummaryRow label="Timezone" value={formatTimeZoneName(timezone)} />
        <SummaryRow label="Quantity" value={quantity} />
        <SummaryRow
          label="Customer"
          value={user?.email ?? "Sign-in required"}
        />
        <SummaryRow
          label="Total"
          value={
            bookable.pricingType === "FREE"
              ? "Free"
              : formatMoney(total, bookable.currency)
          }
        />
      </dl>
      {paid && (
        <div className="mt-5 flex items-start gap-2 border-l-2 border-amber-300 bg-amber-50 px-3 py-2">
          <Badge variant="warning">Payment required</Badge>
          <p className="text-sm leading-6 text-amber-900">
            Payment is not available yet. No paid reservation will be
            confirmed.
          </p>
        </div>
      )}
      {error && (
        <div className="mt-5 flex items-start gap-2" role="alert">
          <Badge variant="error">Unable to complete</Badge>
          <p className="text-sm leading-5 text-rose-700">{error}</p>
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to details
        </Button>
        <Button
          type="button"
          disabled={submitting || paid || !slot || !user}
          onClick={onConfirm}
        >
          {submitting && (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          )}
          {paid ? "Payment required" : "Confirm reservation"}
        </Button>
      </div>
    </div>
  );
}

function ConfirmationState({
  confirmation,
  pricingType,
}: {
  confirmation: ReservationConfirmation;
  pricingType: PublicBookable["pricingType"];
}) {
  return (
    <section className="mx-auto max-w-3xl rounded-[18px] border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-8">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="size-8" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-6 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
        Confirmed
      </p>
      <h1 className="mt-2 text-center text-3xl font-semibold tracking-tight text-slate-950">
        Booking confirmed
      </h1>
      <p className="mt-3 text-center text-sm leading-6 text-slate-600">
        Your reservation for {confirmation.bookable.name} is confirmed.
      </p>

      <div className="mt-8 rounded-[14px] border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Reservation summary
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              {confirmation.bookable.name}
            </h2>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
            Confirmed
          </span>
        </div>

        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <SummaryRow
            label="Date & time"
            value={formatZonedDateTime(
              confirmation.startAt,
              confirmation.bookable.organization.timezone,
            )}
          />
          <SummaryRow
            label="Guests"
            value={String(confirmation.quantity)}
          />
          <SummaryRow
            label="Reservation"
            value={confirmation.id}
          />
          <SummaryRow
            label="Total"
            value={
              pricingType === "FREE"
                ? "Free"
                : formatMoneyMinorUnits(
                    confirmation.amount,
                    confirmation.currency,
                  )
            }
          />
        </dl>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-zinc-950 px-4 text-[13px] font-medium text-white hover:bg-zinc-800"
          href={`/reservations/${confirmation.id}`}
        >
          View reservation <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-[6px] border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          href="/"
        >
          Return to Bookable
        </Link>
      </div>
    </section>
  );
}

function RequestSubmittedState({
  reservation,
}: {
  reservation: ReservationResult;
}) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
        Request submitted
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Waiting for approval
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Your reservation request was submitted and will be confirmed after the
        organization approves it.
      </p>
      <SummaryRow label="Reference" value={reservation.id} />
      <Link
        className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-[6px] bg-zinc-950 px-4 text-[13px] font-medium text-white hover:bg-zinc-800"
        href={`/reservations/${reservation.id}`}
      >
        View reservation <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-900">{value}</dd>
    </div>
  );
}
function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-8 w-2/3 animate-pulse rounded-[6px] bg-slate-200" />
      <div className="h-4 w-full animate-pulse rounded-[6px] bg-slate-200" />
      <div className="h-48 rounded-[8px] border border-slate-200 bg-white" />
    </div>
  );
}
function StatePanel({
  title,
  message,
  returnHref,
  returnLabel,
}: {
  title: string;
  message: string;
  returnHref: string;
  returnLabel: string;
}) {
  return (
    <section className="mx-auto max-w-2xl rounded-[18px] border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-8">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
        <Check className="size-5" aria-hidden="true" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Public booking
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-[6px] bg-zinc-950 px-4 text-[13px] font-medium text-white hover:bg-zinc-800"
          href={returnHref}
        >
          {returnLabel}
        </Link>
      </div>
    </section>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    new Date(`${value}T12:00:00`),
  );
}
function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeStyle: "short",
  }).format(new Date(value));
}
function formatTimeRange(slot: PublicAvailabilitySlot, timezone: string) {
  return `${formatTime(slot.startAt, timezone)} – ${formatTime(slot.endAt, timezone)}`;
}
function formatMoney(amount: number, currency: string | null) {
  return formatConfiguredMoney(amount, currency);
}

function formatConfiguredMoney(
  amount: number | null,
  currency: string | null,
) {
  if (!currency) return "Price unavailable";
  return formatMoneyMinorUnits(amount, currency.trim().toUpperCase());
}
function describeDuration(rule: PublicBookable["reservationRule"] | undefined) {
  if (!rule) return null;
  if (rule.durationMode === "FIXED" && rule.fixedDuration) {
    return formatDurationHuman(rule.fixedDuration);
  }
  if (
    rule.durationMode === "FLEXIBLE" &&
    rule.minimumDuration &&
    rule.maximumDuration
  ) {
    return `${formatDurationHuman(rule.minimumDuration)} to ${formatDurationHuman(rule.maximumDuration)}`;
  }
  return rule.durationMode === "FLEXIBLE" ? "Choose a duration" : null;
}

function buildFlexibleStartTimes(
  intervals: PublicAvailabilitySlot[],
  timezone: string,
  minimumDuration: number | null,
  date: string,
): string[] {
  const minimumSeconds = Number(minimumDuration ?? 0);
  if (!minimumSeconds || !date) return [];

  const starts = new Set<string>();
  for (const interval of intervals) {
    const intervalStart = new Date(interval.startAt).getTime();
    const intervalEnd = new Date(interval.endAt).getTime();
    const latestStart = intervalEnd - minimumSeconds * 1000;

    for (
      let cursor = intervalStart;
      cursor <= latestStart;
      cursor += 15 * 60 * 1000
    ) {
      const localStart = formatLocalDateTimeInput(new Date(cursor), timezone);
      if (localStart.startsWith(`${date}T`)) starts.add(localStart);
    }
  }

  return [...starts].sort();
}

function deriveFlexibleSelection(
  startTime: string,
  duration: number | null,
  intervals: PublicAvailabilitySlot[],
  timezone: string,
) {
  if (!startTime || duration === null) return null;

  const selection = findFlexibleInterval(startTime, intervals, timezone);
  if (!selection) return null;

  const endLocal = addLocalMinutes(startTime, duration / 60);
  const endAt = localDateTimeToIso(endLocal, timezone);

  return {
    ...selection,
    slot: { startAt: selection.startAt, endAt },
  };
}

function findFlexibleInterval(
  startTime: string,
  intervals: PublicAvailabilitySlot[],
  timezone: string,
) {
  if (!startTime) return null;

  const startAt = localDateTimeToIso(startTime, timezone);
  const selectedTime = new Date(startAt).getTime();
  const interval = intervals.find((candidate) => {
    const start = new Date(candidate.startAt).getTime();
    const end = new Date(candidate.endAt).getTime();
    return selectedTime >= start && selectedTime < end;
  });
  if (!interval) return null;

  return {
    interval,
    startAt,
    maximumDuration:
      (new Date(interval.endAt).getTime() - selectedTime) / 1000,
  };
}

function selectionFitsInterval(
  startTime: string,
  duration: number,
  interval: PublicAvailabilitySlot,
  timezone: string,
) {
  const startAt = localDateTimeToIso(startTime, timezone);
  const endAt = localDateTimeToIso(
    addLocalMinutes(startTime, duration / 60),
    timezone,
  );
  return (
    new Date(startAt).getTime() >= new Date(interval.startAt).getTime() &&
    new Date(endAt).getTime() <= new Date(interval.endAt).getTime()
  );
}

function formatLocalDateTimeInput(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(value)
    .filter(({ type }) => type !== "literal")
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function formatLocalTimeValue(value: string) {
  const [, time] = value.split("T");
  const [rawHour, rawMinute] = time.split(":").map(Number);
  const suffix = rawHour >= 12 ? "PM" : "AM";
  const hour = rawHour % 12 || 12;
  return `${hour}:${String(rawMinute).padStart(2, "0")} ${suffix}`;
}

function availabilityReasonMessage(reason?: string) {
  if (reason === "CAPACITY_EXCEEDED") return "Not available for this quantity.";
  if (reason === "OUTSIDE_AVAILABILITY") {
    return "This time is outside the available hours.";
  }
  return "This selection is not available.";
}
