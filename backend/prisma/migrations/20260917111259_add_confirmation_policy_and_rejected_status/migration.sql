-- CreateEnum
CREATE TYPE "ConfirmationPolicy" AS ENUM ('AUTOMATIC', 'REQUIRES_APPROVAL');

-- AlterEnum
ALTER TYPE "ReservationStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Bookable" ADD COLUMN     "confirmationPolicy" "ConfirmationPolicy" NOT NULL DEFAULT 'AUTOMATIC';
