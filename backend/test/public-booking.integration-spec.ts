import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  BookableStatus,
  DurationMode,
  ReservationStatus,
} from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

interface Session {
  id: string;
  accessToken: string;
}
interface PublicFixture {
  id: string;
  slug: string;
  startAt: Date;
  endAt: Date;
}

const password = "correct-horse-battery-staple";

describe("Public booking (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: Session;
  let anonymousCustomer: Session;
  let organizationId: string;
  const userIds: string[] = [];
  const organizationIds: string[] = [];
  const bookableIds: string[] = [];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL is required for public booking tests");
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
    owner = await register("public-owner");
    anonymousCustomer = await register("public-customer");
    organizationId = await createOrganization(owner);
  });

  afterAll(async () => {
    try {
      await prisma.reservation.deleteMany({
        where: { bookableId: { in: bookableIds } },
      });
      await prisma.availabilityException.deleteMany({
        where: { bookableId: { in: bookableIds } },
      });
      await prisma.availabilityWindow.deleteMany({
        where: { bookableId: { in: bookableIds } },
      });
      await prisma.bookableReservationRule.deleteMany({
        where: { bookableId: { in: bookableIds } },
      });
      await prisma.bookable.deleteMany({ where: { id: { in: bookableIds } } });
      await prisma.organization.deleteMany({
        where: { id: { in: organizationIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await app?.close();
    }
  });

  it("returns only published public-safe Bookable data anonymously", async () => {
    const fixture = await createBookable({ status: BookableStatus.PUBLISHED });
    await prisma.bookable.update({
      where: { id: fixture.id },
      data: { price: 2500, currency: "NGN" },
    });
    const response = await request(app.getHttpServer())
      .get(`/api/v1/public/bookables/${fixture.slug}`)
      .expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: fixture.id,
        slug: fixture.slug,
        name: expect.any(String),
        status: "PUBLISHED",
        price: 2500,
        currency: "NGN",
        organization: expect.objectContaining({
          id: organizationId,
          name: expect.any(String),
          timezone: "Africa/Lagos",
        }),
        reservationRule: expect.objectContaining({ durationMode: "FLEXIBLE" }),
      }),
    );
    expect(Object.keys(response.body).sort()).toEqual(
      [
        "capacity",
        "currency",
        "description",
        "id",
        "name",
        "organization",
        "price",
        "reservationRule",
        "slug",
        "status",
      ].sort(),
    );
    expect(response.body.organization.timezone).toBe("Africa/Lagos");
    expect(response.body.organization.memberships).toBeUndefined();
    expect(response.body.passwordHash).toBeUndefined();
  });

  it("returns fixed-duration slots for a workspace-local date and respects capacity", async () => {
    const fixture = await createBookable({
      capacity: 2,
      durationMode: DurationMode.FIXED,
      fixedDuration: 1800,
    });
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(fixture.startAt);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/public/bookables/${fixture.slug}/availability`)
      .query({ date, quantity: 1 })
      .expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        date,
        timezone: "Africa/Lagos",
        durationMode: "FIXED",
        durationSeconds: 1800,
      }),
    );
    expect(response.body.slots).toHaveLength(2);

    await createReservation(fixture, ReservationStatus.CONFIRMED, 2);
    const full = await request(app.getHttpServer())
      .get(`/api/v1/public/bookables/${fixture.slug}/availability`)
      .query({ date, quantity: 1 })
      .expect(200);
    expect(full.body.slots).toHaveLength(0);
  });

  it("hides draft, archived, and unknown Bookables", async () => {
    const draft = await createBookable({ status: BookableStatus.DRAFT });
    const archived = await createBookable({ status: BookableStatus.ARCHIVED });
    await request(app.getHttpServer())
      .get(`/api/v1/public/bookables/${draft.slug}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/public/bookables/${archived.slug}`)
      .expect(404);
    await request(app.getHttpServer())
      .get("/api/v1/public/bookables/missing-slug")
      .expect(404);
  });

  it("checks schedule availability anonymously and respects BLOCK and OVERRIDE", async () => {
    const fixture = await createBookable({ availability: "normal" });
    await check(fixture, true);
    await check(
      {
        ...fixture,
        startAt: new Date(fixture.startAt.getTime() + 2 * 3600 * 1000),
        endAt: new Date(fixture.endAt.getTime() + 2 * 3600 * 1000),
      },
      false,
    );

    const blocked = await createBookable({
      availability: "normal",
      exception: "BLOCK",
    });
    await check(
      {
        ...blocked,
        endAt: new Date(blocked.startAt.getTime() + 30 * 60 * 1000),
      },
      false,
    );

    const override = await createBookable({
      availability: "none",
      exception: "OVERRIDE",
    });
    await check(
      {
        ...override,
        startAt: new Date(override.startAt.getTime() + 2 * 3600 * 1000),
        endAt: new Date(override.startAt.getTime() + 3 * 3600 * 1000),
      },
      true,
    );
  });

  it("enforces quantity capacity and active reservation statuses", async () => {
    const fixture = await createBookable({
      capacity: 3,
      availability: "normal",
    });
    await createReservation(fixture, ReservationStatus.PENDING, 2);
    await check(fixture, false, 2);

    const cancelled = await createReservation(
      fixture,
      ReservationStatus.CANCELLED,
      1,
    );
    await check(fixture, true, 1);
    await prisma.reservation.update({
      where: { id: cancelled },
      data: { status: ReservationStatus.COMPLETED },
    });
    await check(fixture, true, 1);

    await createReservation(fixture, ReservationStatus.CONFIRMED, 1);
    await check(fixture, false, 1);

    await prisma.availabilityWindow.create({
      data: {
        bookableId: fixture.id,
        type: "SPECIFIC",
        startAt: fixture.endAt,
        endAt: new Date(fixture.endAt.getTime() + 3600 * 1000),
      },
    });

    const adjacent = {
      ...fixture,
      startAt: fixture.endAt,
      endAt: new Date(fixture.endAt.getTime() + 3600 * 1000),
    };
    await check(adjacent, true, 1);
  });

  it("rejects invalid intervals, quantity, duration, and advance-time violations", async () => {
    const fixture = await createBookable({
      availability: "normal",
      minimumDuration: 3600,
      maximumDuration: 7200,
      minimumAdvanceTime: 7200,
      maximumAdvanceTime: 86400,
    });
    await request(app.getHttpServer())
      .get(`/api/v1/public/bookables/${fixture.slug}/availability/check`)
      .query({
        startAt: "invalid",
        endAt: fixture.endAt.toISOString(),
        quantity: 1,
      })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/public/bookables/${fixture.slug}/availability/check`)
      .query({
        startAt: fixture.endAt.toISOString(),
        endAt: fixture.startAt.toISOString(),
        quantity: 1,
      })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/public/bookables/${fixture.slug}/availability/check`)
      .query({
        startAt: fixture.startAt.toISOString(),
        endAt: fixture.endAt.toISOString(),
        quantity: 0,
      })
      .expect(400);
    const tooShort = {
      ...fixture,
      endAt: new Date(fixture.startAt.getTime() + 1800 * 1000),
    };
    await check(tooShort, false, 1, 409);
    const tooFar = {
      ...fixture,
      startAt: new Date(Date.now() + 3 * 86400 * 1000),
      endAt: new Date(Date.now() + 3 * 86400 * 1000 + 3600 * 1000),
    };
    await check(tooFar, false, 1, 409);
  });

  it("supports fixed-duration interval checks", async () => {
    const fixture = await createBookable({
      durationMode: DurationMode.FIXED,
      fixedDuration: 3600,
      availability: "normal",
    });
    await check(fixture, true);
    const wrongDuration = {
      ...fixture,
      endAt: new Date(fixture.startAt.getTime() + 1800 * 1000),
    };
    await check(wrongDuration, false, 1, 409);
  });

  it("does not require organization membership", async () => {
    const fixture = await createBookable({ availability: "normal" });
    await request(app.getHttpServer())
      .get(`/api/v1/public/bookables/${fixture.slug}`)
      .expect(200);
    await check(fixture, true);
  });

  async function register(label: string): Promise<Session> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
        password,
        name: label,
      })
      .expect(201);
    const session = {
      id: response.body.user.id as string,
      accessToken: response.body.accessToken as string,
    };
    userIds.push(session.id);
    return session;
  }

  async function createOrganization(user: Session): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        name: "Public Organization",
        slug: `public-${Date.now()}`,
        timezone: "Africa/Lagos",
      })
      .expect(201);
    organizationIds.push(response.body.id);
    return response.body.id;
  }

  async function createBookable(
    options: {
      status?: BookableStatus;
      capacity?: number;
      durationMode?: DurationMode;
      minimumDuration?: number;
      maximumDuration?: number;
      fixedDuration?: number;
      minimumAdvanceTime?: number;
      maximumAdvanceTime?: number;
      availability?: "normal" | "none";
      exception?: "BLOCK" | "OVERRIDE";
    } = {},
  ): Promise<PublicFixture> {
    const startAt = new Date(Date.now() + 3 * 3600 * 1000);
    startAt.setSeconds(0, 0);
    const endAt = new Date(startAt.getTime() + 3600 * 1000);
    const durationMode = options.durationMode ?? DurationMode.FLEXIBLE;
    const response = await prisma.bookable.create({
      data: {
        organizationId,
        name: `Public Bookable ${Date.now()}`,
        description: "Public description",
        slug: `public-bookable-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        status: options.status ?? BookableStatus.PUBLISHED,
        capacity: options.capacity ?? 2,
        reservationRule: {
          create: {
            durationMode,
            minimumDuration:
              options.minimumDuration ??
              (durationMode === DurationMode.FIXED ? null : 1),
            maximumDuration:
              options.maximumDuration ??
              (durationMode === DurationMode.FIXED ? null : 86400),
            fixedDuration: options.fixedDuration ?? null,
            minimumAdvanceTime: options.minimumAdvanceTime ?? null,
            maximumAdvanceTime: options.maximumAdvanceTime ?? null,
          },
        },
      },
    });
    bookableIds.push(response.id);
    if (options.availability !== "none")
      await prisma.availabilityWindow.create({
        data: { bookableId: response.id, type: "SPECIFIC", startAt, endAt },
      });
    if (options.exception)
      await prisma.availabilityException.create({
        data: {
          bookableId: response.id,
          type: options.exception,
          startAt:
            options.exception === "BLOCK"
              ? startAt
              : new Date(startAt.getTime() + 2 * 3600 * 1000),
          endAt:
            options.exception === "BLOCK"
              ? new Date(startAt.getTime() + 1800 * 1000)
              : new Date(startAt.getTime() + 3 * 3600 * 1000),
        },
      });
    return { id: response.id, slug: response.slug, startAt, endAt };
  }

  async function createReservation(
    fixture: PublicFixture,
    status: ReservationStatus,
    quantity: number,
  ) {
    const reservation = await prisma.reservation.create({
      data: {
        bookableId: fixture.id,
        customerId: anonymousCustomer.id,
        startAt: fixture.startAt,
        endAt: fixture.endAt,
        quantity,
        status,
      },
    });
    return reservation.id;
  }

  async function check(
    fixture: PublicFixture,
    available: boolean,
    quantity = 1,
    expectedStatus = 200,
  ) {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/public/bookables/${fixture.slug}/availability/check`)
      .query({
        startAt: fixture.startAt.toISOString(),
        endAt: fixture.endAt.toISOString(),
        quantity,
      })
      .expect(expectedStatus);
    if (expectedStatus === 200) {
      expect(response.body).toEqual(expect.objectContaining({ available }));
    }
  }
});
