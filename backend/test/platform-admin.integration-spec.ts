import { ExecutionContext } from "@nestjs/common";
import { PlatformRole } from "@prisma/client";
import { PlatformAdminGuard } from "../src/modules/auth/guards/platform-admin.guard";
import { PrismaService } from "../src/common/prisma/prisma.service";

function contextFor(userId: string): ExecutionContext {
  const request = { user: { id: userId } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("PlatformAdminGuard (integration)", () => {
  const prisma = new PrismaService();
  const guard = new PlatformAdminGuard(prisma);
  const userIds: string[] = [];
  const organizationIds: string[] = [];
  let ownerId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const admin = await prisma.user.create({
      data: {
        email: `platform-admin-${suffix}@example.test`,
        passwordHash: "test-hash",
        name: "Platform Admin",
        platformRole: PlatformRole.ADMIN,
      },
    });
    const user = await prisma.user.create({
      data: {
        email: `platform-user-${suffix}@example.test`,
        passwordHash: "test-hash",
        name: "Platform User",
      },
    });
    const owner = await prisma.user.create({
      data: {
        email: `organization-owner-${suffix}@example.test`,
        passwordHash: "test-hash",
        name: "Organization Owner",
      },
    });
    userIds.push(admin.id, user.id, owner.id);
    ownerId = owner.id;

    const organization = await prisma.organization.create({
      data: {
        name: "Platform Role Test Organization",
        slug: `platform-role-${suffix}`,
        memberships: {
          create: { userId: owner.id, role: "OWNER" },
        },
      },
    });
    organizationIds.push(organization.id);
    await prisma.organizationMembership.findUniqueOrThrow({
      where: {
        userId_organizationId: {
          userId: owner.id,
          organizationId: organization.id,
        },
      },
    });

    expect(await guard.canActivate(contextFor(admin.id))).toBe(true);
    await expect(guard.canActivate(contextFor(user.id))).rejects.toMatchObject({
      status: 403,
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: { id: { in: organizationIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("uses the current database role without requiring a new token", async () => {
    await prisma.user.update({
      where: { id: ownerId },
      data: { platformRole: PlatformRole.ADMIN },
    });
    await expect(guard.canActivate(contextFor(ownerId))).resolves.toBe(true);

    await prisma.user.update({
      where: { id: ownerId },
      data: { platformRole: PlatformRole.USER },
    });
    await expect(guard.canActivate(contextFor(ownerId))).rejects.toMatchObject({
      status: 403,
    });
  });
});
