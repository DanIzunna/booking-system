import type { FormEvent } from "react";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";

const fixedDurationOptions = [
  { label: "30 minutes", value: 1800 },
  { label: "60 minutes", value: 3600 },
  { label: "90 minutes", value: 5400 },
  { label: "120 minutes", value: 7200 },
] as const;

const flexibleDurationOptions = [
  { label: "15 minutes", value: 900 },
  { label: "30 minutes", value: 1800 },
  { label: "45 minutes", value: 2700 },
  { label: "60 minutes", value: 3600 },
  { label: "90 minutes", value: 5400 },
  { label: "120 minutes", value: 7200 },
  { label: "180 minutes", value: 10800 },
  { label: "240 minutes", value: 14400 },
] as const;

interface StepBookingRulesProps {
  confirmationPolicy: "AUTOMATIC" | "REQUIRES_APPROVAL";
  durationMode: "FIXED" | "FLEXIBLE";
  fixedDuration: number;
  minimumDuration: number;
  maximumDuration: number;
  submitting: boolean;
  error: string;
  onConfirmationPolicyChange: (
    value: "AUTOMATIC" | "REQUIRES_APPROVAL",
  ) => void;
  onDurationModeChange: (value: "FIXED" | "FLEXIBLE") => void;
  onFixedDurationChange: (value: number) => void;
  onMinimumDurationChange: (value: number) => void;
  onMaximumDurationChange: (value: number) => void;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function StepBookingRules({
  confirmationPolicy,
  durationMode,
  fixedDuration,
  minimumDuration,
  maximumDuration,
  submitting,
  error,
  onConfirmationPolicyChange,
  onDurationModeChange,
  onFixedDurationChange,
  onMinimumDurationChange,
  onMaximumDurationChange,
  onBack,
  onSubmit,
}: StepBookingRulesProps) {
  return (
    <form className="space-y-6" onSubmit={onSubmit} noValidate>
      <div className="space-y-4">
        <div>
          <p className="mb-3 text-sm font-semibold text-slate-900">
            Confirmation
          </p>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-slate-300">
              <input
                type="radio"
                name="confirmationPolicy"
                checked={confirmationPolicy === "AUTOMATIC"}
                onChange={() => onConfirmationPolicyChange("AUTOMATIC")}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">
                  Automatic
                </span>
                <span className="mt-1 block text-sm text-slate-600">
                  Reservations are confirmed automatically when the booking
                  requirements are satisfied.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-slate-300">
              <input
                type="radio"
                name="confirmationPolicy"
                checked={confirmationPolicy === "REQUIRES_APPROVAL"}
                onChange={() => onConfirmationPolicyChange("REQUIRES_APPROVAL")}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">
                  Requires approval
                </span>
                <span className="mt-1 block text-sm text-slate-600">
                  Reservations remain pending until an organization member
                  approves them.
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-900">
          Reservation duration
        </p>

        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-slate-300">
            <input
              type="radio"
              name="durationMode"
              checked={durationMode === "FIXED"}
              onChange={() => onDurationModeChange("FIXED")}
            />
            <span className="text-sm font-medium text-slate-900">Fixed</span>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-slate-300">
            <input
              type="radio"
              name="durationMode"
              checked={durationMode === "FLEXIBLE"}
              onChange={() => onDurationModeChange("FLEXIBLE")}
            />
            <span className="text-sm font-medium text-slate-900">Flexible</span>
          </label>
        </div>

        {durationMode === "FIXED" && (
          <div className="space-y-2">
            <Label htmlFor="booking-rules-fixed-duration">Duration</Label>
            <select
              id="booking-rules-fixed-duration"
              value={fixedDuration}
              onChange={(event) =>
                onFixedDurationChange(Number(event.target.value))
              }
              className="min-h-10 w-full rounded-[6px] border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
            >
              {fixedDurationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {durationMode === "FLEXIBLE" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="booking-rules-min-duration">
                Minimum duration
              </Label>
              <select
                id="booking-rules-min-duration"
                value={minimumDuration}
                onChange={(event) =>
                  onMinimumDurationChange(Number(event.target.value))
                }
                className="min-h-10 w-full rounded-[6px] border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
              >
                {flexibleDurationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="booking-rules-max-duration">
                Maximum duration
              </Label>
              <select
                id="booking-rules-max-duration"
                value={maximumDuration}
                onChange={(event) =>
                  onMaximumDurationChange(Number(event.target.value))
                }
                className="min-h-10 w-full rounded-[6px] border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
              >
                {flexibleDurationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
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
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Continue →"}
        </Button>
      </div>
    </form>
  );
}
