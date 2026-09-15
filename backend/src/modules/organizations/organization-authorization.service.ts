import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MembershipRole, OrganizationMembership } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class OrganizationAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async requireMembership(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembership> {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
    });

    if (!membership) {
      throw new NotFoundException("Organization not found");
    }

    return membership;
  }

  async requireOwner(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembership> {
    const membership = await this.requireMembership(userId, organizationId);

    if (membership.role !== MembershipRole.OWNER) {
      throw new ForbiddenException("Owner membership required");
    }

    return membership;
  }
}
