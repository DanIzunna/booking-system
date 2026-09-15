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

    try {
      return await this.prisma.bookable.create({
        data: {
          organizationId: input.organizationId,
          name: input.name,
          description: input.description,
          slug: input.slug,
          status: input.status ?? BookableStatus.DRAFT,
          capacity: input.capacity,
        },
        select: bookableSelect,
      });
    } catch (error) {
      throw mapBookableError(error);
    }
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
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ConflictException("Bookable slug is already in use");
  }

  throw error;
}
