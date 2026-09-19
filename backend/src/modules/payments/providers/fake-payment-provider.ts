import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  PaymentInitializationInput,
  PaymentInitializationResult,
  PaymentProvider,
  PaymentWebhookEvent,
} from "./payment-provider.interface";

const FAKE_SIGNATURE = "phase8-test-signature";

@Injectable()
export class FakePaymentProvider implements PaymentProvider {
  readonly name = "fake";

  async initializePayment(
    input: PaymentInitializationInput,
  ): Promise<PaymentInitializationResult> {
    this.assertEnabled();
    const providerReference = `fake_${input.idempotencyKey}`;
    return {
      providerReference,
      checkoutUrl: this.checkoutUrl(
        providerReference,
        input.amount,
        input.currency,
      ),
    };
  }

  verifyWebhook(
    payload: unknown,
    headers: Record<string, unknown>,
  ): PaymentWebhookEvent {
    this.assertEnabled();
    if (headers["x-fake-signature"] !== FAKE_SIGNATURE) {
      throw new UnauthorizedException("Invalid payment webhook signature");
    }
    if (!payload || typeof payload !== "object") {
      throw new BadRequestException("Invalid payment webhook payload");
    }
    const event = payload as Record<string, unknown>;
    if (
      typeof event.providerReference !== "string" ||
      (event.status !== "SUCCEEDED" && event.status !== "FAILED") ||
      typeof event.amount !== "number" ||
      typeof event.currency !== "string"
    ) {
      throw new BadRequestException("Invalid payment webhook payload");
    }
    return {
      providerReference: event.providerReference,
      status: event.status,
      amount: event.amount,
      currency: event.currency,
    };
  }

  checkoutUrl(
    providerReference: string,
    amount?: number,
    currency?: string,
  ): string {
    this.assertEnabled();
    const url = new URL(
      process.env.FAKE_CHECKOUT_BASE_URL ??
        "http://localhost:3000/fake-checkout",
    );
    url.searchParams.set("providerReference", providerReference);
    if (amount !== undefined) url.searchParams.set("amount", String(amount));
    if (currency !== undefined) url.searchParams.set("currency", currency);
    return url.toString();
  }

  private assertEnabled(): void {
    if (process.env.NODE_ENV === "production") {
      throw new BadRequestException(
        "The fake payment provider is disabled in production",
      );
    }
  }
}
