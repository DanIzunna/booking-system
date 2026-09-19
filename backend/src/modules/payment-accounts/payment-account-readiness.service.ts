import { Injectable } from "@nestjs/common";
import type { PaymentAccountReadiness } from "./payment-account.types";
import { PaymentAccountsService } from "./payment-accounts.service";

@Injectable()
export class PaymentAccountReadinessService {
  constructor(private readonly accounts: PaymentAccountsService) {}

  isReady(organizationId: string): Promise<PaymentAccountReadiness> {
    return this.accounts.readiness(organizationId);
  }

  isEnforced(): boolean {
    if (process.env.PAYMENT_ACCOUNT_READINESS_ENFORCED === "true") return true;
    if (process.env.NODE_ENV === "test") return false;
    if (
      process.env.NODE_ENV !== "production" &&
      !process.env.STRIPE_SECRET_KEY
    ) {
      return false;
    }
    return true;
  }
}
