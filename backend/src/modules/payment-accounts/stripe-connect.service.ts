import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import Stripe from "stripe";
import {
  OrganizationPaymentAccountStatus,
  PaymentProvider,
} from "@prisma/client";
import { PaymentAccountsService } from "./payment-accounts.service";
import type { NormalizedPaymentAccountState } from "./payment-account.types";

@Injectable()
export class StripeConnectService {
  private readonly stripe: Stripe | null;

  constructor(private readonly accounts: PaymentAccountsService) {
    this.stripe = process.env.STRIPE_SECRET_KEY
      ? new Stripe(process.env.STRIPE_SECRET_KEY)
      : null;
  }

  async connect(userId: string, organizationId: string) {
    try {
      const existing = await this.accounts.getForOwner(userId, organizationId);
      if (existing && existing.provider !== PaymentProvider.STRIPE) {
        throw new ConflictException(
          "Organization uses another payment provider",
        );
      }

      const stripe = this.client();
      const account = existing
        ? await stripe.accounts.retrieve(existing.providerAccountId)
        : await stripe.accounts.create({ type: "express" });
      const state = normalizeStripeAccount(account);

      if (!existing) {
        await this.accounts.create(userId, organizationId, state);
      } else {
        await this.accounts.updateFromProvider(userId, organizationId, state);
      }

      return {
        account: await this.accounts.getForOwner(userId, organizationId),
        onboardingUrl: await this.createOnboardingLink(
          account.id,
          organizationId,
        ),
      };
    } catch (error) {
      throw mapStripeError(error);
    }
  }

  async sync(userId: string, organizationId: string) {
    const existing = await this.accounts.getForOwner(userId, organizationId);
    if (!existing || existing.provider !== PaymentProvider.STRIPE) {
      throw new ConflictException("Stripe payment account is not connected");
    }
    try {
      const state = normalizeStripeAccount(
        await this.client().accounts.retrieve(existing.providerAccountId),
      );
      const account = await this.accounts.updateFromProvider(
        userId,
        organizationId,
        state,
      );
      return { account };
    } catch (error) {
      throw mapStripeError(error);
    }
  }

  async createAccountLink(userId: string, organizationId: string) {
    const existing = await this.accounts.getForOwner(userId, organizationId);
    if (!existing || existing.provider !== PaymentProvider.STRIPE) {
      throw new ConflictException("Stripe payment account is not connected");
    }
    try {
      return {
        onboardingUrl: await this.createOnboardingLink(
          existing.providerAccountId,
          organizationId,
        ),
      };
    } catch (error) {
      throw mapStripeError(error);
    }
  }

  private async createOnboardingLink(
    accountId: string,
    organizationId: string,
  ) {
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
    const link = await this.client().accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/organizations/${organizationId}/settings/payments`,
      return_url: `${baseUrl}/organizations/${organizationId}/settings/payments`,
      type: "account_onboarding",
    });
    return link.url;
  }

  private client(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        "Stripe Connect is not configured on the server",
      );
    }
    return this.stripe;
  }
}

function mapStripeError(error: unknown): unknown {
  if (
    error instanceof ConflictException ||
    error instanceof ServiceUnavailableException
  ) {
    return error;
  }
  if (error instanceof Stripe.errors.StripeError) {
    if (error.message.toLowerCase().includes("signed up for connect")) {
      return new ServiceUnavailableException(
        "Stripe Connect is not enabled for this platform.",
      );
    }
    return new ServiceUnavailableException(
      "Stripe Connect is temporarily unavailable.",
    );
  }
  return error;
}

function normalizeStripeAccount(
  account: Stripe.Account,
): NormalizedPaymentAccountState {
  const requirements = account.requirements;
  const restricted = Boolean(
    account.requirements?.disabled_reason ||
    requirements?.currently_due?.length ||
    requirements?.past_due?.length,
  );
  const ready = Boolean(
    account.details_submitted &&
    account.charges_enabled &&
    account.payouts_enabled &&
    !restricted,
  );

  return {
    provider: PaymentProvider.STRIPE,
    providerAccountId: account.id,
    status: ready
      ? OrganizationPaymentAccountStatus.READY
      : restricted
        ? OrganizationPaymentAccountStatus.RESTRICTED
        : OrganizationPaymentAccountStatus.ONBOARDING,
    readyForPayments: ready,
    lastSyncedAt: new Date(),
  };
}
