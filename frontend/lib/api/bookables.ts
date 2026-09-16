import { apiRequest } from "./client";
import type {
  Bookable,
  CreateBookableInput,
  UpdateBookableInput,
} from "../../types/bookables";

export function listBookables(organizationId: string): Promise<Bookable[]> {
  return apiRequest<Bookable[]>(`/bookables?organizationId=${encodeURIComponent(organizationId)}`);
}

export function getBookable(bookableId: string): Promise<Bookable> {
  return apiRequest<Bookable>(`/bookables/${bookableId}`);
}

export function createBookable(input: CreateBookableInput): Promise<Bookable> {
  return apiRequest<Bookable>("/bookables", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBookable(bookableId: string, input: UpdateBookableInput): Promise<Bookable> {
  return apiRequest<Bookable>(`/bookables/${bookableId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function archiveBookable(bookableId: string): Promise<Bookable> {
  return apiRequest<Bookable>(`/bookables/${bookableId}/archive`, {
    method: "POST",
  });
}