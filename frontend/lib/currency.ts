export function toMinorUnits(
  amount: number | string | null | undefined,
): number {
  const numeric = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return Math.round(numeric * 100);
}

export function toMajorUnits(
  amount: number | string | null | undefined,
): number {
  const numeric = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return Math.round(numeric / 100);
}

export function formatMoneyMinorUnits(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  const numeric = Number.isFinite(amount) ? Number(amount) : 0;
  const safeCurrency =
    typeof currency === "string" && /^[A-Z]{3}$/.test(currency)
      ? currency
      : "USD";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: safeCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric / 100);
}
