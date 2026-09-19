import type { FormEvent } from "react";
import { Trash2 } from "lucide-react";
import type { AvailabilityWindow } from "../../../types/availability";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";

const weekdayOptions = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
] as const;

export interface DraftRecurringWindow {
  id: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
}

interface StepAvailabilityProps {
  timezone: string;
  persistedWindows: AvailabilityWindow[];
  draftWindows: DraftRecurringWindow[];
  submitting: boolean;
  error: string;
  onAddWindow: () => void;
  onRemoveDraftWindow: (windowId: string) => void;
  onDraftUpdate: (
    windowId: string,
    patch: Partial<DraftRecurringWindow>,
  ) => void;
  onToggleDraftWeekday: (windowId: string, weekday: number) => void;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function formatWeekdays(values: number[]) {
  const sorted = Array.from(new Set(values)).sort((a, b) => a - b);
  if (sorted.length === 0) return "No days selected";
  if (sorted.length === 1)
    return (
      weekdayOptions.find((option) => option.value === sorted[0])?.label ??
      "Unknown"
    );

  const ranges: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    ranges.push(formatRange(start, previous));
    start = current;
    previous = current;
  }

  ranges.push(formatRange(start, previous));
  return ranges.join(", ");
}

function formatRange(start: number, end: number) {
  const startLabel =
    weekdayOptions.find((option) => option.value === start)?.label ?? "Unknown";
  const endLabel =
    weekdayOptions.find((option) => option.value === end)?.label ?? "Unknown";
  return start === end ? startLabel : `${startLabel}–${endLabel}`;
}

function isWindowValid(window: DraftRecurringWindow) {
  if (window.weekdays.length === 0) return false;
  return window.startTime < window.endTime;
}

function groupPersistedWindows(windows: AvailabilityWindow[]) {
  const byKey = new Map<
    string,
    { days: number[]; startTime: string; endTime: string }
  >();

  for (const window of windows) {
    if (window.type !== "RECURRING" || window.weekday === null) continue;
    if (!window.startTime || !window.endTime) continue;
    const key = `${window.startTime}|${window.endTime}`;
    const existing = byKey.get(key) ?? {
      days: [] as number[],
      startTime: window.startTime,
      endTime: window.endTime,
    };
    if (!existing.days.includes(window.weekday)) {
      existing.days.push(window.weekday);
    }
    byKey.set(key, existing);
  }

  return Array.from(byKey.values())
    .map((entry) => ({
      days: [...entry.days].sort((a, b) => a - b),
      startTime: entry.startTime,
      endTime: entry.endTime,
    }))
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
}

export function StepAvailability({
  timezone,
  persistedWindows,
  draftWindows,
  submitting,
  error,
  onAddWindow,
  onRemoveDraftWindow,
  onDraftUpdate,
  onToggleDraftWeekday,
  onBack,
  onSubmit,
}: StepAvailabilityProps) {
  const groupedPersisted = groupPersistedWindows(persistedWindows);
  const hasValidDraftWindow = draftWindows.some((window) =>
    isWindowValid(window),
  );
  const hasExistingAvailability =
    persistedWindows.length > 0 || hasValidDraftWindow;

  return (
    <form className="space-y-6" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-900">Availability</p>
        <p className="text-sm text-slate-600">
          Set when customers can make reservations.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          Timezone
        </p>
        <p className="mt-2 text-lg font-semibold text-slate-900">{timezone}</p>
        <p className="mt-2 text-sm text-slate-600">
          Times below are shown in the organization&apos;s local timezone.
        </p>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-900">
          Recurring availability
        </p>

        {groupedPersisted.length === 0 && draftWindows.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            No availability added yet.
            <div className="mt-2">
              Add at least one recurring availability window before continuing.
            </div>
          </div>
        )}

        {groupedPersisted.length > 0 && (
          <div className="space-y-3">
            {groupedPersisted.map((entry, index) => (
              <div
                key={`${entry.startTime}-${entry.endTime}-${index}`}
                className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-3 text-sm text-slate-500"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-600">
                    {formatWeekdays(entry.days)}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span>
                    {entry.startTime} → {entry.endTime}
                  </span>
                </div>
                <div className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                  Already added
                </div>
              </div>
            ))}
          </div>
        )}

        {draftWindows.length > 0 && (
          <div className="space-y-4">
            {draftWindows.map((window) => (
              <div
                key={window.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    New availability window
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {weekdayOptions.map((day) => {
                      const selected = window.weekdays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() =>
                            onToggleDraftWeekday(window.id, day.value)
                          }
                          className={[
                            "min-h-8 rounded-[6px] border px-2.5 text-xs font-medium transition-colors",
                            selected
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
                          ].join(" ")}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`draft-start-${window.id}`}>Start</Label>
                    <input
                      id={`draft-start-${window.id}`}
                      type="time"
                      value={window.startTime}
                      onChange={(event) =>
                        onDraftUpdate(window.id, {
                          startTime: event.target.value,
                        })
                      }
                      className="min-h-10 w-full rounded-[6px] border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`draft-end-${window.id}`}>End</Label>
                    <input
                      id={`draft-end-${window.id}`}
                      type="time"
                      value={window.endTime}
                      onChange={(event) =>
                        onDraftUpdate(window.id, {
                          endTime: event.target.value,
                        })
                      }
                      className="min-h-10 w-full rounded-[6px] border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>

                {!isWindowValid(window) && (
                  <p className="mt-3 text-xs text-amber-700">
                    Choose at least one day and set an end time after the start
                    time.
                  </p>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onRemoveDraftWindow(window.id)}
                    aria-label="Remove availability window"
                    title="Remove availability window"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] border border-red-200 bg-red-50 text-red-600 transition-colors hover:border-red-300 hover:bg-red-100 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-start">
        <button
          type="button"
          onClick={onAddWindow}
          className="inline-flex items-center gap-2 rounded-[6px] border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
        >
          <span className="text-base leading-none">+</span>
          <span>Add another window</span>
        </button>
      </div>

      {error && (
        <p
          className="border-l-2 border-rose-500 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="flex justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={submitting || !hasExistingAvailability}>
          {submitting ? "Saving..." : "Continue →"}
        </Button>
      </div>
    </form>
  );
}
