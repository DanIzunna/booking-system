import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PaymentStatus, PricingType, ReservationStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { ReservationsService } from "../reservations/reservations.service";
import { PaymentAccountReadinessService } from "../payment-accounts/payment-account-readiness.service";
import { InitializePaymentResponseDto } from "./dto/initialize-payment-response.dto";
import { FakePaymentProvider } from "./providers/fake-payment-provider";
import {
  PaymentProvider,
  PaymentWebhookEvent,
} from "./providers/payment-provider.interface";

@Injectable()
export class PaymentsService {
  private readonly providers: Map<string, PaymentProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationsService,
    private readonly paymentReadiness: PaymentAccountReadinessService,
    fakeProvider: FakePaymentProvider,
  ) {
    this.providers = new Map([[fakeProvider.name, fakeProvider]]);
  }

  async initialize(
    customerId: string,
    reservationId: string,
  ): Promise<InitializePaymentResponseDto> {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, customerId },
      include: {
        payment: true,
        bookable: { select: { organizationId: true, pricingType: true } },
      },
    });
    if (!reservation) throw new NotFoundException("Reservation not found");
    if (
      reservation.status === ReservationStatus.CANCELLED ||
      reservation.status === ReservationStatus.COMPLETED
    ) {
      throw new ConflictException("Reservation cannot be paid");
    }
    if (reservation.expiresAt && reservation.expiresAt <= new Date()) {
      throw new ConflictException("Reservation has expired");
    }
    if (reservation.payment?.status === PaymentStatus.SUCCEEDED) {
      throw new ConflictException("Payment has already succeeded");
    }
    if (reservation.payment?.status === PaymentStatus.FAILED) {
      throw new ConflictException(
        "Payment initialization retry is not supported",
      );
    }
    if (reservation.amount < 0 || !/^[A-Z]{3}$/.test(reservation.currency)) {
      throw new ConflictException("Reservation money snapshot is invalid");
    }
    if (reservation.bookable.pricingType === PricingType.FREE) {
      const confirmed = await this.reservations.confirmFreeReservation(
        customerId,
        reservationId,
      );
      return {
        paymentId: null,
        status: "SUCCEEDED",
        amount: reservation.amount,
        currency: reservation.currency,
        reservationStatus: confirmed.status,
      };
    }

    let providerName = "fake";
    if (this.paymentReadiness.isEnforced()) {
      const readiness = await this.paymentReadiness.isReady(
        reservation.bookable.organizationId,
      );
      if (!readiness.ready) {
        throw new ConflictException(
          "A ready payment account is required for paid payments",
        );
      }
      providerName =
        readiness.provider === "STRIPE" && process.env.NODE_ENV !== "production"
          ? "fake"
          : (readiness.provider?.toLowerCase() ?? "fake");
    }

    const provider = this.provider(providerName);
    if (reservation.payment?.status === PaymentStatus.PENDING) {
      return {
        paymentId: reservation.payment.id,
        status: reservation.payment.status,
        amount: reservation.payment.amount,
        currency: reservation.payment.currency,
        checkoutUrl: provider.checkoutUrl(
          reservation.payment.providerReference,
          reservation.payment.amount,
          reservation.payment.currency,
        ),
        providerReference: reservation.payment.providerReference,
      };
    }

    const initialized = await provider.initializePayment({
      reservationId,
      amount: reservation.amount,
      currency: reservation.currency,
      idempotencyKey: `reservation:${reservationId}`,
    });
    try {
      const payment = await this.prisma.payment.create({
        data: {
          reservationId,
          provider: provider.name,
          providerReference: initialized.providerReference,
          amount: reservation.amount,
          currency: reservation.currency,
          status: PaymentStatus.PENDING,
        },
      });
      return {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        checkoutUrl: initialized.checkoutUrl,
        providerReference: payment.providerReference,
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const payment = await this.prisma.payment.findUniqueOrThrow({
          where: { reservationId },
        });
        return {
          paymentId: payment.id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          checkoutUrl: provider.checkoutUrl(
            payment.providerReference,
            payment.amount,
            payment.currency,
          ),
          providerReference: payment.providerReference,
        };
      }
      throw error;
    }
  }

  async processWebhook(
    providerName: string,
    payload: unknown,
    headers: Record<string, unknown>,
  ) {
    const provider = this.provider(providerName);
    const event = provider.verifyWebhook(payload, headers);
    const payment = await this.prisma.payment.findUnique({
      where: {
        provider_providerReference: {
          provider: provider.name,
          providerReference: event.providerReference,
        },
      },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    this.validateEvent(payment, event);

    if (event.status === "FAILED") {
      if (payment.status === PaymentStatus.FAILED) {
        return { status: payment.status, idempotent: true };
      }
      if (payment.status === PaymentStatus.SUCCEEDED)
        throw new ConflictException("A successful payment cannot fail");
      if (payment.status !== PaymentStatus.PENDING)
        throw new ConflictException(
          "Payment cannot fail from its current state",
        );
      const updated = await this.prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED },
      });
      return {
        status: updated.count ? PaymentStatus.FAILED : PaymentStatus.FAILED,
        idempotent: updated.count === 0,
      };
    }

    if (payment.status === PaymentStatus.SUCCEEDED)
      return { status: payment.status, idempotent: true };
    if (payment.status !== PaymentStatus.PENDING)
      throw new ConflictException(
        "Payment cannot succeed from its current state",
      );

    return this.prisma.$transaction(async (transaction) => {
      await this.reservations.lockForPaymentTransition(
        transaction,
        payment.reservationId,
      );
      const updated = await transaction.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.SUCCEEDED, paidAt: new Date() },
      });
      if (!updated.count)
        return { status: PaymentStatus.SUCCEEDED, idempotent: true };
      const reservation = await this.reservations.confirmFromPayment(
        transaction,
        payment.reservationId,
      );
      return {
        status: PaymentStatus.SUCCEEDED,
        reservationStatus: reservation.status,
        idempotent: false,
      };
    });
  }

  private provider(name: string): PaymentProvider & {
    checkoutUrl(reference: string, amount?: number, currency?: string): string;
  } {
    const provider = this.providers.get(name);
    if (!provider || !("checkoutUrl" in provider))
      throw new NotFoundException("Payment provider not found");
    return provider as PaymentProvider & {
      checkoutUrl(
        reference: string,
        amount?: number,
        currency?: string,
      ): string;
    };
  }

  private validateEvent(
    payment: { amount: number; currency: string },
    event: PaymentWebhookEvent,
  ) {
    if (
      payment.amount !== event.amount ||
      payment.currency !== event.currency
    ) {
      throw new ConflictException("Payment amount or currency mismatch");
    }
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002",
  );
}
