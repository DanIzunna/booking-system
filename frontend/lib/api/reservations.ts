import { apiRequest } from "./client";
import type {
  ReservationConfirmation,
  ReservationCreateInput,
  ReservationResult,
} from "../../types/reservations";

export function createReservation(
  bookableId: string,
  input: ReservationCreateInput,
): Promise<ReservationResult> {
  return apiRequest<ReservationResult>(
    `/bookables/${encodeURIComponent(bookableId)}/reservations`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function confirmFreeReservation(
  reservationId: string,
): Promise<ReservationConfirmation> {
  return apiRequest<ReservationConfirmation>(
    `/reservations/${encodeURIComponent(reservationId)}/confirm-free`,
    { method: "POST" },
  );
}