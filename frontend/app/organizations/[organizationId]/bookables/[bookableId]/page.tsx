"use client";

import Link from "next/link";
import { Archive, ArrowLeft, ArrowRight, Pencil } from "lucide-react";
import { FormEvent, use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../../../lib/api/client";
import {
  archiveBookable,
  getBookable,
  updateBookable,
} from "../../../../../lib/api/bookables";
import { listOrganizations } from "../../../../../lib/api/organizations";
import { useSession } from "../../../../../lib/auth/session-provider";
import type { Bookable, BookableStatus } from "../../../../../types/bookables";
import type { MembershipRole } from "../../../../../types/organizations";
import styles from "../../../../dashboard.module.css";
import { PageContainer } from "../../../../../components/layout/page-container";
import { BookableStatus as BookableStatusBadge } from "../../../../../components/bookables/bookable-status";
import { PublicBookingLink } from "../../../../../components/bookables/public-booking-link";
import { Button } from "../../../../../components/ui/button";

interface BookablePageProps {
  params: Promise<{ organizationId: string; bookableId: string }>;
}

export default function BookablePage({ params }: BookablePageProps) {
  const { organizationId, bookableId } = use(params);
  const router = useRouter();
  const { status, user } = useSession();
  const [bookable, setBookable] = useState<Bookable | null>(null);
  const [role, setRole] = useState<MembershipRole | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("");
  const [durationMode, setDurationMode] = useState<"FIXED" | "FLEXIBLE">("FIXED");
  const [fixedDuration, setFixedDuration] = useState("3600");
  const [minimumDuration, setMinimumDuration] = useState("");
  const [maximumDuration, setMaximumDuration] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const loading = status === "authenticated" && !loaded;
  const canManage = role === "OWNER";

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    void Promise.all([getBookable(bookableId), listOrganizations()])
      .then(([nextBookable, organizations]) => {
        if (cancelled) return;
        if (nextBookable.organizationId !== organizationId) {
          setErrorStatus(404);
          setLoaded(true);
          return;
        }
        setBookable(nextBookable);
        setRole(
          organizations.find(({ id }) => id === organizationId)?.role ?? null,
        );
        setName(nextBookable.name);
        setDescription(nextBookable.description ?? "");
        setCapacity(String(nextBookable.capacity));
        setDurationMode(nextBookable.reservationRule?.durationMode ?? "FIXED");
        setFixedDuration(String(nextBookable.reservationRule?.fixedDuration ?? 3600));
        setMinimumDuration(String(nextBookable.reservationRule?.minimumDuration ?? ""));
        setMaximumDuration(String(nextBookable.reservationRule?.maximumDuration ?? ""));
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
    setPendingAction("update");
    try {
      const updated = await updateBookable(bookableId, {
        name: name.trim(),
        description: description.trim() || undefined,
        capacity: Number(capacity),
        reservationRule: {
          durationMode,
          ...(durationMode === "FIXED"
            ? { fixedDuration: Number(fixedDuration) }
            : {
                ...(minimumDuration ? { minimumDuration: Number(minimumDuration) } : {}),
                ...(maximumDuration ? { maximumDuration: Number(maximumDuration) } : {}),
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
                <p className={styles.slug}>{bookable.slug}</p>
              </div>
              <BookableStatusBadge status={bookable.status} />
            </div>
            <div className={styles.details}>
              <span>Capacity</span>
              <strong>{bookable.capacity}</strong>
            </div>
            <p className={styles.description}>
              {bookable.description || "No description provided."}
            </p>
            <section className={styles.availabilitySection}><p className={styles.sectionLabel}>Availability</p><h2>Configure when customers can reserve</h2><p className={styles.message}>Availability is managed separately from Bookable details.</p><Link className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950" href={`/organizations/${organizationId}/bookables/${bookableId}/availability`}><span>Manage availability</span><ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></section>
            <section className={styles.availabilitySection}><p className={styles.sectionLabel}>Public booking</p><h2>Share this Bookable</h2><p className={styles.message}>Customers can use this link to make reservations once the Bookable is published.</p><PublicBookingLink slug={bookable.slug} enabled={bookable.status === "PUBLISHED"} /></section>
            {mutationError && (
              <p className={styles.error} role="alert">
                {mutationError}
              </p>
            )}
            {confirmArchive && (
              <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
                <p className="text-sm font-semibold text-rose-900">Archive this bookable?</p>
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
                {bookable.status !== "ARCHIVED" && (
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
                <div className={styles.formField}>
                  <span>Slug</span>
                  <input
                    value={bookable?.slug ?? ""}
                    readOnly
                    aria-readonly="true"
                    className="cursor-not-allowed bg-slate-50 text-slate-500"
                  />
                  <small>Public URL stays stable even if the bookable name changes.</small>
                </div>
                <label className={styles.formField}>
                  Description
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                  />
                </label>
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
                  <legend>Reservation duration</legend>
                  <select
                    value={durationMode}
                    onChange={(event) =>
                      setDurationMode(event.target.value as "FIXED" | "FLEXIBLE")
                    }
                  >
                    <option value="FIXED">Fixed duration</option>
                    <option value="FLEXIBLE">Flexible duration</option>
                  </select>
                  {durationMode === "FIXED" ? (
                    <select
                      aria-label="Reservation length"
                      value={fixedDuration}
                      onChange={(event) => setFixedDuration(event.target.value)}
                    >
                      <option value="1800">30 minutes</option>
                      <option value="3600">60 minutes</option>
                      <option value="5400">90 minutes</option>
                      <option value="7200">120 minutes</option>
                    </select>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        aria-label="Minimum duration in seconds"
                        type="number"
                        min="1"
                        placeholder="Minimum seconds"
                        value={minimumDuration}
                        onChange={(event) => setMinimumDuration(event.target.value)}
                      />
                      <input
                        aria-label="Maximum duration in seconds"
                        type="number"
                        min="1"
                        placeholder="Maximum seconds"
                        value={maximumDuration}
                        onChange={(event) => setMaximumDuration(event.target.value)}
                      />
                    </div>
                  )}
                  <small>
                    Fixed duration enables selectable public booking slots.
                  </small>
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
                Only workspace owners can edit, publish, or archive
                bookables.
              </p>
            )}
          </>
        )}
      </main>
    </PageContainer>
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
