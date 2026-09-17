import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  BookableStatus,
  ConfirmationPolicy,
  DurationMode,
  PaymentStatus,
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
interface Fixture {
  bookableId: string;
  reservationId: string;
  startAt: Date;
  endAt: Date;
}

const password = "correct-horse-battery-staple";
const signature = "phase8-test-signature";

describe("Payments (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: Session;
  let customer: Session;
  let otherCustomer: Session;
  let organizationId: string;
  const userIds: string[] = [];
  const organizationIds: string[] = [];
  const bookableIds: string[] = [];
  const reservationIds: string[] = [];

  beforeAll(async () => {
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
    owner = await register("payment-owner");
    customer = await register("payment-customer");
    otherCustomer = await register("payment-other");
    organizationId = await createOrganization();
  });

  afterAll(async () => {
    try {
      await prisma.payment.deleteMany({
        where: { reservationId: { in: reservationIds } },
      });
      await prisma.reservation.deleteMany({
        where: { id: { in: reservationIds } },
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

  it("snapshots per-unit Bookable price and currency without changing with later price updates", async () => {
    const fixture = await createFixture(1000000, "NGN", customer, 3);
    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: fixture.reservationId },
    });
    expect(reservation.amount).toBe(3000000);
    expect(reservation.currency).toBe("NGN");
    await prisma.bookable.update({
      where: { id: fixture.bookableId },
      data: { price: 2000000 },
    });
    const unchanged = await prisma.reservation.findUniqueOrThrow({
      where: { id: fixture.reservationId },
    });
    expect(unchanged.amount).toBe(3000000);
  });

  it("initializes paid payment from the Reservation snapshot and is idempotent while pending", async () => {
    const fixture = await createFixture(1250, "USD", customer);
    const first = await initialize(customer, fixture.reservationId);
    expect(first.body).toEqual(
      expect.objectContaining({
        amount: 1250,
        currency: "USD",
        status: "PENDING",
      }),
    );
    const second = await initialize(customer, fixture.reservationId);
    expect(second.body.paymentId).toBe(first.body.paymentId);
    expect(second.body.providerReference).toBe(first.body.providerReference);
    expect(
      await prisma.payment.count({
        where: { reservationId: fixture.reservationId },
      }),
    ).toBe(1);
  });

  it("rejects initialization for an existing FAILED Payment", async () => {
    const fixture = await createFixture(1500, "NGN", customer);
    const initialized = await initialize(customer, fixture.reservationId);
    await prisma.payment.update({
      where: { id: initialized.body.paymentId },
      data: { status: PaymentStatus.FAILED },
    });
    await initialize(customer, fixture.reservationId, 409);
  });

  it("enforces customer ownership and does not let organization ownership bypass it", async () => {
    const fixture = await createFixture(1000, "NGN", customer);
    await request(app.getHttpServer())
      .post(`/api/v1/payments/reservations/${fixture.reservationId}/initialize`)
      .set("Authorization", `Bearer ${otherCustomer.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/payments/reservations/${fixture.reservationId}/initialize`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(404);
  });

  it("confirms a free reservation without creating a Payment", async () => {
    const fixture = await createFixture(0, "NGN", customer);
    const response = await initialize(customer, fixture.reservationId);
    expect(response.body).toEqual(
      expect.objectContaining({
        amount: 0,
        status: "SUCCEEDED",
        reservationStatus: "CONFIRMED",
      }),
    );
    expect(
      await prisma.payment.count({
        where: { reservationId: fixture.reservationId },
      }),
    ).toBe(0);
  });

  it("rejects expired, cancelled, completed, and already-succeeded payments", async () => {
    const expired = await createFixture(
      1000,
      "NGN",
      customer,
      1,
      new Date(Date.now() - 1000),
    );
    await initialize(customer, expired.reservationId, 409);
    const cancelled = await createFixture(1000, "NGN", customer);
    await prisma.reservation.update({
      where: { id: cancelled.reservationId },
      data: { status: ReservationStatus.CANCELLED },
    });
    await initialize(customer, cancelled.reservationId, 409);
    const succeeded = await createFixture(1000, "NGN", customer);
    const initialized = await initialize(customer, succeeded.reservationId);
    await webhook(
      initialized.body.providerReference,
      initialized.body.amount,
      initialized.body.currency,
    );
    await initialize(customer, succeeded.reservationId, 409);
  });

  it("processes verified successful webhooks atomically and idempotently for automatic reservations", async () => {
    const fixture = await createFixture(2000, "NGN", customer);
    const initialized = await initialize(customer, fixture.reservationId);
    const first = await webhook(
      initialized.body.providerReference,
      2000,
      "NGN",
    );
    expect(first.body).toEqual(
      expect.objectContaining({
        status: "SUCCEEDED",
        reservationStatus: "CONFIRMED",
        idempotent: false,
      }),
    );
    const second = await webhook(
      initialized.body.providerReference,
      2000,
      "NGN",
    );
    expect(second.body).toEqual(
      expect.objectContaining({ status: "SUCCEEDED", idempotent: true }),
    );
    expect(
      await prisma.payment.count({
        where: { reservationId: fixture.reservationId },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.reservation.findUniqueOrThrow({
          where: { id: fixture.reservationId },
        })
      ).status,
    ).toBe(ReservationStatus.CONFIRMED);
  });

  it("keeps approval-required paid reservations pending after payment succeeds", async () => {
    const fixture = await createFixture(
      2000,
      "NGN",
      customer,
      1,
      undefined,
      ConfirmationPolicy.REQUIRES_APPROVAL,
    );
    const initialized = await initialize(customer, fixture.reservationId);
    const response = await webhook(
      initialized.body.providerReference,
      2000,
      "NGN",
    );
    expect(response.body).toEqual(
      expect.objectContaining({
        status: "SUCCEEDED",
        idempotent: false,
      }),
    );
    expect(
      (
        await prisma.payment.findUniqueOrThrow({
          where: { reservationId: fixture.reservationId },
        })
      ).status,
    ).toBe(PaymentStatus.SUCCEEDED);
    expect(
      (
        await prisma.reservation.findUniqueOrThrow({
          where: { id: fixture.reservationId },
        })
      ).status,
    ).toBe(ReservationStatus.PENDING);
  });

  it("makes duplicate FAILED webhooks idempotent", async () => {
    const fixture = await createFixture(2500, "NGN", customer);
    const initialized = await initialize(customer, fixture.reservationId);
    const first = await webhook(
      initialized.body.providerReference,
      2500,
      "NGN",
      "FAILED",
    );
    expect(first.body).toEqual(
      expect.objectContaining({ status: "FAILED", idempotent: false }),
    );
    const second = await webhook(
      initialized.body.providerReference,
      2500,
      "NGN",
      "FAILED",
    );
    expect(second.body).toEqual(
      expect.objectContaining({ status: "FAILED", idempotent: true }),
    );
  });

  it("handles concurrent duplicate successful webhooks safely", async () => {
    const fixture = await createFixture(3000, "NGN", customer);
    const initialized = await initialize(customer, fixture.reservationId);
    const results = await Promise.all([
      webhook(initialized.body.providerReference, 3000, "NGN"),
      webhook(initialized.body.providerReference, 3000, "NGN"),
    ]);
    expect(results.every(({ status }) => status === 201)).toBe(true);
    expect(
      results.filter(({ body }) => body.idempotent === false),
    ).toHaveLength(1);
    expect(results.filter(({ body }) => body.idempotent === true)).toHaveLength(
      1,
    );
  });

  it("rolls back Payment success when Reservation confirmation fails", async () => {
    const fixture = await createFixture(4000, "NGN", customer);
    const initialized = await initialize(customer, fixture.reservationId);
    await prisma.reservation.update({
      where: { id: fixture.reservationId },
      data: { status: ReservationStatus.CANCELLED },
    });
    await webhook(
      initialized.body.providerReference,
      4000,
      "NGN",
      "SUCCEEDED",
      409,
    );
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { reservationId: fixture.reservationId },
    });
    expect(payment.status).toBe("PENDING");
  });

  it("rejects invalid signature, unknown reference, amount mismatch, and currency mismatch", async () => {
    const fixture = await createFixture(2000, "NGN", customer);
    const initialized = await initialize(customer, fixture.reservationId);
    await request(app.getHttpServer())
      .post("/api/v1/payments/webhooks/fake")
      .set("x-fake-signature", "wrong")
      .send({
        providerReference: initialized.body.providerReference,
        status: "SUCCEEDED",
        amount: 2000,
        currency: "NGN",
      })
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/payments/webhooks/fake")
      .set("x-fake-signature", signature)
      .send({
        providerReference: "unknown",
        status: "SUCCEEDED",
        amount: 2000,
        currency: "NGN",
      })
      .expect(404);
    await webhook(
      initialized.body.providerReference,
      1999,
      "NGN",
      "SUCCEEDED",
      409,
    );
    await webhook(
      initialized.body.providerReference,
      2000,
      "USD",
      "SUCCEEDED",
      409,
    );
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

  async function createOrganization(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        name: "Payment Organization",
        slug: `payment-${Date.now()}`,
        timezone: "Africa/Lagos",
      })
      .expect(201);
    organizationIds.push(response.body.id);
    return response.body.id;
  }

  async function createFixture(
    price: number,
    currency: string,
    user: Session,
    quantity = 1,
    expiresAt?: Date,
    confirmationPolicy: ConfirmationPolicy = ConfirmationPolicy.AUTOMATIC,
  ): Promise<Fixture> {
    const startAt = new Date(Date.now() + 3 * 3600 * 1000);
    startAt.setSeconds(0, 0);
    const endAt = new Date(startAt.getTime() + 3600 * 1000);
    const bookable = await prisma.bookable.create({
      data: {
        organizationId,
        name: `Payment Bookable ${Date.now()}`,
        slug: `payment-bookable-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        status: BookableStatus.PUBLISHED,
        confirmationPolicy,
        capacity: 10,
        price,
        currency,
        reservationRule: {
          create: {
            durationMode: DurationMode.FLEXIBLE,
            minimumDuration: 1,
            maximumDuration: 86400,
          },
        },
      },
    });
    bookableIds.push(bookable.id);
    await prisma.availabilityWindow.create({
      data: { bookableId: bookable.id, type: "SPECIFIC", startAt, endAt },
    });
    const response = await request(app.getHttpServer())
      .post(`/api/v1/bookables/${bookable.id}/reservations`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        quantity,
      })
      .expect(201);
    reservationIds.push(response.body.id);
    if (expiresAt)
      await prisma.reservation.update({
        where: { id: response.body.id },
        data: { expiresAt },
      });
    return {
      bookableId: bookable.id,
      reservationId: response.body.id,
      startAt,
      endAt,
    };
  }

  async function initialize(
    user: Session,
    reservationId: string,
    status = 201,
  ) {
    return request(app.getHttpServer())
      .post(`/api/v1/payments/reservations/${reservationId}/initialize`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(status);
  }

  async function webhook(
    providerReference: string,
    amount: number,
    currency: string,
    eventStatus: "SUCCEEDED" | "FAILED" = "SUCCEEDED",
    status = 201,
  ) {
    return request(app.getHttpServer())
      .post("/api/v1/payments/webhooks/fake")
      .set("x-fake-signature", signature)
      .send({ providerReference, status: eventStatus, amount, currency })
      .expect(status);
  }
});
