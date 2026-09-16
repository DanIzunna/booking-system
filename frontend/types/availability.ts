export type AvailabilityWindowType = "RECURRING" | "SPECIFIC";
export type AvailabilityExceptionType = "BLOCK" | "OVERRIDE";

export interface AvailabilityWindow {
  id: string;
  bookableId: string;
  type: AvailabilityWindowType;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityException {
  id: string;
  bookableId: string;
  type: AvailabilityExceptionType;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAvailabilityWindowInput {
  type: AvailabilityWindowType;
  weekday?: number;
  startTime?: string;
  endTime?: string;
  startAt?: string;
  endAt?: string;
}

export interface CreateAvailabilityExceptionInput {
  type: AvailabilityExceptionType;
  startAt: string;
  endAt: string;
}

export interface AvailabilityInterval {
  startAt: string;
  endAt: string;
}

export interface AvailabilityCheckResult {
  available: boolean;
  startAt: string;
  endAt: string;
  intervals: AvailabilityInterval[];
}