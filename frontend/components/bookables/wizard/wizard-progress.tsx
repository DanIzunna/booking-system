import { cn } from "../../../lib/utils";

const steps = [
  { label: "Basics" },
  { label: "Booking Rules" },
  { label: "Availability" },
  { label: "Review" },
] as const;

interface WizardProgressProps {
  currentStep: number;
}

export function WizardProgress({ currentStep }: WizardProgressProps) {
  return (
    <div className="mb-8">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
        Create Bookable
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = index < currentStep;

          return (
            <div key={step.label} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex min-h-8 min-w-8 items-center justify-center rounded-full border text-xs font-semibold",
                  isActive && "border-teal-700 bg-teal-700 text-white",
                  isComplete && "border-teal-600 bg-teal-50 text-teal-700",
                  !isActive &&
                    !isComplete &&
                    "border-slate-200 bg-white text-slate-500",
                )}
              >
                {index + 1}
              </div>
              <span
                className={cn(
                  "hidden font-medium sm:inline",
                  isActive && "text-slate-900",
                  isComplete && "text-teal-700",
                  !isActive && !isComplete && "text-slate-500",
                )}
                title={step.label}
              >
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <span className="text-slate-300" aria-hidden="true">
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
