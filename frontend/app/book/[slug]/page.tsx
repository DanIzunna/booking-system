"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
} from "lucide-react";
import { use, useEffect, useState, type ReactNode } from "react";
import { ApiError } from "../../../lib/api/client";
import {
  confirmFreeReservation,
  createReservation,
} from "../../../lib/api/reservations";
import {
  getPublicAvailability,
  getPublicBookable,
} from "../../../lib/api/public-booking";
import { useSession } from "../../../lib/auth/session-provider";
import { formatTimeZoneName, formatZonedDateTime } from "../../../lib/timezone";
import type {
  PublicAvailabilityResponse,
  PublicAvailabilitySlot,
  PublicBookable,
} from "../../../types/public-booking";
import type { ReservationConfirmation } from "../../../types/reservations";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

interface PublicBookingPageProps {
  params: Promise<{ slug: string }>;
}

type BookingStep = "schedule" | "details" | "review";

export default function PublicBookingPage({ params }: PublicBookingPageProps) {
  const { slug } = use(params);
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
  const [submitting, setSubmitting] = useState(false);
  const [reservationError, setReservationError] = useState("");
  const [confirmation, setConfirmation] =
    useState<ReservationConfirmation | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPublicBookable(slug)
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
  }, [slug]);

  useEffect(() => {
    if (!date || !bookable) return;
    let cancelled = false;
    void getPublicAvailability(slug, date, Number(quantity))
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
  }, [availabilityRefresh, bookable, date, quantity, slug]);

  async function submitReservation() {
    if (!bookable || !selectedSlot || sessionStatus !== "authenticated") return;
    setReservationError("");
    setSubmitting(true);
    try {
      const created = await createReservation(
        bookable.id,
        bookable.reservationRule?.durationMode === "FIXED"
          ? { startAt: selectedSlot.startAt, quantity: Number(quantity) }
          : {
              startAt: selectedSlot.startAt,
              endAt: selectedSlot.endAt,
              quantity: Number(quantity),
            },
      );
      if (created.amount !== 0) {
        setReservationError(
          "Your reservation was created, but payment is not available yet.",
        );
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

  if (loading) return <PublicShell><LoadingState /></PublicShell>;
  if (errorStatus !== null || !bookable) {
    return (
      <PublicShell>
        <StatePanel
          title={errorStatus === 404 ? "This booking page is unavailable" : "We could not load this booking page"}
          message={errorStatus === 404 ? "Check the link and try again, or ask the organizer for a current booking link." : "Please try again shortly."}
        />
      </PublicShell>
    );
  }
  if (confirmation) return <PublicShell><ConfirmationState confirmation={confirmation} /></PublicShell>;

  const fixedSlots = availability?.durationMode === "FIXED" ? availability.slots : [];
  const total = bookable.price * Number(quantity || 0);

  return (
    <PublicShell>
      <header className="border-b border-slate-200 pb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{bookable.organization.name}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{bookable.name}</h1>
        {bookable.description && <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{bookable.description}</p>}
        <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3"><CalendarDays className="size-4" aria-hidden="true" /> {formatTimeZoneName(bookable.organization.timezone)}</span>
          <span className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3">Capacity {bookable.capacity}</span>
          <span className="inline-flex min-h-10 items-center rounded-[6px] border border-slate-200 bg-white px-3">{formatMoney(bookable.price, bookable.currency)} per unit</span>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section aria-labelledby="booking-step-heading">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{step === "schedule" ? "Step 1" : step === "details" ? "Step 2" : "Step 3"}</p><h2 id="booking-step-heading" className="mt-2 text-xl font-semibold text-slate-950">{step === "schedule" ? "Select a date and time" : step === "details" ? "Your details" : "Review your request"}</h2></div>
            <span className="text-xs text-slate-400">{formatTimeZoneName(bookable.organization.timezone)}</span>
          </div>

          {step === "schedule" && <div className="mt-6 grid gap-5">
            <div className="rounded-[8px] border border-slate-200 bg-white p-5"><Label htmlFor="booking-date">Select a date</Label><Input id="booking-date" className="mt-2" type="date" min={today} value={date} onChange={(event) => { setDate(event.target.value); setAvailability(null); setLoadedQuantity(null); setAvailabilityError(""); setSelectedSlot(null); }} /><p className="mt-2 text-xs text-slate-500">Times are shown in the workspace timezone.</p></div>
            <div className="rounded-[8px] border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-3"><Clock3 className="mt-0.5 size-4 text-slate-500" aria-hidden="true" /><div><h3 className="text-sm font-semibold text-slate-950">Available times</h3><p className="mt-1 text-sm leading-6 text-slate-500">{durationLabel ?? "Select a date to see availability."}</p></div></div>
              {availabilityLoading && <p className="mt-5 text-sm text-slate-500" aria-live="polite">Loading available times...</p>}
              {availabilityError && <p className="mt-5 text-sm text-rose-700" role="alert">{availabilityError}</p>}
              {reservationError && <p className="mt-5 text-sm text-rose-700" role="alert">{reservationError}</p>}
              {!availabilityLoading && !availabilityError && availability?.durationMode === null && <p className="mt-5 border-l-2 border-amber-300 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">This booking is not available yet. The organizer has not finished configuring booking times.</p>}
              {!availabilityLoading && !availabilityError && availability?.durationMode === "FLEXIBLE" && <p className="mt-5 border-l-2 border-amber-300 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">This booking uses flexible duration and does not have selectable time slots yet.</p>}
              {!availabilityLoading && !availabilityError && availability?.durationMode === "FIXED" && fixedSlots.length === 0 && <p className="mt-5 text-sm text-slate-500">No available times for this date. Try another date.</p>}
              {!availabilityLoading && fixedSlots.length > 0 && availability && <div className="mt-5 grid gap-2 sm:grid-cols-2" aria-label="Available times">{fixedSlots.map((slot) => <button key={slot.startAt} type="button" aria-pressed={selectedSlot?.startAt === slot.startAt} className={`flex min-h-11 items-center justify-between rounded-[6px] border px-3 text-left text-sm font-medium transition-colors ${selectedSlot?.startAt === slot.startAt ? "border-zinc-950 bg-zinc-950 text-white" : "border-slate-300 bg-white text-slate-800 hover:border-slate-500 hover:bg-slate-50"}`} onClick={() => setSelectedSlot(slot)}><span>{formatTime(slot.startAt, availability.timezone)}</span><span className="text-xs opacity-70">{durationLabel}</span></button>)}</div>}
              <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><Label htmlFor="booking-quantity">Quantity</Label><Input id="booking-quantity" className="mt-2 w-24" type="number" min="1" max={bookable.capacity} value={quantity} onChange={(event) => { setQuantity(event.target.value); setAvailabilityError(""); setSelectedSlot(null); }} /></div><Button type="button" disabled={!selectedSlot} onClick={() => setStep("details")}>Continue <ArrowRight className="size-4" aria-hidden="true" /></Button></div>
            </div>
          </div>}
          {step === "details" && <DetailsStep sessionStatus={sessionStatus} user={user} onBack={() => setStep("schedule")} onContinue={() => setStep("review")} />}
          {step === "review" && <ReviewStep bookable={bookable} date={date} slot={selectedSlot} timezone={availability?.timezone ?? bookable.organization.timezone} quantity={quantity} total={total} user={user} submitting={submitting} error={reservationError} onBack={() => setStep("details")} onConfirm={() => void submitReservation()} />}
        </section>
        <aside className="h-fit rounded-[8px] border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Your booking</p><p className="mt-3 text-sm font-semibold text-slate-950">{bookable.name}</p><dl className="mt-5 grid gap-3 text-sm"><SummaryRow label="Date" value={date ? formatDate(date) : "Not selected"} /><SummaryRow label="Time" value={selectedSlot && availability ? formatTimeRange(selectedSlot, availability.timezone) : "Not selected"} /><SummaryRow label="Quantity" value={quantity} /><SummaryRow label="Total" value={formatMoney(total, bookable.currency)} /></dl></aside>
      </div>
    </PublicShell>
  );
}

function DetailsStep({ sessionStatus, user, onBack, onContinue }: { sessionStatus: string; user: { name: string; email: string } | null; onBack: () => void; onContinue: () => void }) {
  return <div className="mt-6 rounded-[8px] border border-slate-200 bg-white p-5"><h3 className="text-sm font-semibold text-slate-950">Customer details</h3>{sessionStatus === "authenticated" && user ? <div className="mt-4 rounded-[6px] bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-950">{user.name}</p><p className="mt-1 text-slate-500">{user.email}</p></div> : <div className="mt-4 border-l-2 border-slate-200 pl-3 text-sm leading-6 text-slate-600">Sign in before confirming a reservation.</div>}<div className="mt-6 flex flex-wrap justify-between gap-3"><Button type="button" variant="secondary" onClick={onBack}><ArrowLeft className="size-4" aria-hidden="true" /> Back</Button>{sessionStatus === "authenticated" && user ? <Button type="button" onClick={onContinue}>Review request <ArrowRight className="size-4" aria-hidden="true" /></Button> : <Link className="inline-flex min-h-10 items-center justify-center rounded-[6px] bg-zinc-950 px-4 text-[13px] font-medium text-white hover:bg-zinc-800" href="/login">Sign in to continue</Link>}</div></div>;
}

function ReviewStep({ bookable, date, slot, timezone, quantity, total, user, submitting, error, onBack, onConfirm }: { bookable: PublicBookable; date: string; slot: PublicAvailabilitySlot | null; timezone: string; quantity: string; total: number; user: { name: string; email: string } | null; submitting: boolean; error: string; onBack: () => void; onConfirm: () => void }) {
  const paid = total > 0;
  return <div className="mt-6 rounded-[8px] border border-slate-200 bg-white p-5"><h3 className="text-sm font-semibold text-slate-950">Review request</h3><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><SummaryRow label="Bookable" value={bookable.name} /><SummaryRow label="Workspace" value={bookable.organization.name} /><SummaryRow label="Date" value={formatDate(date)} /><SummaryRow label="Time" value={slot ? formatTimeRange(slot, timezone) : "Not selected"} /><SummaryRow label="Timezone" value={formatTimeZoneName(timezone)} /><SummaryRow label="Quantity" value={quantity} /><SummaryRow label="Customer" value={user?.email ?? "Sign-in required"} /><SummaryRow label="Total" value={formatMoney(total, bookable.currency)} /></dl>{paid && <p className="mt-5 border-l-2 border-amber-300 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">Payment is not available yet. No paid reservation will be confirmed.</p>}{error && <p className="mt-5 text-sm text-rose-700" role="alert">{error}</p>}<div className="mt-6 flex flex-wrap justify-between gap-3"><Button type="button" variant="secondary" onClick={onBack}><ArrowLeft className="size-4" aria-hidden="true" /> Back to details</Button><Button type="button" disabled={submitting || paid || !slot || !user} onClick={onConfirm}>{submitting && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}{paid ? "Payment required" : "Confirm reservation"}</Button></div></div>;
}

function ConfirmationState({ confirmation }: { confirmation: ReservationConfirmation }) { return <section className="rounded-[8px] border border-slate-200 bg-white p-6"><Check className="size-6 text-emerald-600" aria-hidden="true" /><p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Confirmed</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Reservation confirmed</h1><p className="mt-2 text-sm text-slate-600">Your reservation for {confirmation.bookable.name} is confirmed.</p><dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><SummaryRow label="Reference" value={confirmation.id} /><SummaryRow label="Workspace" value={confirmation.bookable.organization.name} /><SummaryRow label="When" value={formatZonedDateTime(confirmation.startAt, confirmation.bookable.organization.timezone)} /><SummaryRow label="Timezone" value={formatTimeZoneName(confirmation.bookable.organization.timezone)} /><SummaryRow label="Quantity" value={String(confirmation.quantity)} /><SummaryRow label="Total" value={formatMoney(confirmation.amount, confirmation.currency)} /></dl><Link className="mt-7 inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50" href="/"><ArrowLeft className="size-4" aria-hidden="true" /> Return to Bookable</Link></section>; }

function SummaryRow({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-900">{value}</dd></div>; }
function PublicShell({ children }: { children: ReactNode }) { return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:py-12"><div className="mx-auto w-full max-w-5xl"><header className="mb-10 flex items-center justify-between"><Link className="flex items-center gap-2 text-sm font-semibold text-slate-950" href="/"><span className="grid size-8 place-items-center rounded-[6px] bg-zinc-950 text-xs font-bold text-white">B</span>Bookable</Link><span className="text-xs text-slate-500">Public booking</span></header>{children}<footer className="mt-12 border-t border-slate-200 pt-5 text-xs text-slate-400">© 2026 Bookable</footer></div></main>; }
function LoadingState() { return <div className="space-y-4" aria-busy="true"><div className="h-8 w-2/3 animate-pulse rounded-[6px] bg-slate-200" /><div className="h-4 w-full animate-pulse rounded-[6px] bg-slate-200" /><div className="h-48 rounded-[8px] border border-slate-200 bg-white" /></div>; }
function StatePanel({ title, message }: { title: string; message: string }) { return <section className="rounded-[8px] border border-slate-200 bg-white p-6"><Check className="size-5 text-slate-500" aria-hidden="true" /><h1 className="mt-4 text-xl font-semibold">{title}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{message}</p><Link className="mt-6 inline-flex min-h-10 items-center rounded-[6px] border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50" href="/">Return to Bookable</Link></section>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`)); }
function formatTime(value: string, timezone: string) { return new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeStyle: "short" }).format(new Date(value)); }
function formatTimeRange(slot: PublicAvailabilitySlot, timezone: string) { return `${formatTime(slot.startAt, timezone)} – ${formatTime(slot.endAt, timezone)}`; }
function formatMoney(amount: number, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100); }
function describeDuration(rule: PublicBookable["reservationRule"] | undefined) { if (!rule) return null; if (rule.durationMode === "FIXED" && rule.fixedDuration) return `${Math.round(rule.fixedDuration / 60)} minute booking`; return rule.durationMode === "FLEXIBLE" ? "Flexible duration" : null; }
