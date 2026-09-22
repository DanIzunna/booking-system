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
import { PublicAvailabilityDto } from "./dto/public-availability.dto";

const publicBookableSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  status: true,
  pricingType: true,
  confirmationPolicy: true,
  price: true,
  currency: true,
  capacity: true,
  images: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      url: true,
      sortOrder: true,
      isPrimary: true,
    },
  },
  organization: { select: { id: true, name: true, timezone: true } },
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

const publicOrganizationSelect = {
  name: true,
  slug: true,
  timezone: true,
  bookables: {
    where: { status: BookableStatus.PUBLISHED },
    orderBy: { createdAt: "asc" },
    select: {
      slug: true,
      name: true,
      description: true,
      pricingType: true,
      price: true,
      currency: true,
      capacity: true,
      images: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          url: true,
          sortOrder: true,
          isPrimary: true,
        },
      },
    },
  },
} satisfies Prisma.OrganizationSelect;

@Injectable()
export class PublicBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityEngineService,
  ) {}

  async getOrganization(organizationSlug: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { slug: organizationSlug },
      select: publicOrganizationSelect,
    });
    if (!organization) throw new NotFoundException("Organization not found");
    return organization;
  }

  async getBookable(organizationOrSlug: string, bookableSlug?: string) {
    const bookable = await this.findPublishedBookable(
      organizationOrSlug,
      bookableSlug,
      publicBookableSelect,
    );
    return bookable;
  }

  async checkAvailability(
    organizationOrSlug: string,
    bookableOrInput: string | PublicAvailabilityCheckDto,
    maybeInput?: PublicAvailabilityCheckDto,
  ) {
    const input =
      typeof bookableOrInput === "string" ? maybeInput! : bookableOrInput;
    const bookable = await this.findPublishedBookable(
      organizationOrSlug,
      typeof bookableOrInput === "string" ? bookableOrInput : undefined,
      {
        id: true,
        capacity: true,
        organization: { select: { timezone: true } },
        reservationRule: true,
      },
    );
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

  async getAvailability(
    organizationOrSlug: string,
    bookableOrInput: string | PublicAvailabilityDto,
    maybeInput?: PublicAvailabilityDto,
  ) {
    const input =
      typeof bookableOrInput === "string" ? maybeInput! : bookableOrInput;
    const bookable = await this.findPublishedBookable(
      organizationOrSlug,
      typeof bookableOrInput === "string" ? bookableOrInput : undefined,
      {
        id: true,
        capacity: true,
        organization: { select: { timezone: true } },
        reservationRule: true,
      },
    );
    const [windows, exceptions] = await Promise.all([
      this.prisma.availabilityWindow.findMany({
        where: { bookableId: bookable.id },
      }),
      this.prisma.availabilityException.findMany({
        where: { bookableId: bookable.id },
      }),
    ]);
    const intervals = await this.availability.intervalsForDate(
      input.date,
      bookable.organization.timezone,
      windows,
      exceptions,
    );
    if (intervals.length === 0) {
      return {
        date: input.date,
        timezone: bookable.organization.timezone,
        capacity: bookable.capacity,
        durationMode: bookable.reservationRule?.durationMode ?? null,
        durationSeconds: bookable.reservationRule?.fixedDuration ?? null,
        intervals: [],
        slots: [],
        reason: "NO_AVAILABILITY",
      };
    }
    const reservations = await this.prisma.reservation.findMany({
      where: {
        bookableId: bookable.id,
        status: {
          in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
        },
        ...(intervals.length
          ? {
              startAt: { lt: intervals[intervals.length - 1].endAt },
              endAt: { gt: intervals[0].startAt },
            }
          : {}),
      },
      select: { startAt: true, endAt: true, quantity: true },
    });
    const durationSeconds = bookable.reservationRule?.fixedDuration ?? null;
    const slots = durationSeconds
      ? intervals.flatMap((interval) =>
          createSlots(interval.startAt, interval.endAt, durationSeconds).filter(
            ({ startAt, endAt }) =>
              isWithinAdvanceTime(
                bookable.reservationRule,
                startAt,
                new Date(),
              ) &&
              reservations.reduce(
                (total, reservation) =>
                  reservation.startAt < endAt && reservation.endAt > startAt
                    ? total + reservation.quantity
                    : total,
                0,
              ) +
                input.quantity <=
                bookable.capacity,
          ),
        )
      : [];

    return {
      date: input.date,
      timezone: bookable.organization.timezone,
      capacity: bookable.capacity,
      durationMode: bookable.reservationRule?.durationMode ?? null,
      durationSeconds,
      intervals,
      slots,
      reason: durationSeconds
        ? undefined
        : "FLEXIBLE_DURATION_REQUIRES_END_TIME",
    };
  }

  private async findPublishedBookable<T extends Prisma.BookableSelect>(
    organizationOrSlug: string,
    bookableSlug: string | undefined,
    select: T,
  ): Promise<Prisma.BookableGetPayload<{ select: T }>> {
    const bookable = await this.prisma.bookable.findFirst({
      where: {
        status: BookableStatus.PUBLISHED,
        slug: bookableSlug ?? organizationOrSlug,
        ...(bookableSlug ? { organization: { slug: organizationOrSlug } } : {}),
      },
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

function createSlots(startAt: Date, endAt: Date, durationSeconds: number) {
  const slots: { startAt: Date; endAt: Date }[] = [];
  const duration = durationSeconds * 1000;
  for (
    let cursor = startAt.getTime();
    cursor + duration <= endAt.getTime();
    cursor += duration
  ) {
    slots.push({
      startAt: new Date(cursor),
      endAt: new Date(cursor + duration),
    });
  }
  return slots;
}

function isWithinAdvanceTime(
  rule: BookableReservationRule | null,
  startAt: Date,
  now: Date,
) {
  if (!rule) return false;
  const secondsUntilStart = (startAt.getTime() - now.getTime()) / 1000;
  return (
    (rule.minimumAdvanceTime === null ||
      secondsUntilStart >= rule.minimumAdvanceTime) &&
    (rule.maximumAdvanceTime === null ||
      secondsUntilStart <= rule.maximumAdvanceTime)
  );
}

function parseTimestamp(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} must be a valid timestamp`);
  }
  return parsed;
}
