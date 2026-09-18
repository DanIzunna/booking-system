export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED"
  | "COMPLETED";

export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";

export type ConfirmationPolicy = "AUTOMATIC" | "REQUIRES_APPROVAL";

export interface ReservationCreateInput {
  startAt: string;
  endAt?: string;
  quantity: number;
}

export interface ReservationPayment {
  id: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
}

export interface ReservationResult {
  id: string;
  bookableId: string;
  startAt: string;
  endAt: string;
  quantity: number;
  amount: number;
  currency: string;
  status: ReservationStatus;
  payment?: ReservationPayment | null;
  approvedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

export interface ReservationConfirmation extends ReservationResult {
  bookable: {
    name: string;
    organization: {
      name: string;
      timezone: string;
    };
  };
}

export interface OrganizationReservation {
  id: string;
  bookableId: string;
  startAt: string;
  endAt: string;
  quantity: number;
  amount: number;
  currency: string;
  status: ReservationStatus;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  bookable: {
    id: string;
    name: string;
    slug: string;
    confirmationPolicy: ConfirmationPolicy;
    organization: {
      id: string;
      name: string;
      timezone: string;
    };
  };
  customer: {
    id: string;
    name: string;
    email: string;
  };
  payment?: ReservationPayment;
}
