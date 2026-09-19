import { apiRequest } from "./client";
import { toMinorUnits } from "../currency";
import type {
  Bookable,
  CreateBookableInput,
  UpdateBookableInput,
} from "../../types/bookables";

export function listBookables(organizationId: string): Promise<Bookable[]> {
  return apiRequest<Bookable[]>(
    `/bookables?organizationId=${encodeURIComponent(organizationId)}`,
  );
}

export function getBookable(bookableId: string): Promise<Bookable> {
  return apiRequest<Bookable>(`/bookables/${bookableId}`);
}

export function createBookable(input: CreateBookableInput): Promise<Bookable> {
  return apiRequest<Bookable>("/bookables", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      status: input.status ?? "DRAFT",
      price:
        input.pricingType === "FREE" || input.price == null
          ? null
          : toMinorUnits(input.price),
      currency:
        input.pricingType === "FREE" || input.currency == null
          ? null
          : input.currency.toUpperCase(),
    }),
  });
}

export function updateBookable(
  bookableId: string,
  input: UpdateBookableInput,
): Promise<Bookable> {
  const { price, currency, ...rest } = input;
  return apiRequest<Bookable>(`/bookables/${bookableId}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...rest,
      ...(price !== undefined && price !== null
        ? { price: toMinorUnits(price) }
        : {}),
      ...(currency !== undefined && currency !== null
        ? { currency: currency.toUpperCase() }
        : {}),
    }),
  });
}

export function archiveBookable(bookableId: string): Promise<Bookable> {
  return apiRequest<Bookable>(`/bookables/${bookableId}/archive`, {
    method: "POST",
  });
}

export function restoreBookable(bookableId: string): Promise<Bookable> {
  return apiRequest<Bookable>(`/bookables/${bookableId}/restore`, {
    method: "POST",
  });
}
