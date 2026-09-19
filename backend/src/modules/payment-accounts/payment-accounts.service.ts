import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrganizationPaymentAccountStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { OrganizationAuthorizationService } from "../organizations/organization-authorization.service";
import type {
  NormalizedPaymentAccountState,
  PaymentAccountReadiness,
} from "./payment-account.types";

const paymentAccountSelect = {
  id: true,
  organizationId: true,
  provider: true,
  providerAccountId: true,
  status: true,
  readyForPayments: true,
  createdAt: true,
  updatedAt: true,
  lastSyncedAt: true,
  connectedAt: true,
  disconnectedAt: true,
} satisfies Prisma.OrganizationPaymentAccountSelect;

@Injectable()
export class PaymentAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: OrganizationAuthorizationService,
  ) {}

  async getForMember(userId: string, organizationId: string) {
    await this.authorization.requireMembership(userId, organizationId);
    return this.prisma.organizationPaymentAccount.findUnique({
      where: { organizationId },
      select: paymentAccountSelect,
    });
  }

  async getForOwner(userId: string, organizationId: string) {
    await this.authorization.requireOwner(userId, organizationId);
    return this.prisma.organizationPaymentAccount.findUnique({
      where: { organizationId },
      select: paymentAccountSelect,
    });
  }

  async create(
    userId: string,
    organizationId: string,
    state: NormalizedPaymentAccountState,
  ) {
    await this.authorization.requireOwner(userId, organizationId);
    const existing = await this.prisma.organizationPaymentAccount.findUnique({
      where: { organizationId },
    });
    if (existing) {
      throw new ConflictException("Organization already has a payment account");
    }

    return this.prisma.organizationPaymentAccount.create({
      data: {
        organizationId,
        provider: state.provider,
        providerAccountId: state.providerAccountId,
        status: state.status,
        readyForPayments: state.readyForPayments,
        lastSyncedAt: state.lastSyncedAt ?? null,
        connectedAt: new Date(),
      },
      select: paymentAccountSelect,
    });
  }

  async updateFromProvider(
    userId: string,
    organizationId: string,
    state: NormalizedPaymentAccountState,
  ) {
    await this.authorization.requireOwner(userId, organizationId);
    const existing = await this.prisma.organizationPaymentAccount.findUnique({
      where: { organizationId },
    });
    if (!existing) throw new NotFoundException("Payment account not found");
    if (
      existing.provider !== state.provider ||
      existing.providerAccountId !== state.providerAccountId
    ) {
      throw new ConflictException("Payment account provider does not match");
    }

    return this.prisma.organizationPaymentAccount.update({
      where: { organizationId },
      data: {
        status: state.status,
        readyForPayments: state.readyForPayments,
        lastSyncedAt: state.lastSyncedAt ?? new Date(),
        ...(state.status === OrganizationPaymentAccountStatus.DISCONNECTED
          ? { disconnectedAt: new Date() }
          : {}),
      },
      select: paymentAccountSelect,
    });
  }

  async disconnect(userId: string, organizationId: string) {
    await this.authorization.requireOwner(userId, organizationId);
    const account = await this.prisma.organizationPaymentAccount.findUnique({
      where: { organizationId },
    });
    if (!account) throw new NotFoundException("Payment account not found");

    return this.prisma.organizationPaymentAccount.update({
      where: { organizationId },
      data: {
        status: OrganizationPaymentAccountStatus.DISCONNECTED,
        readyForPayments: false,
        disconnectedAt: new Date(),
        lastSyncedAt: new Date(),
      },
      select: paymentAccountSelect,
    });
  }

  async readiness(organizationId: string): Promise<PaymentAccountReadiness> {
    const account = await this.prisma.organizationPaymentAccount.findUnique({
      where: { organizationId },
      select: {
        provider: true,
        providerAccountId: true,
        status: true,
        readyForPayments: true,
      },
    });
    if (!account) return { ready: false, reason: "NOT_CONNECTED" };
    if (
      account.status === OrganizationPaymentAccountStatus.READY &&
      account.readyForPayments
    ) {
      return {
        ready: true,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      };
    }

    return {
      ready: false,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      reason: readinessReason(account.status),
    };
  }
}

function readinessReason(
  status: OrganizationPaymentAccountStatus,
): "ONBOARDING" | "RESTRICTED" | "DISCONNECTED" {
  if (status === OrganizationPaymentAccountStatus.DISCONNECTED) {
    return "DISCONNECTED";
  }
  if (status === OrganizationPaymentAccountStatus.RESTRICTED) {
    return "RESTRICTED";
  }
  return "ONBOARDING";
}
