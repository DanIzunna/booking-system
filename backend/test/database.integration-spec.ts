import { PrismaService } from "../src/common/prisma/prisma.service";

describe("Prisma persistence foundation", () => {
  const prisma = new PrismaService();
  const databaseUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is required for database integration tests",
      );
    }

    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects to PostgreSQL and persists a user with an organization membership", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const email = `phase1-${suffix}@example.test`;
    const slug = `phase1-${suffix}`;

    const organization = await prisma.organization.create({
      data: {
        name: "Phase 1 Test Organization",
        slug,
        memberships: {
          create: {
            role: "OWNER",
            user: {
              create: {
                email,
                passwordHash: "test-hash",
                name: "Phase 1 Test User",
              },
            },
          },
        },
      },
      include: { memberships: { include: { user: true } } },
    });

    expect(organization.memberships).toHaveLength(1);
    expect(organization.memberships[0].user.email).toBe(email);

    await expect(
      prisma.organization.create({
        data: {
          name: "Duplicate Organization",
          slug,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    await prisma.organization.delete({ where: { id: organization.id } });
    await expect(
      prisma.organization.findUnique({ where: { id: organization.id } }),
    ).resolves.toBeNull();
  });
});
