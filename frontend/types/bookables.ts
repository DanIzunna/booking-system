export type BookableStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type ReservationDurationMode = "FLEXIBLE" | "FIXED";
export type PricingType = "FREE" | "PAID";

export interface BookableReservationRule {
  durationMode: ReservationDurationMode;
  minimumDuration: number | null;
  maximumDuration: number | null;
  fixedDuration: number | null;
  minimumAdvanceTime: number | null;
  maximumAdvanceTime: number | null;
  cancellationDeadline: number | null;
}

export type ConfirmationPolicy = "AUTOMATIC" | "REQUIRES_APPROVAL";

export interface Bookable {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  images: BookableImage[];
  slug: string;
  status: BookableStatus;
  pricingType: PricingType;
  confirmationPolicy?: ConfirmationPolicy;
  price: number | null;
  currency: string | null;
  capacity: number;
  createdAt: string;
  updatedAt: string;
  reservationRule: BookableReservationRule | null;
}

export interface BookableImage {
  id: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface CreateBookableInput {
  organizationId: string;
  name: string;
  description?: string;
  capacity: number;
  pricingType: PricingType;
  price?: number | null;
  currency?: string | null;
  status?: BookableStatus;
  reservationRule?: ReservationRuleInput;
  confirmationPolicy?: ConfirmationPolicy;
}

export interface UpdateBookableInput {
  name?: string;
  description?: string;
  slug?: string;
  status?: BookableStatus;
  pricingType?: PricingType;
  capacity?: number;
  price?: number | null;
  currency?: string | null;
  confirmationPolicy?: ConfirmationPolicy;
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
