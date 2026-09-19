import {
  OrganizationPaymentAccountStatus,
  PaymentProvider,
} from "@prisma/client";
import { PaymentAccountReadinessService } from "../src/modules/payment-accounts/payment-account-readiness.service";
import { PaymentAccountsService } from "../src/modules/payment-accounts/payment-accounts.service";

describe("PaymentAccountsService readiness", () => {
  function setup() {
    const prisma = {
      organizationPaymentAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as any;
    const authorization = {
      requireMembership: jest.fn(),
      requireOwner: jest.fn(),
    } as any;
    const accounts = new PaymentAccountsService(prisma, authorization);
    const readiness = new PaymentAccountReadinessService(accounts);
    return { prisma, authorization, readiness };
  }

  it("returns not connected when an organization has no account", async () => {
    const { prisma, readiness } = setup();
    prisma.organizationPaymentAccount.findUnique.mockResolvedValue(null);

    await expect(readiness.isReady("organization-id")).resolves.toEqual({
      ready: false,
      reason: "NOT_CONNECTED",
    });
  });

  it.each([
    [OrganizationPaymentAccountStatus.ONBOARDING, "ONBOARDING"],
    [OrganizationPaymentAccountStatus.RESTRICTED, "RESTRICTED"],
    [OrganizationPaymentAccountStatus.DISCONNECTED, "DISCONNECTED"],
  ] as const)("maps %s to not-ready %s", async (status, reason) => {
    const { prisma, readiness } = setup();
    prisma.organizationPaymentAccount.findUnique.mockResolvedValue({
      provider: PaymentProvider.STRIPE,
      providerAccountId: "acct_test",
      status,
      readyForPayments: false,
    });

    await expect(readiness.isReady("organization-id")).resolves.toEqual({
      ready: false,
      provider: PaymentProvider.STRIPE,
      providerAccountId: "acct_test",
      reason,
    });
  });

  it("returns ready only for a READY account with readiness enabled", async () => {
    const { prisma, readiness } = setup();
    prisma.organizationPaymentAccount.findUnique.mockResolvedValue({
      provider: PaymentProvider.STRIPE,
      providerAccountId: "acct_test",
      status: OrganizationPaymentAccountStatus.READY,
      readyForPayments: true,
    });

    await expect(readiness.isReady("organization-id")).resolves.toEqual({
      ready: true,
      provider: PaymentProvider.STRIPE,
      providerAccountId: "acct_test",
    });
  });

  it("requires membership for reads and ownership for disconnects", async () => {
    const { prisma, authorization, readiness } = setup();
    prisma.organizationPaymentAccount.findUnique.mockResolvedValue(null);

    await readiness.isReady("organization-id");
    expect(prisma.organizationPaymentAccount.findUnique).toHaveBeenCalled();

    await expect(
      new PaymentAccountsService(prisma, authorization).getForMember(
        "member-id",
        "organization-id",
      ),
    ).resolves.toBeNull();
    expect(authorization.requireMembership).toHaveBeenCalledWith(
      "member-id",
      "organization-id",
    );
  });
});
