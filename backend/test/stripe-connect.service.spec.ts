import { ServiceUnavailableException } from "@nestjs/common";
import { StripeConnectService } from "../src/modules/payment-accounts/stripe-connect.service";

describe("StripeConnectService configuration", () => {
  it("returns a client-safe unavailable error when Stripe is not configured", async () => {
    const previousKey = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;

    try {
      const service = new StripeConnectService({
        getForOwner: jest.fn().mockResolvedValue(null),
      } as any);
      await expect(
        service.connect("owner-id", "organization-id"),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(
        service.connect("owner-id", "organization-id"),
      ).rejects.toMatchObject({
        status: 503,
        message: "Stripe Connect is not configured on the server",
      });
    } finally {
      if (previousKey === undefined) {
        delete process.env.STRIPE_SECRET_KEY;
      } else {
        process.env.STRIPE_SECRET_KEY = previousKey;
      }
    }
  });
});
