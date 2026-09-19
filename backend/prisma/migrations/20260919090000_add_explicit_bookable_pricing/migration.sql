CREATE TYPE "PricingType" AS ENUM ('FREE', 'PAID');

ALTER TABLE "Bookable"
ADD COLUMN "pricingType" "PricingType";

ALTER TABLE "Bookable"
ALTER COLUMN "price" DROP NOT NULL,
ALTER COLUMN "currency" DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Bookable"
    WHERE "price" < 0
      OR ("price" > 0 AND ("currency" IS NULL OR "currency" !~ '^[A-Z]{3}$'))
  ) THEN
    RAISE EXCEPTION 'Cannot migrate Bookable pricing: invalid legacy paid pricing data exists';
  END IF;
END $$;

UPDATE "Bookable"
SET "pricingType" = CASE
  WHEN "price" = 0 THEN 'FREE'::"PricingType"
  ELSE 'PAID'::"PricingType"
END;

UPDATE "Bookable"
SET "price" = NULL,
    "currency" = NULL
WHERE "pricingType" = 'FREE'::"PricingType";

ALTER TABLE "Bookable"
ALTER COLUMN "pricingType" SET NOT NULL,
ALTER COLUMN "price" DROP DEFAULT,
ALTER COLUMN "currency" DROP DEFAULT;
