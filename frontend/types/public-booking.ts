import type { BookableStatus } from "./bookables";

export type PublicDurationMode = "FLEXIBLE" | "FIXED";

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
  organization: {
    id: string;
    name: string;
    timezone: string;
  };
  price: number;
  currency: string;
  reservationRule: PublicReservationRule | null;
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