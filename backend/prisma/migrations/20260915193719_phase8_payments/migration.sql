/*
  Warnings:

  - Payment amounts are converted from major units to integer minor units by multiplying by 100 during this development migration.

*/
-- AlterTable
ALTER TABLE "Bookable" ADD COLUMN     "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
ADD COLUMN     "price" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "paidAt" TIMESTAMPTZ(3),
ALTER COLUMN "amount" SET DATA TYPE INTEGER USING ROUND("amount" * 100)::INTEGER;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currency" CHAR(3) NOT NULL DEFAULT 'NGN';
