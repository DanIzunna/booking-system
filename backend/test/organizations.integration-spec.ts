import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

interface RegisteredUser {
  id: string;
  email: string;
  accessToken: string;
}

interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  role?: "OWNER" | "MEMBER";
}

describe("Organizations & multi-tenancy (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];
  const organizationIds: string[] = [];
  let owner: RegisteredUser;
  let member: RegisteredUser;
  let secondMember: RegisteredUser;
  let unrelated: RegisteredUser;
  let organization: OrganizationResponse;
  let unrelatedOrganization: OrganizationResponse;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is required for organizations integration tests",
      );
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        stopAtFirstError: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    owner = await registerUser("owner");
    member = await registerUser("member");
    secondMember = await registerUser("second-member");
    unrelated = await registerUser("unrelated");
  });

  afterAll(async () => {
    try {
      if (prisma && organizationIds.length > 0) {
        await prisma.organization.deleteMany({
          where: { id: { in: organizationIds } },
        });
      }
      if (prisma && userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      await app?.close();
    }
  });

  it("creates an organization and makes the creator its OWNER", async () => {
    organization = await createOrganization(owner.accessToken, {
      name: "Owner Organization",
      slug: uniqueSlug("owner-org"),
      timezone: "Africa/Lagos",
    });
    organizationIds.push(organization.id);

    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: owner.id,
          organizationId: organization.id,
        },
      },
    });

    expect(membership?.role).toBe("OWNER");
  });

  it("lists organizations from authenticated membership", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/organizations")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: organization.id,
          slug: organization.slug,
          role: "OWNER",
        }),
      ]),
    );
  });

  it("allows the owner to add a member and prevents duplicate membership", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organization.id}/members`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ userId: member.id })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        userId: member.id,
        organizationId: organization.id,
        role: "MEMBER",
      }),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organization.id}/members`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ userId: member.id })
      .expect(409);
  });

  it("allows one user to belong to multiple organizations", async () => {
    const secondOrganization = await createOrganization(owner.accessToken, {
      name: "Second Owner Organization",
      slug: uniqueSlug("second-org"),
      timezone: "UTC",
    });
    organizationIds.push(secondOrganization.id);

    const memberships = await prisma.organizationMembership.findMany({
      where: { userId: owner.id },
    });

    expect(memberships.map(({ organizationId }) => organizationId)).toEqual(
      expect.arrayContaining([organization.id, secondOrganization.id]),
    );
  });

  it("allows a MEMBER to access an organization but not update it", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organization.id}`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${organization.id}`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ name: "Member Attempt" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organization.id}/members`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ userId: secondMember.id })
      .expect(403);
  });

  it("allows the OWNER to update the organization", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${organization.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Updated Owner Organization" })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: organization.id,
        name: "Updated Owner Organization",
      }),
    );
  });

  it("rejects unauthenticated organization requests", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organization.id}`)
      .expect(401);
  });

  it("does not grant access based on knowledge of an organization ID", async () => {
    unrelatedOrganization = await createOrganization(unrelated.accessToken, {
      name: "Unrelated Organization",
      slug: uniqueSlug("unrelated-org"),
      timezone: "Africa/Lagos",
    });
    organizationIds.push(unrelatedOrganization.id);

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organization.id}`)
      .set("Authorization", `Bearer ${unrelated.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${organization.id}`)
      .set("Authorization", `Bearer ${unrelated.accessToken}`)
      .send({ name: "Cross Tenant Attempt" })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organization.id}/members`)
      .set("Authorization", `Bearer ${unrelated.accessToken}`)
      .send({ userId: secondMember.id })
      .expect(404);

    const listResponse = await request(app.getHttpServer())
      .get("/api/v1/organizations")
      .set("Authorization", `Bearer ${unrelated.accessToken}`)
      .expect(200);

    expect(listResponse.body).toEqual([
      expect.objectContaining({
        id: unrelatedOrganization.id,
        role: "OWNER",
      }),
    ]);
    expect(listResponse.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: organization.id }),
      ]),
    );
  });

  it("prevents a member from being treated as an owner and preserves membership roles", async () => {
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: member.id,
          organizationId: organization.id,
        },
      },
    });

    expect(membership?.role).toBe("MEMBER");
    expect(
      await prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: owner.id,
            organizationId: organization.id,
          },
        },
      }),
    ).toEqual(expect.objectContaining({ role: "OWNER" }));
  });

  it("scopes payment-account access and keeps mutations owner-only", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organization.id}/payment-account`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200)
      .then((response) => expect(response.body).toBeNull());

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organization.id}/payment-account/connect`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organization.id}/payment-account/sync`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organization.id}/payment-account/disconnect`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(403);

    const account = await prisma.organizationPaymentAccount.create({
      data: {
        organizationId: organization.id,
        provider: "STRIPE",
        providerAccountId: `acct_org_test_${Date.now()}`,
        status: "ONBOARDING",
        readyForPayments: false,
      },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organization.id}/payment-account`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200)
      .then((response) => expect(response.body.id).toBe(account.id));
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${unrelatedOrganization.id}/payment-account`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organization.id}/payment-account/disconnect`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(201)
      .then((response) => {
        expect(response.body.status).toBe("DISCONNECTED");
        expect(response.body.readyForPayments).toBe(false);
      });
  });

  async function registerUser(label: string): Promise<RegisteredUser> {
    const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email, password: "correct-horse-battery-staple", name: label })
      .expect(201);

    const user = {
      id: response.body.user.id as string,
      email,
      accessToken: response.body.accessToken as string,
    };
    userIds.push(user.id);
    return user;
  }

  async function createOrganization(
    accessToken: string,
    input: { name: string; slug: string; timezone: string },
  ): Promise<OrganizationResponse> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(input)
      .expect(201);

    return response.body as OrganizationResponse;
  }
});

function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
