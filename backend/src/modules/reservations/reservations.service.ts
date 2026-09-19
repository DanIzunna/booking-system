import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BookableReservationRule,
  BookableStatus,
  ConfirmationPolicy,
  DurationMode,
  PaymentStatus,
  Prisma,
  PricingType,
  ReservationStatus,
} from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { OrganizationAuthorizationService } from "../organizations/organization-authorization.service";
import { AvailabilityEngineService } from "../availability/availability-engine.service";
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { ListOrganizationReservationsDto } from "./dto/list-organization-reservations.dto";

const reservationSelect = {
  id: true,
  bookableId: true,
  customerId: true,
  startAt: true,
  endAt: true,
  quantity: true,
  amount: true,
  currency: true,
  status: true,
  expiresAt: true,
  updatedAt: true,
} satisfies Prisma.ReservationSelect;

const customerReservationSelect = {
  id: true,
  bookableId: true,
  customerId: true,
  startAt: true,
  endAt: true,
  quantity: true,
  amount: true,
  currency: true,
  status: true,
  approvedAt: true,
  expiresAt: true,
  updatedAt: true,
  payment: {
    select: { id: true, status: true, amount: true, currency: true },
  },
} satisfies Prisma.ReservationSelect;

const customerReservationConfirmationSelect = {
  ...customerReservationSelect,
  bookable: {
    select: {
      name: true,
      organization: { select: { name: true, timezone: true } },
    },
  },
} satisfies Prisma.ReservationSelect;

const operatorReservationSelect = {
  id: true,
  bookableId: true,
  startAt: true,
  endAt: true,
  quantity: true,
  amount: true,
  currency: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  bookable: {
    select: {
      id: true,
      name: true,
      slug: true,
      confirmationPolicy: true,
      organization: { select: { id: true, name: true, timezone: true } },
    },
  },
  customer: {
    select: { id: true, name: true, email: true },
  },
  payment: {
    select: { id: true, status: true, amount: true, currency: true },
  },
} satisfies Prisma.ReservationSelect;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityEngineService,
    private readonly organizationAuthorization: OrganizationAuthorizationService,
  ) {}

  async listForOrganization(
    userId: string,
    organizationId: string,
    filter: ListOrganizationReservationsDto,
  ) {
    await this.organizationAuthorization.requireMembership(
      userId,
      organizationId,
    );
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true },
    });
    if (!organization) throw new NotFoundException("Organization not found");
    const dateRange = filter.date
      ? organizationDateRange(filter.date, organization.timezone)
      : undefined;
    return this.prisma.reservation.findMany({
      where: {
        ...(filter.bookableId ? { bookableId: filter.bookableId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(dateRange
          ? { startAt: { lt: dateRange.end }, endAt: { gt: dateRange.start } }
          : {}),
        bookable: {
          organizationId,
        },
      },
      orderBy: { startAt: "asc" },
      select: operatorReservationSelect,
    });
  }

  async getForOrganization(
    userId: string,
    organizationId: string,
    reservationId: string,
  ) {
    await this.organizationAuthorization.requireMembership(
      userId,
      organizationId,
    );
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: reservationId,
        bookable: { organizationId },
      },
      select: operatorReservationSelect,
    });
    if (!reservation) throw new NotFoundException("Reservation not found");
    return reservation;
  }

  async create(
    customerId: string,
    bookableId: string,
    input: CreateReservationDto,
  ) {
    const requested = this.parseRequestedInterval(input);
    const bookable = await this.loadReservableBookable(bookableId);
    const rule = bookable.reservationRule;
    if (!rule) {
      throw new ConflictException(
        "Bookable reservation rules are not configured",
      );
    }
    const endAt = this.resolveEndAt(rule, requested, input);

    this.validateAdvanceTime(requested.startAt, rule, new Date());
    this.validateDuration(rule, requested.startAt, endAt);

    const availability = await this.availability.check(
      requested.startAt,
      endAt,
      bookable.organization.timezone,
      await this.prisma.availabilityWindow.findMany({ where: { bookableId } }),
      await this.prisma.availabilityException.findMany({
        where: { bookableId },
      }),
    );
    if (!availability.available) {
      throw new ConflictException("Reservation interval is unavailable");
    }

    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "Bookable"
        WHERE "id" = CAST(${bookableId} AS uuid)
        FOR UPDATE
      `;

      const lockedBookable = await transaction.bookable.findUnique({
        where: { id: bookableId },
        select: {
          id: true,
          capacity: true,
          status: true,
          pricingType: true,
          confirmationPolicy: true,
        },
      });
      if (
        !lockedBookable ||
        lockedBookable.status !== BookableStatus.PUBLISHED
      ) {
        throw new ConflictException("Bookable is not published");
      }

      const overlapping = await transaction.reservation.findMany({
        where: {
          bookableId,
          status: {
            in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
          },
          startAt: { lt: endAt },
          endAt: { gt: requested.startAt },
        },
        select: { quantity: true },
      });
      const consumedQuantity = overlapping.reduce(
        (total, reservation) => total + reservation.quantity,
        0,
      );
      if (consumedQuantity + input.quantity > lockedBookable.capacity) {
        throw new ConflictException("Bookable capacity exceeded");
      }

      const reservationAmount =
        bookable.pricingType === PricingType.FREE
          ? 0
          : input.quantity * (bookable.price ?? 0);
      const status =
        bookable.pricingType === PricingType.FREE &&
        lockedBookable.confirmationPolicy === ConfirmationPolicy.AUTOMATIC
          ? ReservationStatus.CONFIRMED
          : ReservationStatus.PENDING;

      return transaction.reservation.create({
        data: {
          bookableId,
          customerId,
          startAt: requested.startAt,
          endAt,
          quantity: input.quantity,
          amount: reservationAmount,
          currency: bookable.currency ?? "NGN",
          status,
        },
        select: customerReservationSelect,
      });
    });
  }

  async confirmFromPayment(
    transaction: Prisma.TransactionClient,
    reservationId: string,
  ) {
    await this.lockForPaymentTransition(transaction, reservationId);

    const reservation = await transaction.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        status: true,
        approvedAt: true,
        expiresAt: true,
        bookable: {
          select: { confirmationPolicy: true },
        },
      },
    });
    if (!reservation) throw new NotFoundException("Reservation not found");
    if (reservation.status === ReservationStatus.CONFIRMED) return reservation;
    if (reservation.status !== ReservationStatus.PENDING) {
      throw new ConflictException("Reservation cannot be confirmed");
    }
    if (reservation.expiresAt && reservation.expiresAt <= new Date()) {
      throw new ConflictException("Reservation has expired");
    }
    if (
      reservation.bookable.confirmationPolicy ===
        ConfirmationPolicy.REQUIRES_APPROVAL &&
      !reservation.approvedAt
    ) {
      return reservation;
    }
    return transaction.reservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CONFIRMED },
      select: reservationSelect,
    });
  }

  async approveForOrganization(
    userId: string,
    organizationId: string,
    reservationId: string,
  ) {
    await this.organizationAuthorization.requireMembership(
      userId,
      organizationId,
    );

    return this.prisma.$transaction(async (transaction) => {
      const reservation = await transaction.reservation.findFirst({
        where: {
          id: reservationId,
          bookable: { organizationId },
        },
        select: {
          id: true,
          status: true,
          startAt: true,
          endAt: true,
          quantity: true,
          expiresAt: true,
          bookable: {
            select: {
              id: true,
              status: true,
              capacity: true,
              pricingType: true,
              confirmationPolicy: true,
            },
          },
        },
      });

      if (!reservation) throw new NotFoundException("Reservation not found");
      if (reservation.status !== ReservationStatus.PENDING) {
        throw new ConflictException("Reservation cannot be approved");
      }
      if (reservation.expiresAt && reservation.expiresAt <= new Date()) {
        throw new ConflictException("Reservation has expired");
      }
      if (reservation.bookable.status !== BookableStatus.PUBLISHED) {
        throw new ConflictException("Bookable is not published");
      }
      if (
        reservation.bookable.confirmationPolicy !==
        ConfirmationPolicy.REQUIRES_APPROVAL
      ) {
        throw new ConflictException("Reservation does not require approval");
      }

      await transaction.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "Bookable"
        WHERE "id" = CAST(${reservation.bookable.id} AS uuid)
        FOR UPDATE
      `;

      const lockedReservation = await transaction.reservation.findFirst({
        where: {
          id: reservationId,
          bookable: { organizationId },
        },
        select: {
          id: true,
          status: true,
          amount: true,
          approvedAt: true,
          startAt: true,
          endAt: true,
          quantity: true,
          expiresAt: true,
          bookable: {
            select: {
              id: true,
              status: true,
              capacity: true,
              pricingType: true,
              confirmationPolicy: true,
            },
          },
          payment: { select: { status: true } },
        },
      });

      if (!lockedReservation) {
        throw new NotFoundException("Reservation not found");
      }
      if (lockedReservation.status !== ReservationStatus.PENDING) {
        throw new ConflictException("Reservation cannot be approved");
      }
      if (
        lockedReservation.expiresAt &&
        lockedReservation.expiresAt <= new Date()
      ) {
        throw new ConflictException("Reservation has expired");
      }
      if (lockedReservation.bookable.status !== BookableStatus.PUBLISHED) {
        throw new ConflictException("Bookable is not published");
      }
      if (
        lockedReservation.bookable.confirmationPolicy !==
        ConfirmationPolicy.REQUIRES_APPROVAL
      ) {
        throw new ConflictException("Reservation does not require approval");
      }

      const overlapping = await transaction.reservation.findMany({
        where: {
          bookableId: lockedReservation.bookable.id,
          id: { not: reservationId },
          status: {
            in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
          },
          startAt: { lt: lockedReservation.endAt },
          endAt: { gt: lockedReservation.startAt },
        },
        select: { quantity: true },
      });
      const consumedQuantity = overlapping.reduce(
        (total, item) => total + item.quantity,
        0,
      );
      if (
        consumedQuantity + lockedReservation.quantity >
        lockedReservation.bookable.capacity
      ) {
        throw new ConflictException("Bookable capacity exceeded");
      }

      return transaction.reservation.update({
        where: { id: reservationId },
        data: {
          status:
            lockedReservation.bookable.pricingType === PricingType.FREE ||
            lockedReservation.payment?.status === PaymentStatus.SUCCEEDED
              ? ReservationStatus.CONFIRMED
              : ReservationStatus.PENDING,
          approvedAt: new Date(),
        },
        select: reservationSelect,
      });
    });
  }

  async rejectForOrganization(
    userId: string,
    organizationId: string,
    reservationId: string,
  ) {
    await this.organizationAuthorization.requireMembership(
      userId,
      organizationId,
    );

    return this.prisma.$transaction(async (transaction) => {
      const reservation = await transaction.reservation.findFirst({
        where: {
          id: reservationId,
          bookable: { organizationId },
        },
        select: { bookable: { select: { id: true } } },
      });

      if (!reservation) throw new NotFoundException("Reservation not found");

      await transaction.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "Bookable"
        WHERE "id" = CAST(${reservation.bookable.id} AS uuid)
        FOR UPDATE
      `;

      const lockedReservation = await transaction.reservation.findFirst({
        where: {
          id: reservationId,
          bookable: { organizationId },
        },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          bookable: {
            select: {
              status: true,
              confirmationPolicy: true,
            },
          },
        },
      });

      if (!lockedReservation) {
        throw new NotFoundException("Reservation not found");
      }
      if (lockedReservation.status !== ReservationStatus.PENDING) {
        throw new ConflictException("Reservation cannot be rejected");
      }
      if (
        lockedReservation.expiresAt &&
        lockedReservation.expiresAt <= new Date()
      ) {
        throw new ConflictException("Reservation has expired");
      }
      if (lockedReservation.bookable.status !== BookableStatus.PUBLISHED) {
        throw new ConflictException("Bookable is not published");
      }
      if (
        lockedReservation.bookable.confirmationPolicy !==
        ConfirmationPolicy.REQUIRES_APPROVAL
      ) {
        throw new ConflictException("Reservation does not require approval");
      }

      return transaction.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.REJECTED },
        select: reservationSelect,
      });
    });
  }

  async confirmFreeReservation(customerId: string, reservationId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const reservation = await transaction.reservation.findFirst({
        where: { id: reservationId, customerId },
        select: {
          id: true,
          amount: true,
          status: true,
          expiresAt: true,
          bookable: {
            select: { confirmationPolicy: true, pricingType: true },
          },
        },
      });
      if (!reservation) throw new NotFoundException("Reservation not found");
      if (reservation.bookable.pricingType !== PricingType.FREE) {
        throw new ConflictException("Reservation requires payment");
      }
      if (reservation.status === ReservationStatus.CONFIRMED) {
        return transaction.reservation.findUniqueOrThrow({
          where: { id: reservationId },
          select: customerReservationConfirmationSelect,
        });
      }
      if (reservation.status !== ReservationStatus.PENDING) {
        throw new ConflictException("Reservation cannot be confirmed");
      }
      if (
        reservation.bookable.confirmationPolicy ===
        ConfirmationPolicy.REQUIRES_APPROVAL
      ) {
        throw new ConflictException(
          "Reservation requires organization approval",
        );
      }
      if (reservation.expiresAt && reservation.expiresAt <= new Date()) {
        throw new ConflictException("Reservation has expired");
      }
      return transaction.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.CONFIRMED },
        select: customerReservationConfirmationSelect,
      });
    });
  }

  async lockForPaymentTransition(
    transaction: Prisma.TransactionClient,
    reservationId: string,
  ) {
    const reservation = await transaction.reservation.findUnique({
      where: { id: reservationId },
      select: { bookableId: true },
    });
    if (!reservation) throw new NotFoundException("Reservation not found");

    await transaction.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "Bookable"
      WHERE "id" = CAST(${reservation.bookableId} AS uuid)
      FOR UPDATE
    `;
  }

  async get(customerId: string, reservationId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, customerId },
      select: customerReservationSelect,
    });
    if (!reservation) throw new NotFoundException("Reservation not found");
    return reservation;
  }

  list(customerId: string) {
    return this.prisma.reservation.findMany({
      where: { customerId },
      orderBy: { startAt: "asc" },
      select: customerReservationSelect,
    });
  }

  private async loadReservableBookable(bookableId: string) {
    const bookable = await this.prisma.bookable.findUnique({
      where: { id: bookableId },
      include: {
        organization: { select: { timezone: true } },
        reservationRule: true,
      },
    });
    if (!bookable) throw new NotFoundException("Bookable not found");
    if (bookable.status !== BookableStatus.PUBLISHED) {
      throw new ConflictException("Bookable is not published");
    }
    if (!bookable.reservationRule) {
      throw new ConflictException(
        "Bookable reservation rules are not configured",
      );
    }
    return bookable;
  }

  private parseRequestedInterval(input: CreateReservationDto) {
    const startAt = new Date(input.startAt);
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException("startAt must be a valid timestamp");
    }
    const endAt = input.endAt ? new Date(input.endAt) : undefined;
    if (input.endAt && (!endAt || Number.isNaN(endAt.getTime()))) {
      throw new BadRequestException("endAt must be a valid timestamp");
    }
    return { startAt, endAt };
  }

  private resolveEndAt(
    rule: BookableReservationRule,
    requested: { startAt: Date; endAt?: Date },
    input: CreateReservationDto,
  ) {
    if (rule.durationMode === DurationMode.FIXED) {
      if (input.endAt) {
        throw new BadRequestException(
          "Fixed-duration reservations must not provide endAt",
        );
      }
      if (!rule.fixedDuration || rule.fixedDuration <= 0) {
        throw new ConflictException(
          "Fixed reservation duration is not configured",
        );
      }
      return new Date(requested.startAt.getTime() + rule.fixedDuration * 1000);
    }

    if (!requested.endAt) {
      throw new BadRequestException("Flexible reservations require endAt");
    }
    return requested.endAt;
  }

  private validateDuration(
    rule: BookableReservationRule,
    startAt: Date,
    endAt: Date,
  ) {
    const duration = (endAt.getTime() - startAt.getTime()) / 1000;
    if (duration <= 0)
      throw new BadRequestException("endAt must be after startAt");
    if (rule.durationMode === DurationMode.FIXED) return;
    if (
      (rule.minimumDuration !== null && duration < rule.minimumDuration) ||
      (rule.maximumDuration !== null && duration > rule.maximumDuration)
    ) {
      throw new ConflictException("Reservation duration is invalid");
    }
  }

  private validateAdvanceTime(
    startAt: Date,
    rule: BookableReservationRule,
    now: Date,
  ) {
    const secondsUntilStart = (startAt.getTime() - now.getTime()) / 1000;
    if (
      rule.minimumAdvanceTime !== null &&
      secondsUntilStart < rule.minimumAdvanceTime
    ) {
      throw new ConflictException(
        "Reservation does not satisfy minimum advance time",
      );
    }
    if (
      rule.maximumAdvanceTime !== null &&
      secondsUntilStart > rule.maximumAdvanceTime
    ) {
      throw new ConflictException("Reservation exceeds maximum advance time");
    }
  }
}

function organizationDateRange(date: string, timezone: string) {
  const start = localTimeToInstant(date, "00:00", timezone);
  const dateCursor = new Date(`${date}T12:00:00Z`);
  dateCursor.setUTCDate(dateCursor.getUTCDate() + 1);
  const nextDate = dateCursor.toISOString().slice(0, 10);
  return { start, end: localTimeToInstant(nextDate, "00:00", timezone) };
}

function localTimeToInstant(date: string, time: string, timezone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let guess = new Date(desired);
  for (let index = 0; index < 4; index += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(guess);
    const values = Object.fromEntries(
      parts
        .filter(({ type }) => type !== "literal")
        .map(({ type, value }) => [type, Number(value)]),
    );
    const represented = Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
    );
    guess = new Date(guess.getTime() + desired - represented);
  }
  return guess;
}
