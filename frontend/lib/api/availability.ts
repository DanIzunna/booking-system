import { apiRequest } from "./client";
import type {
  AvailabilityCheckResult,
  AvailabilityException,
  AvailabilityWindow,
  CreateAvailabilityExceptionInput,
  CreateAvailabilityWindowInput,
} from "../../types/availability";

function basePath(bookableId: string): string {
  return `/bookables/${encodeURIComponent(bookableId)}/availability`;
}

export function listAvailabilityWindows(bookableId: string): Promise<AvailabilityWindow[]> {
  return apiRequest<AvailabilityWindow[]>(`${basePath(bookableId)}/windows`);
}

export function createAvailabilityWindow(bookableId: string, input: CreateAvailabilityWindowInput): Promise<AvailabilityWindow> {
  return apiRequest<AvailabilityWindow>(`${basePath(bookableId)}/windows`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteAvailabilityWindow(bookableId: string, windowId: string): Promise<void> {
  return apiRequest<void>(`${basePath(bookableId)}/windows/${encodeURIComponent(windowId)}`, {
    method: "DELETE",
  });
}

export function listAvailabilityExceptions(bookableId: string): Promise<AvailabilityException[]> {
  return apiRequest<AvailabilityException[]>(`${basePath(bookableId)}/exceptions`);
}

export function createAvailabilityException(bookableId: string, input: CreateAvailabilityExceptionInput): Promise<AvailabilityException> {
  return apiRequest<AvailabilityException>(`${basePath(bookableId)}/exceptions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteAvailabilityException(bookableId: string, exceptionId: string): Promise<void> {
  return apiRequest<void>(`${basePath(bookableId)}/exceptions/${encodeURIComponent(exceptionId)}`, {
    method: "DELETE",
  });
}

export function checkAvailability(bookableId: string, startAt: string, endAt: string): Promise<AvailabilityCheckResult> {
  const query = new URLSearchParams({ startAt, endAt });
  return apiRequest<AvailabilityCheckResult>(`${basePath(bookableId)}/check?${query.toString()}`);
}