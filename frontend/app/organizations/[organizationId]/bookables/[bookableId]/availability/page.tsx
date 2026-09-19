"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import {
  FormEvent,
  type MouseEvent,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../../../../lib/api/client";
import {
  checkAvailability,
  createAvailabilityException,
  createAvailabilityWindow,
  deleteAvailabilityException,
  deleteAvailabilityWindow,
  listAvailabilityExceptions,
  listAvailabilityWindows,
} from "../../../../../../lib/api/availability";
import { getBookable } from "../../../../../../lib/api/bookables";
import {
  getOrganization,
  listOrganizations,
} from "../../../../../../lib/api/organizations";
import { useSession } from "../../../../../../lib/auth/session-provider";
import {
  addLocalMinutes,
  formatLocalTime,
  formatTimeZoneName,
  formatZonedDateTime,
  localDateTimeToIso,
} from "../../../../../../lib/timezone";
import type { Bookable } from "../../../../../../types/bookables";
import type {
  AvailabilityCheckResult,
  AvailabilityException,
  AvailabilityExceptionType,
  AvailabilityWindow,
  AvailabilityWindowType,
} from "../../../../../../types/availability";
import type {
  MembershipRole,
  Organization,
} from "../../../../../../types/organizations";
import styles from "../../../../../dashboard.module.css";
import { PageContainer } from "../../../../../../components/layout/page-container";

interface AvailabilityPageProps {
  params: Promise<{ organizationId: string; bookableId: string }>;
}
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

export default function AvailabilityPage({ params }: AvailabilityPageProps) {
  const { organizationId, bookableId } = use(params);
  const router = useRouter();
  const { status, user } = useSession();
  const [bookable, setBookable] = useState<Bookable | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [role, setRole] = useState<MembershipRole | null>(null);
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [mutationError, setMutationError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [windowType, setWindowType] =
    useState<AvailabilityWindowType>("RECURRING");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([
    1, 2, 3, 4, 5,
  ]);
  const [weekday] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [specificDate, setSpecificDate] = useState("");
  const [specificStartTime, setSpecificStartTime] = useState("10:00");
  const [specificEndTime, setSpecificEndTime] = useState("14:00");
  const [exceptionType, setExceptionType] =
    useState<AvailabilityExceptionType>("BLOCK");
  const [exceptionStartDate, setExceptionStartDate] = useState("");
  const [exceptionStartTime, setExceptionStartTime] = useState("10:00");
  const [exceptionEndDate, setExceptionEndDate] = useState("");
  const [exceptionEndTime, setExceptionEndTime] = useState("12:00");
  const [checkDate, setCheckDate] = useState("");
  const [checkStartTime, setCheckStartTime] = useState("10:00");
  const [duration, setDuration] = useState("60");
  const [checkResult, setCheckResult] =
    useState<AvailabilityCheckResult | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "window" | "exception";
    id: string;
    label: string;
  } | null>(null);
  const [showWeeklyForm, setShowWeeklyForm] = useState(false);
  const [showSpecificForm, setShowSpecificForm] = useState(false);
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const loading = status === "authenticated" && !loaded;
  const canManage = role === "OWNER";

  const recurringSchedule = useMemo(() => {
    const weekdayMap = new Map<number, Set<string>>();

    for (const window of windows) {
      if (
        window.type !== "RECURRING" ||
        window.weekday === null ||
        !window.startTime ||
        !window.endTime
      ) {
        continue;
      }

      const key = `${formatLocalTime(window.startTime)} – ${formatLocalTime(window.endTime)}`;
      const existing = weekdayMap.get(window.weekday) ?? new Set<string>();
      existing.add(key);
      weekdayMap.set(window.weekday, existing);
    }

    const byTimeMap = new Map<string, number[]>();
    for (const [weekdayIndex, timeSet] of Array.from(weekdayMap.entries()).sort(
      ([a], [b]) => a - b,
    )) {
      const timeRanges = Array.from(timeSet);
      const groupKey = timeRanges.join("||");
      const current = byTimeMap.get(groupKey) ?? [];
      current.push(weekdayIndex);
      byTimeMap.set(groupKey, current);
    }

    return Array.from(byTimeMap.entries()).map(
      ([groupKey, weekdayIndexes]) => ({
        dayLabel: formatDayRangeGroup(weekdayIndexes),
        timeRanges: groupKey.split("||"),
      }),
    );
  }, [windows]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    void Promise.all([
      getBookable(bookableId),
      getOrganization(organizationId),
      listOrganizations(),
      listAvailabilityWindows(bookableId),
      listAvailabilityExceptions(bookableId),
    ])
      .then(
        ([
          nextBookable,
          nextOrganization,
          organizations,
          nextWindows,
          nextExceptions,
        ]) => {
          if (cancelled) return;
          if (nextBookable.organizationId !== organizationId) {
            setErrorStatus(404);
            setLoaded(true);
            return;
          }
          setBookable(nextBookable);
          setOrganization(nextOrganization);
          setRole(
            organizations.find(({ id }) => id === organizationId)?.role ?? null,
          );
          setWindows(nextWindows);
          setExceptions(nextExceptions);
          setLoaded(true);
        },
      )
      .catch((caught) => {
        if (!cancelled) {
          setErrorStatus(caught instanceof ApiError ? caught.statusCode : 500);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bookableId, organizationId, status]);

  function toggleWeekday(day: number) {
    setSelectedWeekdays((current) => {
      if (current.includes(day)) {
        return current.filter((value) => value !== day);
      }
      return [...current, day].sort((a, b) => a - b);
    });
  }

  async function handleCreateWindow(
    event: FormEvent<HTMLFormElement>,
    requestedType = (event.currentTarget.dataset.windowType as
      | AvailabilityWindowType
      | undefined) ??
      (event.currentTarget.querySelector<HTMLInputElement>(
        'input[type="hidden"]',
      )?.value as AvailabilityWindowType | undefined) ??
      windowType,
  ) {
    event.preventDefault();
    setMutationError("");
    if (!organization) return;
    if (requestedType === "RECURRING") {
      if (selectedWeekdays.length === 0) {
        setMutationError("Select at least one day before applying a window.");
        return;
      }
      if (startTime >= endTime) {
        setMutationError("End time must be after start time.");
        return;
      }
    }
    const startLocal = `${specificDate}T${specificStartTime}`;
    const endLocal = `${specificDate}T${specificEndTime}`;
    if (
      requestedType === "SPECIFIC" &&
      !validLocalInterval(startLocal, endLocal)
    ) {
      setMutationError(
        "Choose a valid date and an end time after the start time.",
      );
      return;
    }
    setPendingAction("create-window");
    try {
      const createdWindows = await Promise.all(
        (requestedType === "RECURRING"
          ? selectedWeekdays
          : [Number(weekday)]
        ).map((day) =>
          createAvailabilityWindow(
            bookableId,
            requestedType === "RECURRING"
              ? {
                  type: requestedType,
                  weekday: day,
                  startTime,
                  endTime,
                }
              : {
                  type: requestedType,
                  startAt: localDateTimeToIso(
                    startLocal,
                    organization.timezone,
                  ),
                  endAt: localDateTimeToIso(endLocal, organization.timezone),
                },
          ),
        ),
      );
      setWindows((current) => [...current, ...createdWindows]);
      setSpecificDate("");
    } catch (caught) {
      setMutationError(formatError(caught, "add this availability"));
    } finally {
      setPendingAction("");
    }
  }

  async function handleCreateException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationError("");
    if (!organization) return;
    const startLocal = `${exceptionStartDate}T${exceptionStartTime}`;
    const endLocal = `${exceptionEndDate}T${exceptionEndTime}`;
    if (!validLocalInterval(startLocal, endLocal)) {
      setMutationError("Choose valid dates and an end after the start.");
      return;
    }
    setPendingAction("create-exception");
    try {
      const created = await createAvailabilityException(bookableId, {
        type: exceptionType,
        startAt: localDateTimeToIso(startLocal, organization.timezone),
        endAt: localDateTimeToIso(endLocal, organization.timezone),
      });
      setExceptions((current) => [...current, created]);
      setExceptionStartDate("");
      setExceptionEndDate("");
    } catch (caught) {
      setMutationError(formatError(caught, "add this exception"));
    } finally {
      setPendingAction("");
    }
  }

  async function handleDelete(kind: "window" | "exception", id: string) {
    setMutationError("");
    setPendingAction(`delete-${kind}`);
    try {
      if (kind === "window") {
        await deleteAvailabilityWindow(bookableId, id);
        setWindows((current) => current.filter((item) => item.id !== id));
      } else {
        await deleteAvailabilityException(bookableId, id);
        setExceptions((current) => current.filter((item) => item.id !== id));
      }
      setDeleteTarget(null);
    } catch (caught) {
      setMutationError(formatError(caught, `remove this ${kind}`));
    } finally {
      setPendingAction("");
    }
  }

  async function handleCheck(
    event: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    setMutationError("");
    setCheckResult(null);
    if (
      !organization ||
      !checkDate ||
      !checkStartTime ||
      Number(duration) <= 0
    ) {
      setMutationError("Choose a date, start time, and duration.");
      return;
    }
    const startLocal = `${checkDate}T${checkStartTime}`;
    const endLocal = addLocalMinutes(startLocal, Number(duration));
    setPendingAction("check");
    try {
      setCheckResult(
        await checkAvailability(
          bookableId,
          localDateTimeToIso(startLocal, organization.timezone),
          localDateTimeToIso(endLocal, organization.timezone),
        ),
      );
    } catch (caught) {
      setMutationError(formatError(caught, "check availability"));
    } finally {
      setPendingAction("");
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
      <main className="px-0 py-2">
        <Link
          className="mb-8 flex min-h-11 w-fit items-center gap-2 rounded-[6px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
          href={`/organizations/${organizationId}/bookables/${bookableId}`}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>Back to bookable</span>
        </Link>
        {loading && (
          <p className="mt-10 text-sm text-slate-500">
            Loading availability...
          </p>
        )}
        {!loading && errorStatus !== null && (
          <ErrorState
            title={
              errorStatus === 403
                ? "Access denied"
                : errorStatus === 404
                  ? "Bookable not found"
                  : "Unable to load availability"
            }
            message={
              errorStatus === 403
                ? "You do not have permission to inspect this availability."
                : errorStatus === 404
                  ? "This bookable is unavailable or does not belong to this workspace."
                  : "Please try again shortly."
            }
          />
        )}
        {!loading && errorStatus === null && bookable && organization && (
          <>
            <div className="mt-10 flex flex-col justify-between gap-5 border-b border-slate-200 pb-8 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
                  Availability
                </p>
                <h1 className="mt-3 text-4xl font-bold tracking-tight">
                  {bookable.name}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  {organization.name}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Workspace timezone
                </p>
                <p className="mt-2 font-semibold text-slate-800">
                  {formatTimeZoneName(organization.timezone)}
                </p>
              </div>
            </div>
            <p className="mt-6 max-w-2xl text-sm leading-6 text-slate-600">
              Set when this resource can be booked. Times are shown in your
              workspace timezone.
            </p>
            {mutationError && (
              <p
                className="mt-5 border-l-2 border-rose-500 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                role="alert"
              >
                {mutationError}
              </p>
            )}
            {deleteTarget && (
              <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
                <p className="text-sm font-semibold text-rose-900">
                  Remove{" "}
                  {deleteTarget.kind === "window" ? "time window" : "exception"}
                  ?
                </p>
                <p className="mt-2 text-sm text-rose-700">
                  {deleteTarget.label}
                </p>
                <p className="mt-2 text-sm text-rose-700">
                  This time window will no longer be available for reservations.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className="min-h-10 rounded-[6px] border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="min-h-10 rounded-[6px] border border-rose-200 bg-rose-600 px-4 text-[13px] font-medium text-white hover:bg-rose-500"
                    type="button"
                    onClick={() => {
                      void handleDelete(deleteTarget.kind, deleteTarget.id);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
            <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
              <div className="space-y-6">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays
                        className="size-4 text-slate-600"
                        aria-hidden="true"
                      />
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">
                        Weekly schedule
                      </p>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                        onClick={() => setShowWeeklyForm((current) => !current)}
                      >
                        {showWeeklyForm ? (
                          <>
                            <PencilLine
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            Close
                          </>
                        ) : (
                          <>
                            <Plus className="size-3.5" aria-hidden="true" />
                            {windows.some((item) => item.type === "RECURRING")
                              ? "Edit schedule"
                              : "Add hours"}
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    {recurringSchedule.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No weekly hours configured.
                      </p>
                    ) : (
                      recurringSchedule.map(({ dayLabel, timeRanges }) => (
                        <div
                          key={`${dayLabel}-${timeRanges.join("|")}`}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {dayLabel}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {timeRanges.join(", ")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {canManage && showWeeklyForm && (
                    <form
                      className="mt-6 grid gap-4 border-t border-slate-100 pt-5"
                      onSubmit={handleCreateWindow}
                    >
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-slate-700">
                          Select days
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {weekdays.map((day, index) => (
                            <button
                              key={day}
                              type="button"
                              aria-label={`Toggle ${day}`}
                              aria-pressed={selectedWeekdays.includes(index)}
                              className={`min-h-10 rounded-full border px-3 text-xs font-medium transition-colors ${
                                selectedWeekdays.includes(index)
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                              }`}
                              onClick={() => toggleWeekday(index)}
                            >
                              {day.slice(0, 3)}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500">
                          {selectedWeekdays.length > 0
                            ? selectedWeekdays
                                .map((day) => weekdays[day].slice(0, 3))
                                .join(" · ")
                            : "Select one or more days."}
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2 text-sm font-semibold text-slate-700">
                          Start
                          <input
                            className={styles.friendlyInput}
                            type="time"
                            value={startTime}
                            onChange={(event) =>
                              setStartTime(event.target.value)
                            }
                            required
                          />
                        </label>
                        <label className="space-y-2 text-sm font-semibold text-slate-700">
                          End
                          <input
                            className={styles.friendlyInput}
                            type="time"
                            value={endTime}
                            onChange={(event) => setEndTime(event.target.value)}
                            required
                          />
                        </label>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          className={styles.primaryButton}
                          type="submit"
                          disabled={
                            Boolean(pendingAction) ||
                            selectedWeekdays.length === 0
                          }
                        >
                          {pendingAction === "create-window"
                            ? "Adding..."
                            : "Apply to selected days"}
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => setShowWeeklyForm(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">
                        Specific availability
                      </p>
                      <h2 className="mt-2 text-xl font-semibold">
                        One-time windows
                      </h2>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                        onClick={() =>
                          setShowSpecificForm((current) => !current)
                        }
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                        {showSpecificForm ? "Close" : "Add specific window"}
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Add bookable hours for a specific date without changing the
                    weekly schedule.
                  </p>
                  <div className="mt-5 space-y-2">
                    {windows.filter((item) => item.type === "SPECIFIC")
                      .length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No specific windows configured.
                      </p>
                    ) : (
                      windows
                        .filter((item) => item.type === "SPECIFIC")
                        .map((item) => (
                          <div
                            className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                            key={item.id}
                          >
                            <span className="text-sm text-slate-700">
                              {formatZonedDateTime(
                                item.startAt ?? "",
                                organization.timezone,
                              )}{" "}
                              –{" "}
                              {formatZonedDateTime(
                                item.endAt ?? "",
                                organization.timezone,
                              )}
                            </span>
                            {canManage && (
                              <button
                                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-[6px] text-xs font-semibold text-rose-700 hover:bg-rose-50 sm:min-h-10 sm:min-w-0 sm:px-2"
                                disabled={Boolean(pendingAction)}
                                aria-label="Remove specific availability"
                                title="Remove availability"
                                onClick={() =>
                                  setDeleteTarget({
                                    kind: "window",
                                    id: item.id,
                                    label: `${formatZonedDateTime(item.startAt ?? "", organization.timezone)} – ${formatZonedDateTime(item.endAt ?? "", organization.timezone)}`,
                                  })
                                }
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                                <span className="hidden sm:inline">Remove</span>
                              </button>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                  {canManage && showSpecificForm && (
                    <form
                      className="mt-6 grid gap-4 border-t border-slate-100 pt-5"
                      onSubmit={handleCreateWindow}
                    >
                      <input type="hidden" value="SPECIFIC" readOnly />
                      <div className="grid gap-4 sm:grid-cols-3">
                        <label className="space-y-2 text-sm font-semibold text-slate-700">
                          Date
                          <input
                            className={styles.friendlyInput}
                            type="date"
                            value={specificDate}
                            onChange={(event) =>
                              setSpecificDate(event.target.value)
                            }
                            required
                          />
                        </label>
                        <label className="space-y-2 text-sm font-semibold text-slate-700">
                          Starts
                          <input
                            className={styles.friendlyInput}
                            type="time"
                            value={specificStartTime}
                            onChange={(event) =>
                              setSpecificStartTime(event.target.value)
                            }
                            required
                          />
                        </label>
                        <label className="space-y-2 text-sm font-semibold text-slate-700">
                          Ends
                          <input
                            className={styles.friendlyInput}
                            type="time"
                            value={specificEndTime}
                            onChange={(event) =>
                              setSpecificEndTime(event.target.value)
                            }
                            required
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={styles.primaryButton}
                          type="submit"
                          disabled={Boolean(pendingAction)}
                          onClick={() => setWindowType("SPECIFIC")}
                        >
                          {pendingAction === "create-window"
                            ? "Adding..."
                            : "Add specific window"}
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => setShowSpecificForm(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </section>
              </div>
              <div className="space-y-6">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">
                        Exceptions
                      </p>
                      <h2 className="mt-2 text-xl font-semibold">
                        Overrides and block times
                      </h2>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                        onClick={() =>
                          setShowExceptionForm((current) => !current)
                        }
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                        {showExceptionForm ? "Close" : "Add exception"}
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Override the weekly schedule for specific dates.
                  </p>
                  <div className="mt-5 space-y-2">
                    {exceptions.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No exceptions configured.
                      </p>
                    ) : (
                      exceptions.map((item) => (
                        <div
                          className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                          key={item.id}
                        >
                          <span>
                            <strong className="block text-sm font-semibold text-slate-900">
                              {item.type === "BLOCK"
                                ? "Blocked"
                                : "Override hours"}
                            </strong>
                            <small className="mt-1 block text-sm text-slate-600">
                              {formatZonedDateTime(
                                item.startAt,
                                organization.timezone,
                              )}{" "}
                              –{" "}
                              {formatZonedDateTime(
                                item.endAt,
                                organization.timezone,
                              )}
                            </small>
                          </span>
                          {canManage && (
                            <button
                              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-[6px] text-xs font-semibold text-rose-700 hover:bg-rose-50 sm:min-h-10 sm:min-w-0 sm:px-2"
                              disabled={Boolean(pendingAction)}
                              aria-label="Remove availability exception"
                              title="Remove exception"
                              onClick={() =>
                                setDeleteTarget({
                                  kind: "exception",
                                  id: item.id,
                                  label: `${item.type === "BLOCK" ? "Blocked" : "Override hours"} · ${formatZonedDateTime(item.startAt, organization.timezone)} – ${formatZonedDateTime(item.endAt, organization.timezone)}`,
                                })
                              }
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                              <span className="hidden sm:inline">Remove</span>
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {canManage && showExceptionForm && (
                    <form
                      className="mt-6 grid gap-4 border-t border-slate-100 pt-5"
                      onSubmit={handleCreateException}
                    >
                      <label className="space-y-2 text-sm font-semibold text-slate-700">
                        Exception type
                        <select
                          className={styles.friendlyInput}
                          value={exceptionType}
                          onChange={(event) =>
                            setExceptionType(
                              event.target.value as AvailabilityExceptionType,
                            )
                          }
                        >
                          <option value="BLOCK">Block time</option>
                          <option value="OVERRIDE">Override hours</option>
                        </select>
                      </label>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2 text-sm font-semibold text-slate-700">
                          Starts
                          <input
                            className={styles.friendlyInput}
                            type="datetime-local"
                            value={`${exceptionStartDate}T${exceptionStartTime}`}
                            onChange={(event) => {
                              const [date, time] =
                                event.target.value.split("T");
                              setExceptionStartDate(date);
                              setExceptionStartTime(time);
                            }}
                            required
                          />
                        </label>
                        <label className="space-y-2 text-sm font-semibold text-slate-700">
                          Ends
                          <input
                            className={styles.friendlyInput}
                            type="datetime-local"
                            value={`${exceptionEndDate}T${exceptionEndTime}`}
                            onChange={(event) => {
                              const [date, time] =
                                event.target.value.split("T");
                              setExceptionEndDate(date);
                              setExceptionEndTime(time);
                            }}
                            required
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={styles.primaryButton}
                          type="submit"
                          disabled={Boolean(pendingAction)}
                        >
                          {pendingAction === "create-exception"
                            ? "Adding..."
                            : "Add exception"}
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => setShowExceptionForm(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </section>
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Clock3
                      className="size-4 text-slate-600"
                      aria-hidden="true"
                    />
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">
                      Check availability
                    </p>
                  </div>
                  <h2 className="mt-2 text-xl font-semibold">Test a time</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Test whether a specific date and time can be booked.
                  </p>
                  <form className="mt-5 grid gap-4">
                    <label className="space-y-2 text-sm font-semibold text-slate-700">
                      Date
                      <input
                        className={styles.friendlyInput}
                        type="date"
                        value={checkDate}
                        onChange={(event) => setCheckDate(event.target.value)}
                        required
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2 text-sm font-semibold text-slate-700">
                        Start
                        <input
                          className={styles.friendlyInput}
                          type="time"
                          value={checkStartTime}
                          onChange={(event) =>
                            setCheckStartTime(event.target.value)
                          }
                          required
                        />
                      </label>
                      <label className="space-y-2 text-sm font-semibold text-slate-700">
                        Duration
                        <select
                          className={styles.friendlyInput}
                          value={duration}
                          onChange={(event) => setDuration(event.target.value)}
                        >
                          <option value="30">30 minutes</option>
                          <option value="60">1 hour</option>
                          <option value="90">1 hour 30 minutes</option>
                          <option value="120">2 hours</option>
                          <option value="180">3 hours</option>
                        </select>
                      </label>
                    </div>
                    <button
                      className={styles.primaryButton}
                      type="submit"
                      disabled={Boolean(pendingAction)}
                      onClick={(event) => void handleCheck(event)}
                    >
                      {pendingAction === "check"
                        ? "Checking..."
                        : "Check availability"}
                    </button>
                  </form>
                  {checkResult && (
                    <div
                      className={`mt-5 rounded-lg border p-4 ${checkResult.available ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}
                    >
                      <strong className="block">
                        {checkResult.available ? "Available" : "Not available"}
                      </strong>
                      <span className="mt-1 block text-sm">
                        {checkResult.available
                          ? `${formatZonedDateTime(checkResult.startAt, organization.timezone)} – ${formatZonedDateTime(checkResult.endAt, organization.timezone)}`
                          : "This time overlaps existing availability restrictions."}
                      </span>
                    </div>
                  )}
                </section>
              </div>
            </section>
          </>
        )}
      </main>
    </PageContainer>
  );
}

function formatDayRangeGroup(weekdayIndexes: number[]) {
  if (weekdayIndexes.length === 0) return "";

  const ranges: Array<{ start: number; end: number }> = [];
  let rangeStart = weekdayIndexes[0];
  let previous = weekdayIndexes[0];

  for (let index = 1; index < weekdayIndexes.length; index += 1) {
    const current = weekdayIndexes[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }

    ranges.push({ start: rangeStart, end: previous });
    rangeStart = current;
    previous = current;
  }

  ranges.push({ start: rangeStart, end: previous });

  return ranges
    .map(({ start, end }) => {
      const startLabel = shortWeekdays[start] ?? `Day ${start}`;
      const endLabel = shortWeekdays[end] ?? `Day ${end}`;
      if (start === end) {
        return weekdays[start] ?? `Day ${start}`;
      }
      return `${startLabel}–${endLabel}`;
    })
    .join(", ");
}

function validLocalInterval(start: string, end: string) {
  return Boolean(start && end) && end > start;
}
function formatError(caught: unknown, action: string) {
  if (!(caught instanceof ApiError))
    return `Unable to ${action}. Please try again.`;
  if (caught.statusCode === 403)
    return "Only a workspace owner can change availability.";
  if (caught.statusCode === 404)
    return "This workspace or bookable is unavailable.";
  if (caught.statusCode === 409)
    return (
      caught.message ||
      "This availability conflicts with an existing exception."
    );
  if (caught.statusCode === 400)
    return caught.message || "Check the availability values and try again.";
  return `Unable to ${action}. Please try again.`;
}
function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <section className="mt-10 max-w-2xl">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">
        {title}
      </p>
      <h1 className="mt-3 text-3xl font-bold">
        We could not open availability.
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">{message}</p>
    </section>
  );
}
