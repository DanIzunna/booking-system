-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "BookableStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DurationMode" AS ENUM ('FLEXIBLE', 'FIXED');

-- CreateEnum
CREATE TYPE "AvailabilityWindowType" AS ENUM ('RECURRING', 'SPECIFIC');

-- CreateEnum
CREATE TYPE "AvailabilityExceptionType" AS ENUM ('BLOCK', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AccessCodeStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'Africa/Lagos',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookable" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "slug" VARCHAR(160) NOT NULL,
    "status" "BookableStatus" NOT NULL DEFAULT 'DRAFT',
    "capacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Bookable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookableReservationRule" (
    "id" UUID NOT NULL,
    "bookableId" UUID NOT NULL,
    "durationMode" "DurationMode" NOT NULL,
    "minimumDuration" INTEGER,
    "maximumDuration" INTEGER,
    "fixedDuration" INTEGER,
    "minimumAdvanceTime" INTEGER,
    "maximumAdvanceTime" INTEGER,
    "cancellationDeadline" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BookableReservationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityWindow" (
    "id" UUID NOT NULL,
    "bookableId" UUID NOT NULL,
    "type" "AvailabilityWindowType" NOT NULL,
    "weekday" INTEGER,
    "startTime" VARCHAR(5),
    "endTime" VARCHAR(5),
    "startAt" TIMESTAMPTZ(3),
    "endAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AvailabilityWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" UUID NOT NULL,
    "bookableId" UUID NOT NULL,
    "type" "AvailabilityExceptionType" NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" UUID NOT NULL,
    "bookableId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "providerReference" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessCode" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "codeHash" VARCHAR(255) NOT NULL,
    "status" "AccessCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ(3),
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AccessCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookableImage" (
    "id" UUID NOT NULL,
    "bookableId" UUID NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "url" VARCHAR(2000) NOT NULL,
    "altText" VARCHAR(300),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BookableImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "operation" VARCHAR(120) NOT NULL,
    "requestHash" VARCHAR(128) NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_role_idx" ON "OrganizationMembership"("organizationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON "OrganizationMembership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookable_slug_key" ON "Bookable"("slug");

-- CreateIndex
CREATE INDEX "Bookable_organizationId_status_idx" ON "Bookable"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BookableReservationRule_bookableId_key" ON "BookableReservationRule"("bookableId");

-- CreateIndex
CREATE INDEX "AvailabilityWindow_bookableId_type_weekday_idx" ON "AvailabilityWindow"("bookableId", "type", "weekday");

-- CreateIndex
CREATE INDEX "AvailabilityWindow_bookableId_startAt_endAt_idx" ON "AvailabilityWindow"("bookableId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "AvailabilityException_bookableId_startAt_endAt_idx" ON "AvailabilityException"("bookableId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "Reservation_bookableId_startAt_endAt_idx" ON "Reservation"("bookableId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "Reservation_customerId_status_idx" ON "Reservation"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reservationId_key" ON "Payment"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerReference_key" ON "Payment"("provider", "providerReference");

-- CreateIndex
CREATE INDEX "AccessCode_reservationId_status_idx" ON "AccessCode"("reservationId", "status");

-- CreateIndex
CREATE INDEX "AccessCode_status_expiresAt_idx" ON "AccessCode"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "BookableImage_bookableId_sortOrder_idx" ON "BookableImage"("bookableId", "sortOrder");

-- CreateIndex
CREATE INDEX "RefreshSession_userId_expiresAt_idx" ON "RefreshSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_userId_expiresAt_idx" ON "IdempotencyRecord"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_userId_operation_key_key" ON "IdempotencyRecord"("userId", "operation", "key");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookable" ADD CONSTRAINT "Bookable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookableReservationRule" ADD CONSTRAINT "BookableReservationRule_bookableId_fkey" FOREIGN KEY ("bookableId") REFERENCES "Bookable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityWindow" ADD CONSTRAINT "AvailabilityWindow_bookableId_fkey" FOREIGN KEY ("bookableId") REFERENCES "Bookable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_bookableId_fkey" FOREIGN KEY ("bookableId") REFERENCES "Bookable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_bookableId_fkey" FOREIGN KEY ("bookableId") REFERENCES "Bookable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCode" ADD CONSTRAINT "AccessCode_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookableImage" ADD CONSTRAINT "BookableImage_bookableId_fkey" FOREIGN KEY ("bookableId") REFERENCES "Bookable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add database-enforced invariants that Prisma schema attributes cannot express.
ALTER TABLE "Bookable"
    ADD CONSTRAINT "Bookable_capacity_positive_chk" CHECK ("capacity" > 0);

ALTER TABLE "BookableReservationRule"
    ADD CONSTRAINT "BookableReservationRule_durations_positive_chk" CHECK (
        ("minimumDuration" IS NULL OR "minimumDuration" > 0)
        AND ("maximumDuration" IS NULL OR "maximumDuration" > 0)
        AND ("fixedDuration" IS NULL OR "fixedDuration" > 0)
        AND ("minimumAdvanceTime" IS NULL OR "minimumAdvanceTime" >= 0)
        AND ("maximumAdvanceTime" IS NULL OR "maximumAdvanceTime" >= 0)
        AND ("cancellationDeadline" IS NULL OR "cancellationDeadline" >= 0)
    );

ALTER TABLE "BookableReservationRule"
    ADD CONSTRAINT "BookableReservationRule_duration_mode_chk" CHECK (
        ("durationMode" = 'FLEXIBLE' AND "minimumDuration" IS NOT NULL AND "maximumDuration" IS NOT NULL AND "fixedDuration" IS NULL AND "minimumDuration" <= "maximumDuration")
        OR ("durationMode" = 'FIXED' AND "fixedDuration" IS NOT NULL AND "minimumDuration" IS NULL AND "maximumDuration" IS NULL)
    );

ALTER TABLE "AvailabilityWindow"
    ADD CONSTRAINT "AvailabilityWindow_shape_chk" CHECK (
        ("type" = 'RECURRING'
            AND "weekday" BETWEEN 0 AND 6
            AND "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            AND "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            AND "startTime" < "endTime"
            AND "startAt" IS NULL
            AND "endAt" IS NULL)
        OR ("type" = 'SPECIFIC'
            AND "weekday" IS NULL
            AND "startTime" IS NULL
            AND "endTime" IS NULL
            AND "startAt" IS NOT NULL
            AND "endAt" IS NOT NULL
            AND "startAt" < "endAt")
    );

ALTER TABLE "AvailabilityException"
    ADD CONSTRAINT "AvailabilityException_interval_order_chk" CHECK ("startAt" < "endAt");

ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_quantity_positive_chk" CHECK ("quantity" > 0),
    ADD CONSTRAINT "Reservation_interval_order_chk" CHECK ("startAt" < "endAt");

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_amount_nonnegative_chk" CHECK ("amount" >= 0);

ALTER TABLE "BookableImage"
    ADD CONSTRAINT "BookableImage_sort_order_nonnegative_chk" CHECK ("sortOrder" >= 0);
