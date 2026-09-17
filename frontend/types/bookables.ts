export type BookableStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type ReservationDurationMode = "FLEXIBLE" | "FIXED";

export interface BookableReservationRule {
  durationMode: ReservationDurationMode;
  minimumDuration: number | null;
  maximumDuration: number | null;
  fixedDuration: number | null;
  minimumAdvanceTime: number | null;
  maximumAdvanceTime: number | null;
  cancellationDeadline: number | null;
}

export interface Bookable {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  slug: string;
  status: BookableStatus;
  capacity: number;
  createdAt: string;
  updatedAt: string;
  reservationRule: BookableReservationRule | null;
}

export interface CreateBookableInput {
  organizationId: string;
  name: string;
  description?: string;
  capacity: number;
  reservationRule?: ReservationRuleInput;
}

export interface UpdateBookableInput {
  name?: string;
  description?: string;
  slug?: string;
  status?: BookableStatus;
  capacity?: number;
  reservationRule?: ReservationRuleInput;
}

export interface ReservationRuleInput {
  durationMode: ReservationDurationMode;
  fixedDuration?: number;
  minimumDuration?: number;
  maximumDuration?: number;
  minimumAdvanceTime?: number;
  maximumAdvanceTime?: number;
  cancellationDeadline?: number;
}
