CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'PAYSTACK');

CREATE TYPE "OrganizationPaymentAccountStatus" AS ENUM (
  'ONBOARDING',
  'READY',
  'RESTRICTED',
  'DISCONNECTED'
);

CREATE TABLE "OrganizationPaymentAccount" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "providerAccountId" VARCHAR(255) NOT NULL,
  "status" "OrganizationPaymentAccountStatus" NOT NULL DEFAULT 'ONBOARDING',
  "readyForPayments" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "lastSyncedAt" TIMESTAMPTZ(3),
  "connectedAt" TIMESTAMPTZ(3),
  "disconnectedAt" TIMESTAMPTZ(3),

  CONSTRAINT "OrganizationPaymentAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationPaymentAccount_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrganizationPaymentAccount_organizationId_key"
  ON "OrganizationPaymentAccount"("organizationId");
CREATE UNIQUE INDEX "OrganizationPaymentAccount_provider_providerAccountId_key"
  ON "OrganizationPaymentAccount"("provider", "providerAccountId");
CREATE INDEX "OrganizationPaymentAccount_organizationId_status_idx"
  ON "OrganizationPaymentAccount"("organizationId", "status");
