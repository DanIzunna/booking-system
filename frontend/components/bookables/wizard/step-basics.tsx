import type { FormEvent } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import type { BookableCapacityType, PricingType } from "../../../types/bookables";

interface StepBasicsProps {
  name: string;
  description: string;
  capacity: string;
  pricingType: PricingType;
  capacityType: BookableCapacityType;
  price: string;
  currency: string;
  submitting: boolean;
  error: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCapacityChange: (value: string) => void;
  onPricingTypeChange: (value: PricingType) => void;
  onCapacityTypeChange: (value: BookableCapacityType) => void;
  onPriceChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function StepBasics({
  name,
  description,
  capacity,
  pricingType,
  capacityType,
  price,
  currency,
  submitting,
  error,
  onNameChange,
  onDescriptionChange,
  onCapacityChange,
  onPricingTypeChange,
  onCapacityTypeChange,
  onPriceChange,
  onCurrencyChange,
  onSubmit,
}: StepBasicsProps) {
  return (
    <form className="space-y-6" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="wizard-bookable-name">Name</Label>
        <Input
          id="wizard-bookable-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Main consultation room"
          maxLength={200}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wizard-bookable-description">Description</Label>
        <textarea
          id="wizard-bookable-description"
          className="min-h-28 w-full rounded-[6px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="A short description of what this resource is for."
          rows={4}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="wizard-bookable-capacity">Capacity</Label>
          <Input
            id="wizard-bookable-capacity"
            type="number"
            min="1"
            step="1"
            value={capacity}
            onChange={(event) => onCapacityChange(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wizard-bookable-capacity-type">Capacity meaning</Label>
          <select
            id="wizard-bookable-capacity-type"
            value={capacityType}
            onChange={(event) =>
              onCapacityTypeChange(event.target.value as BookableCapacityType)
            }
            className="min-h-10 w-full rounded-[6px] border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
          >
            <option value="RESOURCE">Units / copies</option>
            <option value="EVENT">Attendees / guests</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wizard-bookable-pricing-type">Pricing</Label>
          <select
            id="wizard-bookable-pricing-type"
            value={pricingType}
            onChange={(event) =>
              onPricingTypeChange(event.target.value as PricingType)
            }
            className="min-h-10 w-full rounded-[6px] border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
          >
            <option value="FREE">Free</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
      </div>

      {pricingType === "PAID" && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wizard-bookable-price">Price</Label>
            <Input
              id="wizard-bookable-price"
              type="number"
              min="1"
              step="1"
              value={price}
              onChange={(event) => onPriceChange(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wizard-bookable-currency">Currency</Label>
            <select
              id="wizard-bookable-currency"
              value={currency}
              onChange={(event) => onCurrencyChange(event.target.value)}
              className="min-h-10 w-full rounded-[6px] border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
            >
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
      )}

      {error && (
        <p
          className="border-l-2 border-rose-500 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Continue →"}
        </Button>
      </div>
    </form>
  );
}
