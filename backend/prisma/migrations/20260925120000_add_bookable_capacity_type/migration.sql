CREATE TYPE "BookableCapacityType" AS ENUM ('RESOURCE', 'EVENT');

ALTER TABLE "Bookable"
ADD COLUMN "capacityType" "BookableCapacityType" NOT NULL DEFAULT 'RESOURCE';
