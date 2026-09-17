import { apiRequest } from "./client";
import type {
  PublicAvailabilityCheckInput,
  PublicAvailabilityCheckResult,
  PublicAvailabilityResponse,
  PublicBookable,
} from "../../types/public-booking";

function basePath(slug: string): string {
  return `/public/bookables/${encodeURIComponent(slug)}`;
}

export function getPublicBookable(slug: string): Promise<PublicBookable> {
  return apiRequest<PublicBookable>(basePath(slug));
}

export function checkPublicAvailability(
  slug: string,
  input: PublicAvailabilityCheckInput,
): Promise<PublicAvailabilityCheckResult> {
  const query = new URLSearchParams({
    startAt: input.startAt,
    endAt: input.endAt,
    quantity: String(input.quantity),
  });
  return apiRequest<PublicAvailabilityCheckResult>(
    `${basePath(slug)}/availability/check?${query.toString()}`,
  );
}

export function getPublicAvailability(
  slug: string,
  date: string,
  quantity = 1,
): Promise<PublicAvailabilityResponse> {
  const query = new URLSearchParams({ date, quantity: String(quantity) });
  return apiRequest<PublicAvailabilityResponse>(
    `${basePath(slug)}/availability?${query.toString()}`,
  );
}