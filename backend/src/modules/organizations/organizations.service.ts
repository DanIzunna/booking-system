import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AddMemberDto } from "./dto/add-member.dto";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { OrganizationAuthorizationService } from "./organization-authorization.service";

const organizationSelect = {
  id: true,
  name: true,
  slug: true,
  timezone: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganizationSelect;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: OrganizationAuthorizationService,
  ) {}

  async create(userId: string, input: CreateOrganizationDto) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const organization = await transaction.organization.create({
          data: {
            name: input.name.trim(),
            slug: input.slug,
            timezone: input.timezone,
            memberships: {
              create: { userId, role: "OWNER" },
            },
          },
          select: organizationSelect,
        });

        return organization;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Organization slug is already in use");
      }
      throw error;
    }
  }

  async list(userId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        organization: { select: organizationSelect },
      },
    });

    return memberships.map(({ role, organization }) => ({
      ...organization,
      role,
    }));
  }

  async get(userId: string, organizationId: string) {
    await this.authorization.requireMembership(userId, organizationId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: organizationSelect,
    });

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    return organization;
  }

  async update(
    userId: string,
    organizationId: string,
    input: UpdateOrganizationDto,
  ) {
    await this.authorization.requireOwner(userId, organizationId);

    try {
      return await this.prisma.organization.update({
        where: { id: organizationId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.slug === undefined ? {} : { slug: input.slug }),
          ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
        },
        select: organizationSelect,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Organization slug is already in use");
      }
      throw error;
    }
  }

  async addMember(userId: string, organizationId: string, input: AddMemberDto) {
    await this.authorization.requireOwner(userId, organizationId);

    const targetUser = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, email: true, name: true },
    });

    if (!targetUser) {
      throw new NotFoundException("User not found");
    }

    try {
      return await this.prisma.organizationMembership.create({
        data: {
          userId: targetUser.id,
          organizationId,
          role: "MEMBER",
        },
        select: {
          id: true,
          userId: true,
          organizationId: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, email: true, name: true } },
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("User is already a member");
      }
      throw error;
    }
  }
}

function isUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
