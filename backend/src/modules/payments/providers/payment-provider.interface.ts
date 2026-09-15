export type NormalizedPaymentStatus = "SUCCEEDED" | "FAILED";

export interface PaymentInitializationInput {
  reservationId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
}

export interface PaymentInitializationResult {
  providerReference: string;
  checkoutUrl: string;
}

export interface PaymentWebhookEvent {
  providerReference: string;
  status: NormalizedPaymentStatus;
  amount: number;
  currency: string;
}

export interface PaymentProvider {
  readonly name: string;
  initializePayment(
    input: PaymentInitializationInput,
  ): Promise<PaymentInitializationResult>;
  verifyWebhook(
    payload: unknown,
    headers: Record<string, unknown>,
  ): PaymentWebhookEvent;
}
