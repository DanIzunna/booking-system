"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import {
  createAvailabilityWindow,
  listAvailabilityWindows,
} from "../../../lib/api/availability";
import { createBookable, updateBookable } from "../../../lib/api/bookables";
import { ApiError } from "../../../lib/api/client";
import { formatMoneyMinorUnits, toMinorUnits } from "../../../lib/currency";
import { getOrganization } from "../../../lib/api/organizations";
import type { AvailabilityWindow } from "../../../types/availability";
import type { PricingType } from "../../../types/bookables";
import {
  StepAvailability,
  type DraftRecurringWindow,
} from "./step-availability";
import { StepBasics } from "./step-basics";
import { StepBookingRules } from "./step-booking-rules";
import { WizardProgress } from "./wizard-progress";

const wizardSteps = [
  "Basics",
  "Booking Rules",
  "Availability",
  "Review",
] as const;

type WizardStep = 0 | 1 | 2 | 3;

interface BookableWizardProps {
  organizationId: string;
}

export function BookableWizard({ organizationId }: BookableWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>(0);
  const [bookableId, setBookableId] = useState<string | null>(null);
  const [organizationTimezone, setOrganizationTimezone] =
    useState("Africa/Lagos");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [pricingType, setPricingType] = useState<PricingType>("FREE");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [confirmationPolicy, setConfirmationPolicy] = useState<
    "AUTOMATIC" | "REQUIRES_APPROVAL"
  >("AUTOMATIC");
  const [durationMode, setDurationMode] = useState<"FIXED" | "FLEXIBLE">(
    "FIXED",
  );
  const [fixedDuration, setFixedDuration] = useState<number>(3600);
  const [minimumDuration, setMinimumDuration] = useState<number>(1800);
  const [maximumDuration, setMaximumDuration] = useState<number>(7200);
  const [persistedWindows, setPersistedWindows] = useState<
    AvailabilityWindow[]
  >([]);
  const [draftWindows, setDraftWindows] = useState<DraftRecurringWindow[]>([]);
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const currentStepLabel = useMemo(
    () => wizardSteps[currentStep],
    [currentStep],
  );

  function validateBasics(): string {
    const trimmedName = name.trim();
    const parsedCapacity = Number(capacity);
    const parsedPrice = Number(price);
    const normalizedCurrency = currency.trim();

    if (!trimmedName) return "Name is required.";
    if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
      return "Capacity must be a positive integer.";
    }
    if (pricingType === "PAID") {
      if (!Number.isInteger(parsedPrice) || parsedPrice <= 0) {
        return "Price must be a positive integer for paid Bookables.";
      }
      if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
        return "Currency must be exactly 3 uppercase letters.";
      }
    }
    return "";
  }

  async function handleBasicsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateBasics();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      if (!bookableId) {
        const created = await createBookable({
          organizationId,
          name: name.trim(),
          description: description.trim() || undefined,
          capacity: Number(capacity),
          pricingType,
          price: pricingType === "PAID" ? Number(price) : null,
          currency: pricingType === "PAID" ? currency.trim().toUpperCase() : null,
          status: "DRAFT",
        });
        setBookableId(created.id);
      } else {
        await updateBookable(bookableId, {
          name: name.trim(),
          description: description.trim() || undefined,
          capacity: Number(capacity),
          pricingType,
          price: pricingType === "PAID" ? Number(price) : null,
          currency: pricingType === "PAID" ? currency.trim().toUpperCase() : null,
          status: "DRAFT",
        });
      }

      setCurrentStep(1);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message || "Unable to save this bookable."
          : "Unable to save this bookable.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function validateBookingRules(): string {
    if (durationMode === "FIXED") {
      if (!Number.isInteger(fixedDuration) || fixedDuration <= 0) {
        return "Please select a valid fixed duration.";
      }
      return "";
    }

    if (!Number.isInteger(minimumDuration) || minimumDuration <= 0) {
      return "Minimum duration must be a positive integer.";
    }
    if (!Number.isInteger(maximumDuration) || maximumDuration <= 0) {
      return "Maximum duration must be a positive integer.";
    }
    if (minimumDuration > maximumDuration) {
      return "Minimum duration cannot be greater than maximum duration.";
    }
    return "";
  }

  async function handleBookingRulesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!bookableId) {
      setError("Bookable draft is missing. Please complete Step 1 first.");
      return;
    }

    const validationError = validateBookingRules();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await updateBookable(bookableId, {
        confirmationPolicy,
        reservationRule:
          durationMode === "FIXED"
            ? {
                durationMode: "FIXED",
                fixedDuration,
              }
            : {
                durationMode: "FLEXIBLE",
                minimumDuration,
                maximumDuration,
              },
      });
      setCurrentStep(2);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message || "Unable to update booking rules."
          : "Unable to update booking rules.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    void getOrganization(organizationId)
      .then((organization) => {
        if (!cancelled) {
          setOrganizationTimezone(organization.timezone || "Africa/Lagos");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOrganizationTimezone("Africa/Lagos");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    if (!bookableId || currentStep !== 2 || availabilityLoaded) return;
    let cancelled = false;
    void listAvailabilityWindows(bookableId)
      .then((windows) => {
        if (!cancelled) {
          setPersistedWindows(
            windows.filter((window) => window.type === "RECURRING"),
          );
          setAvailabilityLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersistedWindows([]);
          setAvailabilityLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [availabilityLoaded, bookableId, currentStep]);

  function addAvailabilityWindow() {
    setDraftWindows((current) => [
      ...current,
      {
        id: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        weekdays: [1, 2, 3, 4, 5],
        startTime: "09:00",
        endTime: "17:00",
      },
    ]);
    setError("");
  }

  function toggleDraftWeekday(windowId: string, weekday: number) {
    setDraftWindows((current) =>
      current.map((window) => {
        if (window.id !== windowId) return window;
        const alreadySelected = window.weekdays.includes(weekday);
        return {
          ...window,
          weekdays: alreadySelected
            ? window.weekdays.filter((value) => value !== weekday)
            : [...window.weekdays, weekday].sort((a, b) => a - b),
        };
      }),
    );
  }

  function updateDraftWindow(
    windowId: string,
    patch: Partial<DraftRecurringWindow>,
  ) {
    setDraftWindows((current) =>
      current.map((window) =>
        window.id === windowId ? { ...window, ...patch } : window,
      ),
    );
  }

  function removeDraftWindow(windowId: string) {
    setDraftWindows((current) =>
      current.filter((window) => window.id !== windowId),
    );
    setError("");
  }

  function validateAvailabilityDraft(): string {
    if (persistedWindows.length === 0 && draftWindows.length === 0) {
      return "Add at least one recurring availability window before continuing.";
    }

    for (const window of draftWindows) {
      if (window.weekdays.length === 0) {
        return "Select at least one day for each recurring window.";
      }
      if (window.startTime >= window.endTime) {
        return "Each recurring window must end after it starts.";
      }
    }

    return "";
  }

  async function handleAvailabilitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!bookableId) {
      setError("Bookable draft is missing. Please complete Step 1 first.");
      return;
    }

    const validationError = validateAvailabilityDraft();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const existingKeys = new Set(
        persistedWindows
          .filter(
            (window) =>
              window.type === "RECURRING" &&
              window.weekday !== null &&
              window.startTime &&
              window.endTime,
          )
          .map(
            (window) =>
              `${window.weekday}:${window.startTime}:${window.endTime}`,
          ),
      );

      const remainingDrafts: DraftRecurringWindow[] = [];
      const newlyCreated: AvailabilityWindow[] = [];

      for (const draftWindow of draftWindows) {
        const missingWeekdays = draftWindow.weekdays.filter(
          (weekday) =>
            !existingKeys.has(
              `${weekday}:${draftWindow.startTime}:${draftWindow.endTime}`,
            ),
        );

        if (missingWeekdays.length === 0) continue;

        try {
          for (const weekday of missingWeekdays) {
            const created = await createAvailabilityWindow(bookableId, {
              type: "RECURRING",
              weekday,
              startTime: draftWindow.startTime,
              endTime: draftWindow.endTime,
            });
            newlyCreated.push(created);
            existingKeys.add(
              `${weekday}:${draftWindow.startTime}:${draftWindow.endTime}`,
            );
          }
        } catch {
          remainingDrafts.push(draftWindow);
        }
      }

      if (newlyCreated.length > 0) {
        setPersistedWindows((current) => [...current, ...newlyCreated]);
      }

      if (remainingDrafts.length > 0) {
        setDraftWindows(remainingDrafts);
        setError(
          "Some availability windows were saved, but one or more entries still need attention. Review the remaining windows and try again.",
        );
        return;
      }

      setDraftWindows([]);
      setAvailableStatusFromPersisted();
      setCurrentStep(3);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message || "Unable to save availability."
          : "Unable to save availability.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function setAvailableStatusFromPersisted() {
    setAvailabilityLoaded(true);
  }

  function formatWeekdayLabel(weekday: number) {
    const map: Record<number, string> = {
      0: "Sun",
      1: "Mon",
      2: "Tue",
      3: "Wed",
      4: "Thu",
      5: "Fri",
      6: "Sat",
    };
    return map[weekday] ?? "Day";
  }

  function formatWeekdayGroup(weekdays: number[]) {
    const values = [...new Set(weekdays)].sort((left, right) => left - right);
    if (values.length === 0) return "No days selected";
    if (values.length === 1) return formatWeekdayLabel(values[0]);
    return values.map((value) => formatWeekdayLabel(value)).join(", ");
  }

  function formatMinutes(value: number | null | undefined) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "—";
    }
    return `${Math.round(value / 60)} minutes`;
  }

  function getReviewWindows() {
    const byKey = new Map<
      string,
      { weekdays: number[]; startTime: string; endTime: string }
    >();

    const register = (
      weekdays: number[],
      startTime: string,
      endTime: string,
    ) => {
      const key = `${startTime}|${endTime}`;
      const existing = byKey.get(key) ?? {
        weekdays: [] as number[],
        startTime,
        endTime,
      };
      for (const weekday of weekdays) {
        if (!existing.weekdays.includes(weekday)) {
          existing.weekdays.push(weekday);
        }
      }
      byKey.set(key, existing);
    };

    for (const window of persistedWindows) {
      if (
        window.type === "RECURRING" &&
        window.weekday !== null &&
        window.startTime &&
        window.endTime
      ) {
        register([window.weekday], window.startTime, window.endTime);
      }
    }

    for (const draftWindow of draftWindows) {
      if (draftWindow.weekdays.length > 0) {
        register(
          draftWindow.weekdays,
          draftWindow.startTime,
          draftWindow.endTime,
        );
      }
    }

    return Array.from(byKey.values())
      .map((entry) => ({
        weekdays: [...entry.weekdays].sort((left, right) => left - right),
        startTime: entry.startTime,
        endTime: entry.endTime,
      }))
      .sort((left, right) => left.startTime.localeCompare(right.startTime));
  }

  async function handlePublish() {
    if (!bookableId) {
      setError("Bookable draft is missing. Please complete Step 1 first.");
      return;
    }

    setError("");
    setPublishing(true);

    try {
      await updateBookable(bookableId, {
        status: "PUBLISHED",
        confirmationPolicy,
        reservationRule:
          durationMode === "FIXED"
            ? {
                durationMode: "FIXED",
                fixedDuration,
              }
            : {
                durationMode: "FLEXIBLE",
                minimumDuration,
                maximumDuration,
              },
      });
      router.push(`/organizations/${organizationId}/bookables/${bookableId}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message || "Unable to publish this bookable."
          : "Unable to publish this bookable.",
      );
    } finally {
      setPublishing(false);
    }
  }

  function renderStepContent() {
    if (currentStep === 0) {
      return (
        <StepBasics
          name={name}
          description={description}
          capacity={capacity}
          pricingType={pricingType}
          price={price}
          currency={currency}
          submitting={submitting}
          error={error}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onCapacityChange={setCapacity}
          onPricingTypeChange={setPricingType}
          onPriceChange={setPrice}
          onCurrencyChange={setCurrency}
          onSubmit={handleBasicsSubmit}
        />
      );
    }

    if (currentStep === 1) {
      return (
        <StepBookingRules
          confirmationPolicy={confirmationPolicy}
          durationMode={durationMode}
          fixedDuration={fixedDuration}
          minimumDuration={minimumDuration}
          maximumDuration={maximumDuration}
          submitting={submitting}
          error={error}
          onConfirmationPolicyChange={setConfirmationPolicy}
          onDurationModeChange={setDurationMode}
          onFixedDurationChange={setFixedDuration}
          onMinimumDurationChange={setMinimumDuration}
          onMaximumDurationChange={setMaximumDuration}
          onBack={() => setCurrentStep(0)}
          onSubmit={handleBookingRulesSubmit}
        />
      );
    }

    if (currentStep === 2) {
      return (
        <StepAvailability
          timezone={organizationTimezone}
          persistedWindows={persistedWindows}
          draftWindows={draftWindows}
          submitting={submitting}
          error={error}
          onAddWindow={addAvailabilityWindow}
          onRemoveDraftWindow={removeDraftWindow}
          onDraftUpdate={updateDraftWindow}
          onToggleDraftWeekday={toggleDraftWeekday}
          onBack={() => setCurrentStep(1)}
          onSubmit={handleAvailabilitySubmit}
        />
      );
    }

    const reviewWindows = getReviewWindows();

    return (
      <div className="space-y-6">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">Basics</h3>
              <button
                type="button"
                onClick={() => setCurrentStep(0)}
                className="text-sm font-medium text-slate-700 hover:text-slate-950"
              >
                Edit
              </button>
            </div>
            <dl className="space-y-3 text-sm text-slate-700">
              <div>
                <dt className="text-slate-500">Name</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {name || "Not set"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Description</dt>
                <dd className="mt-1 text-slate-700">
                  {description || "No description provided."}
                </dd>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Capacity</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {capacity}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Price</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {formatMoneyMinorUnits(
                      toMinorUnits(Number(price || 0)),
                      currency,
                    )}
                  </dd>
                </div>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">
                Booking Rules
              </h3>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-sm font-medium text-slate-700 hover:text-slate-950"
              >
                Edit
              </button>
            </div>
            <dl className="space-y-3 text-sm text-slate-700">
              <div>
                <dt className="text-slate-500">Confirmation policy</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {confirmationPolicy === "AUTOMATIC"
                    ? "Automatic"
                    : "Requires approval"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Reservation duration</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {durationMode === "FIXED"
                    ? `Fixed: ${formatMinutes(fixedDuration)}`
                    : `Flexible: ${formatMinutes(minimumDuration)} to ${formatMinutes(maximumDuration)}`}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">
                Availability
              </h3>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="text-sm font-medium text-slate-700 hover:text-slate-950"
              >
                Edit
              </button>
            </div>
            <div className="space-y-4 text-sm text-slate-700">
              <div>
                <div className="text-slate-500">Timezone</div>
                <div className="mt-1 font-medium text-slate-900">
                  {organizationTimezone}
                </div>
              </div>

              {reviewWindows.length === 0 ? (
                <p className="text-slate-600">
                  No recurring availability added yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {reviewWindows.map((window, index) => (
                    <div
                      key={`${window.startTime}-${window.endTime}-${index}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="font-medium text-slate-900">
                        {formatWeekdayGroup(window.weekdays)}
                      </div>
                      <div className="mt-1 text-slate-600">
                        {window.startTime} → {window.endTime}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
          <Button
            type="button"
            variant="secondary"
            onClick={() => setCurrentStep(2)}
          >
            Back
          </Button>
          <Button type="button" onClick={handlePublish} disabled={publishing}>
            {publishing ? "Publishing..." : "Publish Bookable"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <WizardProgress currentStep={currentStep} />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Create Bookable
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Set up a draft bookable and continue through the guided setup flow.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {currentStepLabel}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {currentStep === 0 && "Basics"}
              {currentStep === 1 && "Booking Rules"}
              {currentStep === 2 && "Availability"}
              {currentStep === 3 && "Review & Publish"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {currentStep === 0 &&
                "Set the basic information for this bookable."}
              {currentStep === 1 &&
                "Configure the reservation behavior for this bookable."}
              {currentStep === 2 &&
                "Add availability windows for this bookable."}
              {currentStep === 3 && "Review your setup before publishing."}
            </p>
          </div>

          {renderStepContent()}

          {bookableId && currentStep > 0 && (
            <p className="mt-4 text-xs text-slate-500">
              Draft bookable ID: {bookableId}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
