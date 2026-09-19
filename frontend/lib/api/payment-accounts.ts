import { apiRequest } from "./client";
import type {
  OrganizationPaymentAccount,
  PaymentAccountConnectResponse,
} from "../../types/payment-accounts";

export function getPaymentAccount(
  organizationId: string,
): Promise<OrganizationPaymentAccount | null> {
  return apiRequest<unknown>(
    `/organizations/${encodeURIComponent(organizationId)}/payment-account`,
  ).then((account) => {
    if (
      account &&
      typeof account === "object" &&
      !Array.isArray(account) &&
      "provider" in account
    ) {
      return account as OrganizationPaymentAccount;
    }
    return null;
  });
}

export function connectStripe(
  organizationId: string,
): Promise<PaymentAccountConnectResponse> {
  return apiRequest<PaymentAccountConnectResponse>(
    `/organizations/${encodeURIComponent(organizationId)}/payment-account/connect`,
    { method: "POST" },
  );
}

export function syncPaymentAccount(
  organizationId: string,
): Promise<{ account: OrganizationPaymentAccount }> {
  return apiRequest<{ account: OrganizationPaymentAccount }>(
    `/organizations/${encodeURIComponent(organizationId)}/payment-account/sync`,
    { method: "POST" },
  );
}


export function disconnectPaymentAccount(
  organizationId: string,
): Promise<OrganizationPaymentAccount> {
  return apiRequest<OrganizationPaymentAccount>(
    `/organizations/${encodeURIComponent(organizationId)}/payment-account/disconnect`,
    { method: "POST" },
  );
}
