import type {
  OrganizationPaymentAccountStatus,
  PaymentProvider,
} from "@prisma/client";

export type PaymentAccountReadinessReason =
  "NOT_CONNECTED" | "ONBOARDING" | "RESTRICTED" | "DISCONNECTED";

export interface PaymentAccountReadiness {
  ready: boolean;
  provider?: PaymentProvider;
  providerAccountId?: string;
  reason?: PaymentAccountReadinessReason;
}

export interface NormalizedPaymentAccountState {
  provider: PaymentProvider;
  providerAccountId: string;
  status: OrganizationPaymentAccountStatus;
  readyForPayments: boolean;
  lastSyncedAt?: Date;
}
