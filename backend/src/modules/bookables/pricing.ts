import { BadRequestException } from "@nestjs/common";
import { PricingType } from "@prisma/client";

export const SUPPORTED_CURRENCIES = ["EUR", "GBP", "NGN", "USD"] as const;

export function validatePricing(
  pricingType: PricingType,
  price: number | null | undefined,
  currency: string | null | undefined,
): void {
  if (pricingType === PricingType.FREE) {
    if (price !== null && price !== undefined) {
      throw new BadRequestException("Free Bookables must not have a price");
    }
    if (currency !== null && currency !== undefined) {
      throw new BadRequestException("Free Bookables must not have a currency");
    }
    return;
  }

  if (typeof price !== "number" || !Number.isInteger(price) || price <= 0) {
    throw new BadRequestException(
      "Paid Bookables require a positive integer price",
    );
  }
  if (
    typeof currency !== "string" ||
    !SUPPORTED_CURRENCIES.includes(
      currency as (typeof SUPPORTED_CURRENCIES)[number],
    )
  ) {
    throw new BadRequestException(
      `Paid Bookables require a supported currency: ${SUPPORTED_CURRENCIES.join(", ")}`,
    );
  }
}
