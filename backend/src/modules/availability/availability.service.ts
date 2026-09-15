import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AvailabilityExceptionType,
  AvailabilityWindowType,
} from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { OrganizationAuthorizationService } from "../organizations/organization-authorization.service";
import { AvailabilityEngineService } from "./availability-engine.service";
import { CreateAvailabilityExceptionDto } from "./dto/create-availability-exception.dto";
import { CreateAvailabilityWindowDto } from "./dto/create-availability-window.dto";
import { UpdateAvailabilityExceptionDto } from "./dto/update-availability-exception.dto";
import { UpdateAvailabilityWindowDto } from "./dto/update-availability-window.dto";

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: OrganizationAuthorizationService,
    private readonly engine: AvailabilityEngineService,
  ) {}

  async listWindows(userId: string, bookableId: string) {
    await this.requireBookableAccess(userId, bookableId);
    return this.prisma.availabilityWindow.findMany({
      where: { bookableId },
      orderBy: [{ type: "asc" }, { weekday: "asc" }, { startAt: "asc" }],
    });
  }

  async createWindow(
    userId: string,
    bookableId: string,
    input: CreateAvailabilityWindowDto,
  ) {
    await this.requireBookableOwner(userId, bookableId);
    validateWindow(input);
    return this.prisma.availabilityWindow.create({
      data: {
        bookableId,
        type: input.type,
        weekday: input.weekday,
        startTime: input.startTime,
        endTime: input.endTime,
        startAt: input.startAt ? new Date(input.startAt) : undefined,
        endAt: input.endAt ? new Date(input.endAt) : undefined,
      },
    });
  }

  async updateWindow(
    userId: string,
    bookableId: string,
    windowId: string,
    input: UpdateAvailabilityWindowDto,
  ) {
    await this.requireBookableOwner(userId, bookableId);
    const existing = await this.prisma.availabilityWindow.findFirst({
      where: { id: windowId, bookableId },
    });
    if (!existing) throw new NotFoundException("Availability window not found");
    const merged = {
      type: input.type ?? existing.type,
      weekday: input.weekday ?? existing.weekday ?? undefined,
      startTime: input.startTime ?? existing.startTime ?? undefined,
      endTime: input.endTime ?? existing.endTime ?? undefined,
      startAt: input.startAt ?? existing.startAt?.toISOString(),
      endAt: input.endAt ?? existing.endAt?.toISOString(),
    };
    validateWindow(merged);
    return this.prisma.availabilityWindow.update({
      where: { id: windowId },
      data: {
        type: merged.type,
        weekday: merged.weekday,
        startTime: merged.startTime,
        endTime: merged.endTime,
        startAt: merged.startAt ? new Date(merged.startAt) : null,
        endAt: merged.endAt ? new Date(merged.endAt) : null,
      },
    });
  }

  async deleteWindow(userId: string, bookableId: string, windowId: string) {
    await this.requireBookableOwner(userId, bookableId);
    const result = await this.prisma.availabilityWindow.deleteMany({
      where: { id: windowId, bookableId },
    });
    if (result.count === 0)
      throw new NotFoundException("Availability window not found");
  }

  async listExceptions(userId: string, bookableId: string) {
    await this.requireBookableAccess(userId, bookableId);
    return this.prisma.availabilityException.findMany({
      where: { bookableId },
      orderBy: { startAt: "asc" },
    });
  }

  async createException(
    userId: string,
    bookableId: string,
    input: CreateAvailabilityExceptionDto,
  ) {
    await this.requireBookableOwner(userId, bookableId);
    const interval = validateException(input);
    await this.ensureNoExceptionConflict(
      bookableId,
      interval.startAt,
      interval.endAt,
    );
    return this.prisma.availabilityException.create({
      data: {
        bookableId,
        type: input.type,
        startAt: interval.startAt,
        endAt: interval.endAt,
      },
    });
  }

  async updateException(
    userId: string,
    bookableId: string,
    exceptionId: string,
    input: UpdateAvailabilityExceptionDto,
  ) {
    await this.requireBookableOwner(userId, bookableId);
    const existing = await this.prisma.availabilityException.findFirst({
      where: { id: exceptionId, bookableId },
    });
    if (!existing)
      throw new NotFoundException("Availability exception not found");
    const startAt = input.startAt ? new Date(input.startAt) : existing.startAt;
    const endAt = input.endAt ? new Date(input.endAt) : existing.endAt;
    if (startAt >= endAt)
      throw new BadRequestException("endAt must be after startAt");
    await this.ensureNoExceptionConflict(
      bookableId,
      startAt,
      endAt,
      exceptionId,
    );
    return this.prisma.availabilityException.update({
      where: { id: exceptionId },
      data: { type: input.type ?? existing.type, startAt, endAt },
    });
  }

  async deleteException(
    userId: string,
    bookableId: string,
    exceptionId: string,
  ) {
    await this.requireBookableOwner(userId, bookableId);
    const result = await this.prisma.availabilityException.deleteMany({
      where: { id: exceptionId, bookableId },
    });
    if (result.count === 0)
      throw new NotFoundException("Availability exception not found");
  }

  async check(
    userId: string,
    bookableId: string,
    startAt: string,
    endAt: string,
  ) {
    const bookable = await this.requireBookableAccess(userId, bookableId);
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start >= end
    ) {
      throw new BadRequestException(
        "endAt must be after startAt and both timestamps must be valid",
      );
    }
    const [windows, exceptions] = await Promise.all([
      this.prisma.availabilityWindow.findMany({ where: { bookableId } }),
      this.prisma.availabilityException.findMany({ where: { bookableId } }),
    ]);
    return this.engine.check(
      start,
      end,
      bookable.organization.timezone,
      windows,
      exceptions,
    );
  }

  private async requireBookableAccess(userId: string, bookableId: string) {
    const bookable = await this.prisma.bookable.findUnique({
      where: { id: bookableId },
      include: { organization: { select: { timezone: true } } },
    });
    if (!bookable) throw new NotFoundException("Bookable not found");
    await this.authorization.requireMembership(userId, bookable.organizationId);
    return bookable;
  }

  private async requireBookableOwner(userId: string, bookableId: string) {
    const bookable = await this.requireBookableAccess(userId, bookableId);
    await this.authorization.requireOwner(userId, bookable.organizationId);
    return bookable;
  }

  private async ensureNoExceptionConflict(
    bookableId: string,
    startAt: Date,
    endAt: Date,
    excludeId?: string,
  ) {
    const conflict = await this.prisma.availabilityException.findFirst({
      where: {
        bookableId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });
    if (conflict)
      throw new ConflictException(
        "Availability exception overlaps an existing exception",
      );
  }
}

function validateWindow(input: {
  type: AvailabilityWindowType;
  weekday?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
}) {
  if (input.type === AvailabilityWindowType.RECURRING) {
    if (
      input.weekday === undefined ||
      input.weekday === null ||
      !input.startTime ||
      !input.endTime ||
      input.startTime >= input.endTime
    ) {
      throw new BadRequestException(
        "Recurring windows require weekday and endTime after startTime",
      );
    }
    if (input.startAt || input.endAt)
      throw new BadRequestException(
        "Recurring windows cannot contain timestamps",
      );
    return;
  }
  if (input.type === AvailabilityWindowType.SPECIFIC) {
    const startAt = input.startAt ? new Date(input.startAt) : null;
    const endAt = input.endAt ? new Date(input.endAt) : null;
    if (
      !startAt ||
      !endAt ||
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      startAt >= endAt
    ) {
      throw new BadRequestException(
        "Specific windows require endAt after startAt",
      );
    }
    if (input.weekday !== undefined || input.startTime || input.endTime)
      throw new BadRequestException(
        "Specific windows cannot contain recurring fields",
      );
    return;
  }
  throw new BadRequestException("Invalid availability window type");
}

function validateException(input: CreateAvailabilityExceptionDto) {
  if (!(input.type in AvailabilityExceptionType))
    throw new BadRequestException("Invalid exception type");
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime()) ||
    startAt >= endAt
  )
    throw new BadRequestException("endAt must be after startAt");
  return { startAt, endAt };
}
