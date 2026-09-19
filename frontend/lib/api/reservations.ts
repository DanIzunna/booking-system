import { apiRequest } from "./client";
import type {
  OrganizationReservation,
  ReservationConfirmation,
  ReservationCreateInput,
  ReservationResult,
  ReservationStatus,
} from "../../types/reservations";

export interface ListOrganizationReservationsParams {
  bookableId?: string;
  status?: ReservationStatus;
  date?: string;
}

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

export function listCustomerReservations(): Promise<ReservationResult[]> {
  return apiRequest<ReservationResult[]>("/reservations");
}

export function getCustomerReservation(
  reservationId: string,
): Promise<ReservationResult> {
  return apiRequest<ReservationResult>(
    `/reservations/${encodeURIComponent(reservationId)}`,
  );
}

export function listOrganizationReservations(
  organizationId: string,
  params: ListOrganizationReservationsParams = {},
): Promise<OrganizationReservation[]> {
  const search = new URLSearchParams();

  if (params.bookableId) search.set("bookableId", params.bookableId);
  if (params.status) search.set("status", params.status);
  if (params.date) search.set("date", params.date);

  const query = search.toString();
  return apiRequest<OrganizationReservation[]>(
    `/organizations/${encodeURIComponent(organizationId)}/reservations${query ? `?${query}` : ""}`,
  );
}

export function getOrganizationReservation(
  organizationId: string,
  reservationId: string,
): Promise<OrganizationReservation> {
  return apiRequest<OrganizationReservation>(
    `/organizations/${encodeURIComponent(organizationId)}/reservations/${encodeURIComponent(reservationId)}`,
  );
}

export function approveOrganizationReservation(
  organizationId: string,
  reservationId: string,
): Promise<OrganizationReservation> {
  return apiRequest<OrganizationReservation>(
    `/organizations/${encodeURIComponent(organizationId)}/reservations/${encodeURIComponent(reservationId)}/approve`,
    { method: "POST" },
  );
}

export function rejectOrganizationReservation(
  organizationId: string,
  reservationId: string,
): Promise<OrganizationReservation> {
  return apiRequest<OrganizationReservation>(
    `/organizations/${encodeURIComponent(organizationId)}/reservations/${encodeURIComponent(reservationId)}/reject`,
    { method: "POST" },
  );
}
