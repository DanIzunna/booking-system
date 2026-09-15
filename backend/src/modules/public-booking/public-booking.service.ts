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
import { PublicAvailabilityCheckDto } from "./dto/public-availability-check.dto";

const publicBookableSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  capacity: true,
  organization: { select: { id: true, name: true } },
  reservationRule: {
    select: {
      durationMode: true,
      minimumDuration: true,
      maximumDuration: true,
      fixedDuration: true,
      minimumAdvanceTime: true,
      maximumAdvanceTime: true,
      cancellationDeadline: true,
    },
  },
} satisfies Prisma.BookableSelect;

@Injectable()
export class PublicBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityEngineService,
  ) {}

  async getBookable(slug: string) {
    const bookable = await this.findPublishedBookable(
      slug,
      publicBookableSelect,
    );
    return bookable;
  }

  async checkAvailability(slug: string, input: PublicAvailabilityCheckDto) {
    const bookable = await this.findPublishedBookable(slug, {
      id: true,
      capacity: true,
      organization: { select: { timezone: true } },
      reservationRule: true,
    });
    const startAt = parseTimestamp(input.startAt, "startAt");
    const endAt = parseTimestamp(input.endAt, "endAt");

    if (endAt <= startAt) {
      throw new BadRequestException("endAt must be after startAt");
    }
    if (!bookable.reservationRule) {
      throw new ConflictException(
        "Bookable reservation rules are not configured",
      );
    }

    this.validateRule(bookable.reservationRule, startAt, endAt);
    this.validateAdvanceTime(bookable.reservationRule, startAt, new Date());

    const [windows, exceptions] = await Promise.all([
      this.prisma.availabilityWindow.findMany({
        where: { bookableId: bookable.id },
      }),
      this.prisma.availabilityException.findMany({
        where: { bookableId: bookable.id },
      }),
    ]);
    const schedule = await this.availability.check(
      startAt,
      endAt,
      bookable.organization.timezone,
      windows,
      exceptions,
    );
    if (!schedule.available) {
      return { available: false, reason: "OUTSIDE_AVAILABILITY" };
    }

    const reservations = await this.prisma.reservation.findMany({
      where: {
        bookableId: bookable.id,
        status: {
          in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
        },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { quantity: true },
    });
    const consumedQuantity = reservations.reduce(
      (total, reservation) => total + reservation.quantity,
      0,
    );

    if (consumedQuantity + input.quantity > bookable.capacity) {
      return { available: false, reason: "CAPACITY_EXCEEDED" };
    }
    return { available: true };
  }

  private async findPublishedBookable<T extends Prisma.BookableSelect>(
    slug: string,
    select: T,
  ): Promise<Prisma.BookableGetPayload<{ select: T }>> {
    const bookable = await this.prisma.bookable.findFirst({
      where: { slug, status: BookableStatus.PUBLISHED },
      select,
    });
    if (!bookable) throw new NotFoundException("Bookable not found");
    return bookable;
  }

  private validateRule(
    rule: BookableReservationRule,
    startAt: Date,
    endAt: Date,
  ) {
    const duration = (endAt.getTime() - startAt.getTime()) / 1000;
    if (duration <= 0)
      throw new BadRequestException("endAt must be after startAt");

    if (rule.durationMode === DurationMode.FIXED) {
      if (rule.fixedDuration === null || duration !== rule.fixedDuration) {
        throw new ConflictException(
          "Requested interval does not match fixed duration",
        );
      }
      return;
    }

    if (
      (rule.minimumDuration !== null && duration < rule.minimumDuration) ||
      (rule.maximumDuration !== null && duration > rule.maximumDuration)
    ) {
      throw new ConflictException("Reservation duration is invalid");
    }
  }

  private validateAdvanceTime(
    rule: BookableReservationRule,
    startAt: Date,
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

function parseTimestamp(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} must be a valid timestamp`);
  }
  return parsed;
}
