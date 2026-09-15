import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BookableReservationRule,
  BookableStatus,
  DurationMode,
  Prisma,
  ReservationStatus,
} from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AvailabilityEngineService } from "../availability/availability-engine.service";
import { CreateReservationDto } from "./dto/create-reservation.dto";

const reservationSelect = {
  id: true,
  bookableId: true,
  customerId: true,
  startAt: true,
  endAt: true,
  quantity: true,
  status: true,
  expiresAt: true,
  updatedAt: true,
} satisfies Prisma.ReservationSelect;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityEngineService,
  ) {}

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
        select: { id: true, capacity: true, status: true },
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

      return transaction.reservation.create({
        data: {
          bookableId,
          customerId,
          startAt: requested.startAt,
          endAt,
          quantity: input.quantity,
          status: ReservationStatus.PENDING,
        },
        select: reservationSelect,
      });
    });
  }

  async get(customerId: string, reservationId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, customerId },
      select: reservationSelect,
    });
    if (!reservation) throw new NotFoundException("Reservation not found");
    return reservation;
  }

  list(customerId: string) {
    return this.prisma.reservation.findMany({
      where: { customerId },
      orderBy: { startAt: "asc" },
      select: reservationSelect,
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
