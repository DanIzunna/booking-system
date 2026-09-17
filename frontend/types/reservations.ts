export interface ReservationCreateInput {
  startAt: string;
  endAt?: string;
  quantity: number;
}

export interface ReservationResult {
  id: string;
  bookableId: string;
  startAt: string;
  endAt: string;
  quantity: number;
  amount: number;
  currency: string;
  status: string;
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