export type PaymentProvider = "STRIPE" | "PAYSTACK";
export type PaymentAccountStatus =
  | "ONBOARDING"
  | "READY"
  | "RESTRICTED"
  | "DISCONNECTED";

export interface OrganizationPaymentAccount {
  id: string;
  organizationId: string;
  provider: PaymentProvider;
  providerAccountId: string;
  status: PaymentAccountStatus;
  readyForPayments: boolean;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
}

export interface PaymentAccountConnectResponse {
  account: OrganizationPaymentAccount;
  onboardingUrl: string;
}
