export interface BookingSelection {
  organizationSlug: string;
  bookableSlug: string;
  date: string;
  startAt: string;
  endAt?: string;
  durationSeconds?: number;
  quantity: number;
}

const STORAGE_KEY = "bookable:pending-booking";

export function saveBookingSelection(selection: BookingSelection): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }
}

export function loadBookingSelection(): BookingSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isBookingSelection(parsed)) {
      clearBookingSelection();
      return null;
    }
    return parsed;
  } catch {
    clearBookingSelection();
    return null;
  }
}

export function clearBookingSelection(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }
}

export function isInternalReturnTo(value: string | null): value is string {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}

function isBookingSelection(value: unknown): value is BookingSelection {
  if (!value || typeof value !== "object") return false;
  const selection = value as Partial<BookingSelection>;
  return (
    typeof selection.organizationSlug === "string" &&
    selection.organizationSlug.length > 0 &&
    typeof selection.bookableSlug === "string" &&
    selection.bookableSlug.length > 0 &&
    typeof selection.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(selection.date) &&
    typeof selection.startAt === "string" &&
    isValidTimestamp(selection.startAt) &&
    ((selection.endAt === undefined &&
      selection.durationSeconds === undefined) ||
      (typeof selection.endAt === "string" &&
        isValidTimestamp(selection.endAt) &&
        typeof selection.durationSeconds === "number" &&
        Number.isInteger(selection.durationSeconds) &&
        selection.durationSeconds > 0)) &&
    typeof selection.quantity === "number" &&
    Number.isInteger(selection.quantity) &&
    selection.quantity > 0
  );
}

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}
