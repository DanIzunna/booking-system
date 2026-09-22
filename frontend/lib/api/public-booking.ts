import { apiRequest } from "./client";
import type {
  PublicAvailabilityCheckInput,
  PublicAvailabilityCheckResult,
  PublicAvailabilityResponse,
  PublicBookable,
  PublicBookableImage,
  PublicOrganization,
} from "../../types/public-booking";

export type PublicOrganizationCatalog = Omit<
  PublicOrganization,
  "bookables"
> & {
  bookables: Array<
    PublicOrganization["bookables"][number] & {
      images: PublicBookableImage[];
    }
  >;
};

function basePath(organizationSlug: string, bookableSlug?: string): string {
  const path = [organizationSlug, bookableSlug]
    .filter(Boolean)
    .map((value) => encodeURIComponent(value!))
    .join("/");
  return `/public/bookables/${path}`;
}

export function getPublicOrganization(
  organizationSlug: string,
): Promise<PublicOrganizationCatalog> {
  return apiRequest<PublicOrganizationCatalog>(
    `/public/bookables/organizations/${encodeURIComponent(organizationSlug)}`,
  );
}

export function getPublicBookable(
  bookableSlug: string,
): Promise<PublicBookable>;
export function getPublicBookable(
  organizationSlug: string,
  bookableSlug: string,
): Promise<PublicBookable>;
export function getPublicBookable(
  organizationSlug: string,
  bookableSlug?: string,
): Promise<PublicBookable> {
  return apiRequest<PublicBookable>(
    bookableSlug
      ? basePath(organizationSlug, bookableSlug)
      : `/public/bookables/${encodeURIComponent(organizationSlug)}`,
  );
}

export function checkPublicAvailability(
  slug: string,
  input: PublicAvailabilityCheckInput,
): Promise<PublicAvailabilityCheckResult>;
export function checkPublicAvailability(
  organizationSlug: string,
  bookableSlug: string,
  input: PublicAvailabilityCheckInput,
): Promise<PublicAvailabilityCheckResult>;
export function checkPublicAvailability(
  organizationOrSlug: string,
  bookableOrInput: string | PublicAvailabilityCheckInput,
  maybeInput?: PublicAvailabilityCheckInput,
): Promise<PublicAvailabilityCheckResult> {
  const input =
    typeof bookableOrInput === "string" ? maybeInput! : bookableOrInput;
  const query = new URLSearchParams({
    startAt: input.startAt,
    endAt: input.endAt,
    quantity: String(input.quantity),
  });
  return apiRequest<PublicAvailabilityCheckResult>(
    `${typeof bookableOrInput === "string" ? basePath(organizationOrSlug, bookableOrInput) : `/public/bookables/${encodeURIComponent(organizationOrSlug)}`}/availability/check?${query.toString()}`,
  );
}

export function getPublicAvailability(
  slug: string,
  date: string,
  quantity?: number,
): Promise<PublicAvailabilityResponse>;
export function getPublicAvailability(
  organizationSlug: string,
  bookableSlug: string,
  date: string,
  quantity?: number,
): Promise<PublicAvailabilityResponse>;
export function getPublicAvailability(
  organizationOrSlug: string,
  bookableOrDate: string,
  dateOrQuantity?: string | number,
  maybeQuantity = 1,
): Promise<PublicAvailabilityResponse> {
  const nested = typeof dateOrQuantity === "string";
  const date = nested ? dateOrQuantity : bookableOrDate;
  const quantity = nested ? maybeQuantity : (dateOrQuantity ?? 1);
  const query = new URLSearchParams({ date, quantity: String(quantity) });
  return apiRequest<PublicAvailabilityResponse>(
    `${nested ? basePath(organizationOrSlug, bookableOrDate) : `/public/bookables/${encodeURIComponent(organizationOrSlug)}`}/availability?${query.toString()}`,
  );
}
