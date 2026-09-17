import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BookableStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { OrganizationAuthorizationService } from "../organizations/organization-authorization.service";
import { CreateBookableDto } from "./dto/create-bookable.dto";
import { ListBookablesDto } from "./dto/list-bookables.dto";
import { UpdateBookableDto } from "./dto/update-bookable.dto";
import { ReservationRuleDto } from "./dto/reservation-rule.dto";

const bookableSelect = {
  id: true,
  organizationId: true,
  name: true,
  description: true,
  slug: true,
  status: true,
  capacity: true,
  createdAt: true,
  updatedAt: true,
  reservationRule: true,
} satisfies Prisma.BookableSelect;

@Injectable()
export class BookablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationAuthorization: OrganizationAuthorizationService,
  ) {}

  async create(userId: string, input: CreateBookableDto) {
    await this.organizationAuthorization.requireMembership(
      userId,
      input.organizationId,
    );

    const baseSlug = input.slug ?? slugify(input.name);
    validateReservationRule(input.reservationRule);
    if (input.status === BookableStatus.PUBLISHED && !input.reservationRule) {
      throw new ConflictException(
        "A reservation rule is required before publishing a Bookable",
      );
    }

    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        return await this.prisma.bookable.create({
          data: {
            organizationId: input.organizationId,
            name: input.name,
            description: input.description,
            slug: attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`,
            status: input.status ?? BookableStatus.DRAFT,
            capacity: input.capacity,
            ...(input.reservationRule
              ? {
                  reservationRule: {
                    create: reservationRuleData(input.reservationRule),
                  },
                }
              : {}),
          },
          select: bookableSelect,
        });
      } catch (error) {
        if (!input.slug && isUniqueConstraintError(error)) continue;
        throw mapBookableError(error);
      }
    }

    throw new ConflictException("Unable to generate a unique Bookable slug");
  }

  async list(userId: string, filter: ListBookablesDto) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId,
        ...(filter.organizationId
          ? { organizationId: filter.organizationId }
          : {}),
      },
      select: { organizationId: true },
    });

    if (filter.organizationId && memberships.length === 0) {
      await this.organizationAuthorization.requireMembership(
        userId,
        filter.organizationId,
      );
    }

    const organizationIds = memberships.map(
      ({ organizationId }) => organizationId,
    );
    return this.prisma.bookable.findMany({
      where: { organizationId: { in: organizationIds } },
      orderBy: { createdAt: "asc" },
      select: bookableSelect,
    });
  }

  async get(userId: string, bookableId: string) {
    const bookable = await this.findBookable(bookableId);
    await this.organizationAuthorization.requireMembership(
      userId,
      bookable.organizationId,
    );
    return bookable;
  }

  async update(userId: string, bookableId: string, input: UpdateBookableDto) {
    const bookable = await this.findBookable(bookableId);
    await this.organizationAuthorization.requireOwner(
      userId,
      bookable.organizationId,
    );
    validateReservationRule(input.reservationRule);
    if (
      input.status === BookableStatus.PUBLISHED &&
      !input.reservationRule &&
      !bookable.reservationRule
    ) {
      throw new ConflictException(
        "A reservation rule is required before publishing a Bookable",
      );
    }

    try {
      return await this.prisma.bookable.update({
        where: { id: bookableId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.description === undefined
            ? {}
            : { description: input.description }),
          ...(input.slug === undefined ? {} : { slug: input.slug }),
          ...(input.status === undefined ? {} : { status: input.status }),
          ...(input.capacity === undefined ? {} : { capacity: input.capacity }),
          ...(input.reservationRule
            ? {
                reservationRule: {
                  upsert: {
                    create: reservationRuleData(input.reservationRule),
                    update: reservationRuleData(input.reservationRule),
                  },
                },
              }
            : {}),
        },
        select: bookableSelect,
      });
    } catch (error) {
      throw mapBookableError(error);
    }
  }

  async archive(userId: string, bookableId: string) {
    const bookable = await this.findBookable(bookableId);
    await this.organizationAuthorization.requireOwner(
      userId,
      bookable.organizationId,
    );

    return this.prisma.bookable.update({
      where: { id: bookableId },
      data: { status: BookableStatus.ARCHIVED },
      select: bookableSelect,
    });
  }

  private async findBookable(bookableId: string) {
    const bookable = await this.prisma.bookable.findUnique({
      where: { id: bookableId },
      select: bookableSelect,
    });

    if (!bookable) {
      throw new NotFoundException("Bookable not found");
    }

    return bookable;
  }
}

function mapBookableError(error: unknown): never {
  if (isUniqueConstraintError(error)) {
    throw new ConflictException("Bookable slug is already in use");
  }

  throw error;
}

function isUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160)
    .replace(/-+$/g, "");

  return slug || "bookable";
}

function validateReservationRule(rule?: ReservationRuleDto): void {
  if (!rule) return;
  if (rule.durationMode === "FIXED") {
    if (!rule.fixedDuration || rule.fixedDuration <= 0) {
      throw new ConflictException(
        "Fixed reservation duration must be positive",
      );
    }
    return;
  }
  if (
    rule.minimumDuration !== undefined &&
    rule.maximumDuration !== undefined &&
    rule.minimumDuration > rule.maximumDuration
  ) {
    throw new ConflictException(
      "Flexible reservation minimum duration cannot exceed maximum duration",
    );
  }
}

function reservationRuleData(rule: ReservationRuleDto) {
  return {
    durationMode: rule.durationMode,
    fixedDuration: rule.durationMode === "FIXED" ? rule.fixedDuration : null,
    minimumDuration:
      rule.durationMode === "FLEXIBLE" ? rule.minimumDuration : null,
    maximumDuration:
      rule.durationMode === "FLEXIBLE" ? rule.maximumDuration : null,
    minimumAdvanceTime: rule.minimumAdvanceTime,
    maximumAdvanceTime: rule.maximumAdvanceTime,
    cancellationDeadline: rule.cancellationDeadline,
  };
}
