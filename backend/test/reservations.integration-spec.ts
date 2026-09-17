import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  BookableStatus,
  ConfirmationPolicy,
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

interface BookableSetup {
  id: string;
  organizationId: string;
  startAt: Date;
  endAt: Date;
}

const password = "correct-horse-battery-staple";

describe("Reservations (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: Session;
  let customer: Session;
  let secondCustomer: Session;
  let member: Session;
  let organizationId: string;
  const userIds: string[] = [];
  const organizationIds: string[] = [];
  const bookableIds: string[] = [];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is required for reservations integration tests",
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

    owner = await register("reservation-owner");
    customer = await register("reservation-customer");
    secondCustomer = await register("reservation-second-customer");
    member = await register("reservation-member");
    organizationId = await createOrganization(owner);
    organizationIds.push(organizationId);
    await prisma.organizationMembership.create({
      data: { userId: member.id, organizationId, role: "MEMBER" },
    });
  });

  afterAll(async () => {
    try {
      await prisma.payment.deleteMany({
        where: { reservation: { bookableId: { in: bookableIds } } },
      });
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

  it("requires authentication and allows a non-member customer to reserve a published Bookable", async () => {
    const bookable = await createBookable({ capacity: 2 });
    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${bookable.id}/reservations`)
      .send({
        startAt: bookable.startAt.toISOString(),
        endAt: bookable.endAt.toISOString(),
        quantity: 1,
      })
      .expect(401);

    const response = await createReservation(customer, bookable);
    expect(response.body).toEqual(
      expect.objectContaining({
        bookableId: bookable.id,
        customerId: customer.id,
        quantity: 1,
        status: "CONFIRMED",
      }),
    );
  });

  it("creates automatic free reservations as confirmed immediately", async () => {
    const bookable = await createBookable({
      confirmationPolicy: ConfirmationPolicy.AUTOMATIC,
    });
    const created = await createReservation(customer, bookable);
    expect(created.body).toEqual(
      expect.objectContaining({
        bookableId: bookable.id,
        quantity: 1,
        amount: 0,
        status: "CONFIRMED",
      }),
    );
  });

  it("creates automatic paid reservations as pending until payment succeeds", async () => {
    const bookable = await createBookable({
      confirmationPolicy: ConfirmationPolicy.AUTOMATIC,
      price: 1000,
    });
    const created = await createReservation(customer, bookable);
    expect(created.body).toEqual(
      expect.objectContaining({
        bookableId: bookable.id,
        amount: 1000,
        status: "PENDING",
      }),
    );
  });

  it("creates approval-required free reservations as pending", async () => {
    const bookable = await createBookable({
      confirmationPolicy: ConfirmationPolicy.REQUIRES_APPROVAL,
    });
    const created = await createReservation(customer, bookable);
    expect(created.body).toEqual(
      expect.objectContaining({
        bookableId: bookable.id,
        quantity: 1,
        amount: 0,
        status: "PENDING",
      }),
    );
  });

  it("creates approval-required paid reservations as pending", async () => {
    const bookable = await createBookable({
      confirmationPolicy: ConfirmationPolicy.REQUIRES_APPROVAL,
      price: 1000,
    });
    const created = await createReservation(customer, bookable);
    expect(created.body).toEqual(
      expect.objectContaining({
        bookableId: bookable.id,
        amount: 1000,
        status: "PENDING",
      }),
    );
  });

  it("confirms only the authenticated customer's free reservation", async () => {
    const bookable = await createBookable({ capacity: 2 });
    const created = await createReservation(customer, bookable);
    const reservationId = created.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/reservations/${reservationId}/confirm-free`)
      .set("Authorization", `Bearer ${secondCustomer.accessToken}`)
      .expect(404);

    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/reservations/${reservationId}/confirm-free`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .expect(201);
    expect(confirmed.body).toEqual(
      expect.objectContaining({
        id: reservationId,
        status: "CONFIRMED",
        amount: 0,
      }),
    );

    const repeated = await request(app.getHttpServer())
      .post(`/api/v1/reservations/${reservationId}/confirm-free`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .expect(201);
    expect(repeated.body).toEqual(
      expect.objectContaining({ id: reservationId, status: "CONFIRMED" }),
    );
  });

  it("does not allow paid reservations through free confirmation", async () => {
    const bookable = await createBookable({ capacity: 2 });
    await prisma.bookable.update({
      where: { id: bookable.id },
      data: { price: 1000 },
    });
    const created = await createReservation(customer, bookable);
    await request(app.getHttpServer())
      .post(`/api/v1/reservations/${created.body.id}/confirm-free`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .expect(409);
  });

  it("rejects DRAFT and ARCHIVED Bookables", async () => {
    const draft = await createBookable({ status: BookableStatus.DRAFT });
    await createReservation(customer, draft, 409);

    const archived = await createBookable({ status: BookableStatus.ARCHIVED });
    await createReservation(customer, archived, 409);
  });

  it("enforces flexible duration rules and derives fixed duration", async () => {
    const flexible = await createBookable({
      minimumDuration: 3600,
      maximumDuration: 7200,
    });
    await createReservation(customer, flexible, 409, 1800);
    await createReservation(customer, flexible, 409, 10800);

    const fixed = await createBookable({
      durationMode: DurationMode.FIXED,
      fixedDuration: 3600,
    });
    const response = await createReservation(
      customer,
      fixed,
      201,
      undefined,
      false,
    );
    const fixedReservation = response.body;
    expect(
      new Date(fixedReservation.endAt).getTime() -
        new Date(fixedReservation.startAt).getTime(),
    ).toBe(3600 * 1000);

    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${fixed.id}/reservations`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({
        startAt: fixed.startAt.toISOString(),
        endAt: fixed.endAt.toISOString(),
        quantity: 1,
      })
      .expect(400);
  });

  it("enforces minimum and maximum advance time", async () => {
    const minimum = await createBookable({ minimumAdvanceTime: 7200 });
    await createReservation(
      customer,
      minimum,
      409,
      undefined,
      true,
      new Date(Date.now() + 1800 * 1000 + 3600 * 1000),
      new Date(Date.now() + 1800 * 1000 + 2 * 3600 * 1000),
    );

    const maximum = await createBookable({ maximumAdvanceTime: 1800 });
    await createReservation(
      customer,
      maximum,
      409,
      undefined,
      true,
      new Date(Date.now() + 7200 * 1000 + 3600 * 1000),
      new Date(Date.now() + 7200 * 1000 + 2 * 3600 * 1000),
    );
  });

  it("requires continuous availability and respects BLOCK and OVERRIDE exceptions", async () => {
    const bookable = await createBookable({ availability: "split" });
    await createReservation(
      customer,
      bookable,
      409,
      undefined,
      true,
      bookable.startAt,
      bookable.endAt,
    );

    const blocked = await createBookable({
      availability: "normal",
      exception: "BLOCK",
    });
    await createReservation(
      customer,
      blocked,
      409,
      undefined,
      true,
      blocked.startAt,
      new Date(blocked.startAt.getTime() + 30 * 60 * 1000),
    );

    const override = await createBookable({
      availability: "none",
      exception: "OVERRIDE",
    });
    await createReservation(
      customer,
      override,
      201,
      undefined,
      true,
      new Date(override.startAt.getTime() + 2 * 3600 * 1000),
      new Date(override.startAt.getTime() + 3 * 3600 * 1000),
    );
  });

  it("accumulates only active overlapping reservation quantities", async () => {
    const bookable = await createBookable({ capacity: 2 });
    await createReservation(
      customer,
      bookable,
      201,
      undefined,
      true,
      undefined,
      undefined,
      1,
    );
    await createReservation(
      secondCustomer,
      bookable,
      409,
      undefined,
      true,
      undefined,
      undefined,
      2,
    );

    const cancelled = await prisma.reservation.findFirstOrThrow({
      where: { bookableId: bookable.id },
    });
    await prisma.reservation.update({
      where: { id: cancelled.id },
      data: { status: ReservationStatus.CANCELLED },
    });
    await createReservation(
      secondCustomer,
      bookable,
      201,
      undefined,
      true,
      undefined,
      undefined,
      2,
    );
  });

  it("treats touching half-open intervals as non-overlapping", async () => {
    const bookable = await createBookable({ capacity: 1 });
    await prisma.availabilityWindow.create({
      data: {
        bookableId: bookable.id,
        type: "SPECIFIC",
        startAt: bookable.startAt,
        endAt: new Date(bookable.endAt.getTime() + 3600 * 1000),
      },
    });
    await createReservation(
      customer,
      bookable,
      201,
      undefined,
      true,
      undefined,
      undefined,
      1,
    );
    await createReservation(
      secondCustomer,
      bookable,
      201,
      undefined,
      true,
      bookable.endAt,
      new Date(bookable.endAt.getTime() + 3600 * 1000),
    );
  });

  it("restricts reservation reads to the authenticated customer", async () => {
    const bookable = await createBookable({ capacity: 2 });
    const created = await createReservation(customer, bookable);
    await request(app.getHttpServer())
      .get(`/api/v1/reservations/${created.body.id}`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/reservations/${created.body.id}`)
      .set("Authorization", `Bearer ${secondCustomer.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/reservations")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .expect(200);
    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          customerId: customer.id,
        }),
      ]),
    );
    expect(list.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ customerId: secondCustomer.id }),
      ]),
    );
  });

  it("supports organization-scoped operator reservation reads and filters", async () => {
    const primaryBookable = await createBookable({
      organizationId,
      capacity: 2,
    });
    const pendingBookable = await createBookable({
      organizationId,
      capacity: 2,
      confirmationPolicy: ConfirmationPolicy.REQUIRES_APPROVAL,
    });
    const secondOrganizationId = await createOrganization(owner);
    organizationIds.push(secondOrganizationId);
    const secondaryBookable = await createBookable({
      organizationId: secondOrganizationId,
      capacity: 2,
    });
    const primary = await createReservation(customer, primaryBookable);
    const pending = await createReservation(customer, pendingBookable);
    const secondary = await createReservation(customer, secondaryBookable);
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(primaryBookable.startAt);

    const ownerList = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/reservations`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(ownerList.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: primary.body.id,
          bookable: expect.objectContaining({ id: primaryBookable.id }),
          customer: expect.objectContaining({ id: customer.id }),
        }),
      ]),
    );
    expect(ownerList.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: secondary.body.id }),
      ]),
    );

    const memberList = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/reservations`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);
    expect(memberList.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: primary.body.id }),
      ]),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/reservations`)
      .query({ bookableId: pendingBookable.id, status: "PENDING", date })
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200)
      .then((response) => {
        expect(response.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: pending.body.id }),
          ]),
        );
        expect(response.body).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: primary.body.id }),
          ]),
        );
        expect(response.body).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: secondary.body.id }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${organizationId}/reservations/${primary.body.id}`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${secondOrganizationId}/reservations/${primary.body.id}`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(404);
  });

  it("allows an organization member to approve a pending approval-required reservation", async () => {
    const bookable = await createBookable({
      organizationId,
      confirmationPolicy: ConfirmationPolicy.REQUIRES_APPROVAL,
    });
    const created = await createReservation(customer, bookable);
    const response = await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${created.body.id}/approve`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: created.body.id,
        status: "CONFIRMED",
      }),
    );
  });

  it("allows an organization member to reject a pending approval-required reservation", async () => {
    const bookable = await createBookable({
      organizationId,
      confirmationPolicy: ConfirmationPolicy.REQUIRES_APPROVAL,
    });
    const created = await createReservation(customer, bookable);
    const response = await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${created.body.id}/reject`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: created.body.id,
        status: "REJECTED",
      }),
    );
  });

  it("rejects approval and rejection by a non-member", async () => {
    const bookable = await createBookable({
      organizationId,
      confirmationPolicy: ConfirmationPolicy.REQUIRES_APPROVAL,
    });
    const created = await createReservation(customer, bookable);
    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${created.body.id}/approve`,
      )
      .set("Authorization", `Bearer ${secondCustomer.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${created.body.id}/reject`,
      )
      .set("Authorization", `Bearer ${secondCustomer.accessToken}`)
      .expect(404);
  });

  it("rejects actions on reservations from another organization", async () => {
    const otherOrganizationId = await createOrganization(owner);
    organizationIds.push(otherOrganizationId);
    const otherBookable = await createBookable({
      organizationId: otherOrganizationId,
      confirmationPolicy: ConfirmationPolicy.REQUIRES_APPROVAL,
    });
    const created = await createReservation(customer, otherBookable);
    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${created.body.id}/approve`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${created.body.id}/reject`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(404);
  });

  it("approves approval-required paid reservations regardless of payment status", async () => {
    const bookable = await createBookable({
      organizationId,
      confirmationPolicy: ConfirmationPolicy.REQUIRES_APPROVAL,
      price: 1000,
    });
    const created = await createReservation(customer, bookable);
    await prisma.payment.create({
      data: {
        reservationId: created.body.id,
        provider: "fake",
        providerReference: `approval-paid-${Date.now()}`,
        amount: 1000,
        currency: "NGN",
        status: "PENDING",
      },
    });
    const response = await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${created.body.id}/approve`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(201);
    expect(response.body).toEqual(
      expect.objectContaining({ id: created.body.id, status: "CONFIRMED" }),
    );
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { reservationId: created.body.id },
    });
    expect(payment.status).toBe("PENDING");
  });

  it("auto-approved reservations cannot be approved or rejected by the operator", async () => {
    const bookable = await createBookable({
      organizationId,
      confirmationPolicy: ConfirmationPolicy.AUTOMATIC,
    });
    const created = await createReservation(customer, bookable);
    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${created.body.id}/approve`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(409);
    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${created.body.id}/reject`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(409);
  });

  it("rejected or confirmed reservations cannot be approved or rejected again", async () => {
    const bookable = await createBookable({
      organizationId,
      confirmationPolicy: ConfirmationPolicy.REQUIRES_APPROVAL,
    });
    const created = await createReservation(customer, bookable);
    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${created.body.id}/reject`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${created.body.id}/approve`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(409);
    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${created.body.id}/reject`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(409);

    const secondBookable = await createBookable({
      organizationId,
      confirmationPolicy: ConfirmationPolicy.REQUIRES_APPROVAL,
    });
    const secondCreated = await createReservation(customer, secondBookable);
    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${secondCreated.body.id}/approve`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${secondCreated.body.id}/approve`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(409);
    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${secondCreated.body.id}/reject`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(409);
  });

  it("rechecks capacity during approval and blocks approval when it would exceed capacity", async () => {
    const bookable = await createBookable({
      organizationId,
      confirmationPolicy: ConfirmationPolicy.REQUIRES_APPROVAL,
      capacity: 1,
    });
    const pending = await createReservation(customer, bookable);

    await prisma.reservation.create({
      data: {
        bookableId: bookable.id,
        customerId: secondCustomer.id,
        startAt: bookable.startAt,
        endAt: bookable.endAt,
        quantity: 1,
        amount: 0,
        currency: bookable.currency,
        status: ReservationStatus.CONFIRMED,
      },
    });

    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/reservations/${pending.body.id}/approve`,
      )
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(409);
    const refreshed = await request(app.getHttpServer())
      .get(`/api/v1/reservations/${pending.body.id}`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .expect(200);
    expect(refreshed.body.status).toBe("PENDING");
  });

  it("allows exactly one concurrent reservation at capacity one", async () => {
    const bookable = await createBookable({ capacity: 1 });
    const results = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/bookables/${bookable.id}/reservations`)
        .set("Authorization", `Bearer ${customer.accessToken}`)
        .send({
          startAt: bookable.startAt.toISOString(),
          endAt: bookable.endAt.toISOString(),
          quantity: 1,
        }),
      request(app.getHttpServer())
        .post(`/api/v1/bookables/${bookable.id}/reservations`)
        .set("Authorization", `Bearer ${secondCustomer.accessToken}`)
        .send({
          startAt: bookable.startAt.toISOString(),
          endAt: bookable.endAt.toISOString(),
          quantity: 1,
        }),
    ]);
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(1);
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
        name: "Reservation Organization",
        slug: `reservation-org-${Date.now()}`,
        timezone: "Africa/Lagos",
      })
      .expect(201);
    return response.body.id;
  }

  async function createBookable(
    options: {
      organizationId?: string;
      capacity?: number;
      status?: BookableStatus;
      confirmationPolicy?: ConfirmationPolicy;
      price?: number;
      currency?: string;
      durationMode?: DurationMode;
      minimumDuration?: number;
      maximumDuration?: number;
      fixedDuration?: number;
      minimumAdvanceTime?: number;
      maximumAdvanceTime?: number;
      availability?: "normal" | "split" | "none";
      exception?: "BLOCK" | "OVERRIDE";
    } = {},
  ): Promise<
    BookableSetup & { currency: string; startAtPlusThirtyMinutes: Date }
  > {
    const startAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
    startAt.setSeconds(0, 0);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
    const durationMode = options.durationMode ?? DurationMode.FLEXIBLE;
    const response = await prisma.bookable.create({
      data: {
        organizationId: options.organizationId ?? organizationId,
        name: `Reservation Bookable ${Date.now()}`,
        slug: `reservation-bookable-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        status: options.status ?? BookableStatus.PUBLISHED,
        confirmationPolicy:
          options.confirmationPolicy ?? ConfirmationPolicy.AUTOMATIC,
        capacity: options.capacity ?? 2,
        price: options.price ?? 0,
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

    if (options.availability !== "none") {
      await prisma.availabilityWindow.create({
        data: {
          bookableId: response.id,
          type: "SPECIFIC",
          startAt,
          endAt:
            options.availability === "split"
              ? new Date(startAt.getTime() + 30 * 60 * 1000)
              : endAt,
        },
      });
      if (options.availability === "split") {
        await prisma.availabilityWindow.create({
          data: {
            bookableId: response.id,
            type: "SPECIFIC",
            startAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000),
            endAt: new Date(startAt.getTime() + 3 * 60 * 60 * 1000),
          },
        });
      }
    }
    if (options.exception) {
      await prisma.availabilityException.create({
        data: {
          bookableId: response.id,
          type: options.exception,
          startAt:
            options.exception === "BLOCK"
              ? startAt
              : new Date(startAt.getTime() + 2 * 60 * 60 * 1000),
          endAt:
            options.exception === "BLOCK"
              ? new Date(startAt.getTime() + 30 * 60 * 1000)
              : new Date(startAt.getTime() + 3 * 60 * 60 * 1000),
        },
      });
    }
    return {
      id: response.id,
      organizationId,
      startAt,
      endAt,
      currency: response.currency,
      startAtPlusThirtyMinutes: new Date(startAt.getTime() + 30 * 60 * 1000),
    };
  }

  async function createReservation(
    user: Session,
    bookable: BookableSetup & { startAtPlusThirtyMinutes: Date },
    expectedStatus = 201,
    durationSeconds?: number,
    includeEndAt = true,
    customStartAt?: Date,
    customEndAt?: Date,
    quantity = 1,
  ) {
    const startAt = customStartAt ?? bookable.startAt;
    const endAt =
      customEndAt ??
      (durationSeconds
        ? new Date(startAt.getTime() + durationSeconds * 1000)
        : bookable.endAt);
    const payload: Record<string, unknown> = {
      startAt: startAt.toISOString(),
      quantity,
    };
    if (includeEndAt) payload.endAt = endAt.toISOString();
    return request(app.getHttpServer())
      .post(`/api/v1/bookables/${bookable.id}/reservations`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send(payload)
      .expect(expectedStatus);
  }
});
