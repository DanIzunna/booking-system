import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

interface UserSession {
  id: string;
  accessToken: string;
}

interface OrganizationRecord {
  id: string;
  slug: string;
}

interface BookableRecord {
  id: string;
  organizationId: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  capacity: number;
}

describe("Bookables (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];
  const organizationIds: string[] = [];
  const bookableIds: string[] = [];
  let owner: UserSession;
  let member: UserSession;
  let outsider: UserSession;
  let organization: OrganizationRecord;
  let secondOrganization: OrganizationRecord;
  let outsiderOrganization: OrganizationRecord;
  let ownerBookable: BookableRecord;
  let memberBookable: BookableRecord;
  let secondOrganizationBookable: BookableRecord;
  let outsiderBookable: BookableRecord;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is required for Bookables integration tests",
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

    owner = await registerUser("bookable-owner");
    member = await registerUser("bookable-member");
    outsider = await registerUser("bookable-outsider");

    organization = await createOrganization(owner, "primary");
    secondOrganization = await createOrganization(owner, "secondary");
    outsiderOrganization = await createOrganization(outsider, "outsider");
    await addMember(owner, organization.id, member.id);
  });

  afterAll(async () => {
    try {
      if (bookableIds.length > 0) {
        await prisma.bookable.deleteMany({
          where: { id: { in: bookableIds } },
        });
      }
      if (organizationIds.length > 0) {
        await prisma.organization.deleteMany({
          where: { id: { in: organizationIds } },
        });
      }
      if (userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      await app?.close();
    }
  });

  it("creates a Bookable for an authenticated member with DRAFT default status", async () => {
    ownerBookable = await createBookable(owner, organization.id, {
      name: "Main Room",
      description: "Primary reservable room",
      slug: uniqueSlug("main-room"),
      capacity: 4,
    });
    bookableIds.push(ownerBookable.id);

    expect(ownerBookable.organizationId).toBe(organization.id);
    expect(ownerBookable.status).toBe("DRAFT");
    expect(ownerBookable.capacity).toBe(4);

    memberBookable = await createBookable(member, organization.id, {
      name: "Member Room",
      slug: uniqueSlug("member-room"),
      capacity: 1,
    });
    bookableIds.push(memberBookable.id);
    expect(memberBookable.organizationId).toBe(organization.id);
  });

  it("rejects invalid capacity and malformed input", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/bookables")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        organizationId: organization.id,
        name: "Invalid Capacity",
        slug: uniqueSlug("invalid-capacity"),
        capacity: 0,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/bookables")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        organizationId: organization.id,
        name: "Malformed Slug",
        slug: "Not A Slug",
        capacity: 1,
      })
      .expect(400);
  });

  it("accepts confirmation policy, price, and currency on create and update", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/bookables")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        organizationId: organization.id,
        name: "Priced Conference Room",
        slug: uniqueSlug("priced-room"),
        capacity: 3,
        confirmationPolicy: "REQUIRES_APPROVAL",
        pricingType: "PAID",
        price: 2500,
        currency: "USD",
      })
      .expect(201);

    expect(created.body).toEqual(
      expect.objectContaining({
        confirmationPolicy: "REQUIRES_APPROVAL",
        price: 2500,
        currency: "USD",
      }),
    );

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/bookables/${created.body.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        confirmationPolicy: "AUTOMATIC",
        pricingType: "PAID",
        price: 4000,
        currency: "NGN",
      })
      .expect(200);

    expect(updated.body).toEqual(
      expect.objectContaining({
        confirmationPolicy: "AUTOMATIC",
        price: 4000,
        currency: "NGN",
      }),
    );
    bookableIds.push(created.body.id);
  });

  it("enforces explicit FREE and PAID pricing combinations", async () => {
    const free = await request(app.getHttpServer())
      .post("/api/v1/bookables")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        organizationId: organization.id,
        name: "Free Pricing Room",
        slug: uniqueSlug("free-pricing"),
        capacity: 1,
        pricingType: "FREE",
        price: null,
        currency: null,
      })
      .expect(201);
    bookableIds.push(free.body.id);
    expect(free.body).toEqual(
      expect.objectContaining({
        pricingType: "FREE",
        price: null,
        currency: null,
      }),
    );

    const paid = await request(app.getHttpServer())
      .post("/api/v1/bookables")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        organizationId: organization.id,
        name: "Paid Pricing Room",
        slug: uniqueSlug("paid-pricing"),
        capacity: 1,
        pricingType: "PAID",
        price: 100,
        currency: "USD",
      })
      .expect(201);
    bookableIds.push(paid.body.id);
    expect(paid.body).toEqual(
      expect.objectContaining({
        pricingType: "PAID",
        price: 100,
        currency: "USD",
      }),
    );

    for (const input of [
      { pricingType: "PAID", price: 0, currency: "USD" },
      { pricingType: "PAID", currency: "USD" },
      { pricingType: "FREE", price: 500, currency: "USD" },
      { pricingType: "PAID", price: 100, currency: "JPY" },
    ]) {
      await request(app.getHttpServer())
        .post("/api/v1/bookables")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({
          organizationId: organization.id,
          name: "Invalid Pricing Room",
          slug: uniqueSlug("invalid-pricing"),
          capacity: 1,
          ...input,
        })
        .expect(400);
    }
  });

  it("configures reservation rules and requires one before publishing", async () => {
    const withoutRule = await createBookable(owner, organization.id, {
      name: "Rule Validation Room",
      slug: uniqueSlug("rule-validation"),
      capacity: 1,
    });
    bookableIds.push(withoutRule.id);

    expect(withoutRule).toEqual(
      expect.objectContaining({ reservationRule: null, status: "DRAFT" }),
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/bookables/${withoutRule.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        reservationRule: {
          durationMode: "FIXED",
          fixedDuration: 0,
        },
      })
      .expect(400);

    const configured = await request(app.getHttpServer())
      .patch(`/api/v1/bookables/${withoutRule.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        reservationRule: {
          durationMode: "FIXED",
          fixedDuration: 3600,
        },
      })
      .expect(200);
    expect(configured.body.reservationRule).toEqual(
      expect.objectContaining({
        durationMode: "FIXED",
        fixedDuration: 3600,
      }),
    );
    await expect(
      prisma.bookable.findUnique({
        where: { id: withoutRule.id },
        select: { reservationRule: true },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        reservationRule: expect.objectContaining({ fixedDuration: 3600 }),
      }),
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/bookables/${withoutRule.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: "PUBLISHED" })
      .expect(200);

    const missingRule = await createBookable(owner, organization.id, {
      name: "Missing Rule Room",
      slug: uniqueSlug("missing-rule"),
      capacity: 1,
    });
    bookableIds.push(missingRule.id);
    await request(app.getHttpServer())
      .patch(`/api/v1/bookables/${missingRule.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: "PUBLISHED" })
      .expect(409);

    await request(app.getHttpServer())
      .post("/api/v1/bookables")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        organizationId: organization.id,
        name: "Direct Published Without Rule",
        slug: uniqueSlug("direct-published-without-rule"),
        capacity: 1,
        pricingType: "FREE",
        status: "PUBLISHED",
      })
      .expect(409);
  });

  it("persists flexible reservation durations in seconds and rejects invalid ranges", async () => {
    const flexible = await createBookable(owner, organization.id, {
      name: "Flexible Duration Room",
      slug: uniqueSlug("flexible-duration"),
      capacity: 1,
    });
    bookableIds.push(flexible.id);

    const configured = await request(app.getHttpServer())
      .patch(`/api/v1/bookables/${flexible.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        reservationRule: {
          durationMode: "FLEXIBLE",
          minimumDuration: 3600,
          maximumDuration: 14400,
        },
      })
      .expect(200);

    expect(configured.body.reservationRule).toEqual(
      expect.objectContaining({
        durationMode: "FLEXIBLE",
        minimumDuration: 3600,
        maximumDuration: 14400,
      }),
    );
    await expect(
      prisma.bookable.findUnique({
        where: { id: flexible.id },
        select: { reservationRule: true },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        reservationRule: expect.objectContaining({
          durationMode: "FLEXIBLE",
          minimumDuration: 3600,
          maximumDuration: 14400,
        }),
      }),
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/bookables/${flexible.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        reservationRule: {
          durationMode: "FLEXIBLE",
          minimumDuration: 0,
          maximumDuration: 14400,
        },
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/bookables/${flexible.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        reservationRule: {
          durationMode: "FLEXIBLE",
          minimumDuration: 3600,
          maximumDuration: 0,
        },
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/bookables/${flexible.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        reservationRule: {
          durationMode: "FLEXIBLE",
          minimumDuration: 14400,
          maximumDuration: 3600,
        },
      })
      .expect(409);
  });

  it("rejects a duplicate global slug", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/bookables")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        organizationId: secondOrganization.id,
        name: "Duplicate Slug",
        slug: ownerBookable.slug,
        capacity: 1,
        pricingType: "FREE",
      })
      .expect(409);
  });

  it("generates a unique slug from the name when slug is omitted", async () => {
    const first = await request(app.getHttpServer())
      .post("/api/v1/bookables")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        organizationId: organization.id,
        name: "Generated Conference Room",
        capacity: 1,
        pricingType: "FREE",
      })
      .expect(201);
    bookableIds.push(first.body.id);

    const second = await request(app.getHttpServer())
      .post("/api/v1/bookables")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        organizationId: organization.id,
        name: "Generated Conference Room",
        capacity: 1,
        pricingType: "FREE",
      })
      .expect(201);
    bookableIds.push(second.body.id);

    expect(first.body.slug).toBe("generated-conference-room");
    expect(second.body.slug).toBe("generated-conference-room-2");
  });

  it("allows a user with multiple organizations to create and access both organizations' Bookables", async () => {
    secondOrganizationBookable = await createBookable(
      owner,
      secondOrganization.id,
      {
        name: "Second Organization Room",
        slug: uniqueSlug("second-room"),
        capacity: 2,
      },
    );
    bookableIds.push(secondOrganizationBookable.id);

    await request(app.getHttpServer())
      .get(`/api/v1/bookables/${ownerBookable.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/bookables/${secondOrganizationBookable.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    const primaryList = await request(app.getHttpServer())
      .get(`/api/v1/bookables?organizationId=${organization.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(primaryList.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ownerBookable.id }),
        expect.objectContaining({ id: memberBookable.id }),
      ]),
    );
    expect(primaryList.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: secondOrganizationBookable.id }),
      ]),
    );
  });

  it("does not let an unrelated user access Bookables by ID or list filter", async () => {
    outsiderBookable = await createBookable(outsider, outsiderOrganization.id, {
      name: "Outsider Room",
      slug: uniqueSlug("outsider-room"),
      capacity: 1,
    });
    bookableIds.push(outsiderBookable.id);

    await request(app.getHttpServer())
      .get(`/api/v1/bookables/${ownerBookable.id}`)
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/bookables?organizationId=${organization.id}`)
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/bookables")
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .expect(200);
    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: outsiderBookable.id }),
      ]),
    );
    expect(list.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ownerBookable.id }),
      ]),
    );
  });

  it("allows OWNER updates and rejects MEMBER updates", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/bookables/${ownerBookable.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Updated Main Room", capacity: 5 })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/bookables/${ownerBookable.id}`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ name: "Unauthorized Update" })
      .expect(403);
  });

  it("archives a Bookable without deleting it and rejects unauthorized archive attempts", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${ownerBookable.id}/archive`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(403);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/bookables/${ownerBookable.id}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    expect(response.body.status).toBe("ARCHIVED");
    await expect(
      prisma.bookable.findUnique({ where: { id: ownerBookable.id } }),
    ).resolves.toEqual(expect.objectContaining({ status: "ARCHIVED" }));
  });

  it("restores an archived Bookable to DRAFT and keeps it non-public", async () => {
    const archived = await createBookable(owner, organization.id, {
      name: "Restorable Room",
      slug: uniqueSlug("restorable-room"),
      capacity: 3,
    });
    bookableIds.push(archived.id);

    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${archived.id}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/bookables/${archived.id}/restore`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: archived.id,
        slug: archived.slug,
        status: "DRAFT",
        capacity: archived.capacity,
      }),
    );
    await expect(
      prisma.bookable.findUnique({ where: { id: archived.id } }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: archived.id,
        slug: archived.slug,
        status: "DRAFT",
        capacity: archived.capacity,
      }),
    );
    await request(app.getHttpServer())
      .get(`/api/v1/public/bookables/${archived.slug}`)
      .expect(404);
  });

  it("rejects restore attempts for unauthorized users and non-archived states", async () => {
    const archiveTarget = await createBookable(owner, organization.id, {
      name: "Protected Archive",
      slug: uniqueSlug("protected-archive"),
      capacity: 2,
    });
    bookableIds.push(archiveTarget.id);
    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${archiveTarget.id}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${archiveTarget.id}/restore`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(403);
    await expect(
      prisma.bookable.findUnique({ where: { id: archiveTarget.id } }),
    ).resolves.toEqual(expect.objectContaining({ status: "ARCHIVED" }));

    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${archiveTarget.id}/restore`)
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .expect(404);
    await expect(
      prisma.bookable.findUnique({ where: { id: archiveTarget.id } }),
    ).resolves.toEqual(expect.objectContaining({ status: "ARCHIVED" }));

    const draft = await createBookable(owner, organization.id, {
      name: "Draft Only",
      slug: uniqueSlug("draft-only"),
      capacity: 4,
    });
    bookableIds.push(draft.id);
    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${draft.id}/restore`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(409);

    const published = await createBookable(owner, organization.id, {
      name: "Published Only",
      slug: uniqueSlug("published-only"),
      capacity: 4,
    });
    bookableIds.push(published.id);
    await prisma.bookable.update({
      where: { id: published.id },
      data: { status: "PUBLISHED" },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${published.id}/restore`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(409);
  });

  it("preserves Bookable data when restoring", async () => {
    const target = await createBookable(owner, organization.id, {
      name: "Data Preservation Room",
      slug: uniqueSlug("data-preservation"),
      capacity: 7,
    });
    bookableIds.push(target.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/bookables/${target.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        pricingType: "PAID",
        price: 2500,
        currency: "USD",
      })
      .expect(200);

    await prisma.bookable.update({
      where: { id: target.id },
      data: {
        status: "ARCHIVED",
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${target.id}/restore`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    const restored = await prisma.bookable.findUnique({
      where: { id: target.id },
      include: { reservationRule: true },
    });

    expect(restored).toEqual(
      expect.objectContaining({
        id: target.id,
        slug: target.slug,
        status: "DRAFT",
        capacity: 7,
        price: 2500,
        currency: "USD",
      }),
    );
    expect(restored?.reservationRule).toBeNull();
  });

  it("rejects unauthenticated Bookable requests", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/bookables/${ownerBookable.id}`)
      .expect(401);
    await request(app.getHttpServer()).get("/api/v1/bookables").expect(401);
  });

  async function registerUser(label: string): Promise<UserSession> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
        password: "correct-horse-battery-staple",
        name: label,
      })
      .expect(201);

    const user = {
      id: response.body.user.id as string,
      accessToken: response.body.accessToken as string,
    };
    userIds.push(user.id);
    return user;
  }

  async function createOrganization(
    user: UserSession,
    suffix: string,
  ): Promise<OrganizationRecord> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        name: `${suffix} organization`,
        slug: uniqueSlug(suffix),
        timezone: "Africa/Lagos",
      })
      .expect(201);

    const organization = response.body as OrganizationRecord;
    organizationIds.push(organization.id);
    return organization;
  }

  async function addMember(
    user: UserSession,
    organizationId: string,
    memberId: string,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/members`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ userId: memberId })
      .expect(201);
  }

  async function createBookable(
    user: UserSession,
    organizationId: string,
    input: {
      name: string;
      description?: string;
      slug: string;
      capacity: number;
      price?: number;
      currency?: string;
    },
  ): Promise<BookableRecord> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/bookables")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        organizationId,
        pricingType: input.price && input.price > 0 ? "PAID" : "FREE",
        ...input,
      })
      .expect(201);

    return response.body as BookableRecord;
  }
});

function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
