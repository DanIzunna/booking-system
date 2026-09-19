import type { BookableStatus, PricingType } from "./bookables";

export type PublicDurationMode = "FLEXIBLE" | "FIXED";
export type ConfirmationPolicy = "AUTOMATIC" | "REQUIRES_APPROVAL";

export interface PublicReservationRule {
  durationMode: PublicDurationMode;
  minimumDuration: number | null;
  maximumDuration: number | null;
  fixedDuration: number | null;
  minimumAdvanceTime: number | null;
  maximumAdvanceTime: number | null;
  cancellationDeadline: number | null;
}

export interface PublicBookable {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  capacity: number;
  status?: BookableStatus;
  pricingType: PricingType;
  confirmationPolicy: ConfirmationPolicy;
  organization: {
    id: string;
    name: string;
    timezone: string;
  };
  price: number | null;
  currency: string | null;
  reservationRule: PublicReservationRule | null;
}

export interface PublicOrganization {
  name: string;
  slug: string;
  timezone: string;
  bookables: Array<
    Pick<
      PublicBookable,
      | "slug"
      | "name"
      | "description"
      | "price"
      | "currency"
      | "capacity"
      | "pricingType"
    >
  >;
}

export interface PublicAvailabilityCheckInput {
  startAt: string;
  endAt: string;
  quantity: number;
}

export interface PublicAvailabilityCheckResult {
  available: boolean;
  reason?: string;
}

export interface PublicAvailabilitySlot {
  startAt: string;
  endAt: string;
}

export interface PublicAvailabilityResponse {
  date: string;
  timezone: string;
  capacity: number;
  durationMode: PublicDurationMode | null;
  durationSeconds: number | null;
  intervals: PublicAvailabilitySlot[];
  slots: PublicAvailabilitySlot[];
  reason?: string;
}
