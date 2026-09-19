import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

interface Session {
  id: string;
  accessToken: string;
}
interface Organization {
  id: string;
}

describe("Availability engine (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: Session;
  let member: Session;
  let outsider: Session;
  let organization: Organization;
  let outsiderOrganization: Organization;
  let bookableId: string;
  let outsiderBookableId: string;
  const userIds: string[] = [];
  const organizationIds: string[] = [];
  const bookableIds: string[] = [];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL)
      throw new Error(
        "DATABASE_URL is required for availability integration tests",
      );
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

    owner = await register("availability-owner");
    member = await register("availability-member");
    outsider = await register("availability-outsider");
    organization = await createOrganization(owner, "availability-org");
    outsiderOrganization = await createOrganization(
      outsider,
      "other-availability-org",
    );
    await addMember(owner, organization.id, member.id);
    bookableId = await createBookable(
      owner,
      organization.id,
      "availability-bookable",
    );
    outsiderBookableId = await createBookable(
      outsider,
      outsiderOrganization.id,
      "other-bookable",
    );
  });

  beforeEach(async () => {
    await prisma.availabilityException.deleteMany({ where: { bookableId } });
    await prisma.availabilityWindow.deleteMany({ where: { bookableId } });
  });

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.availabilityException.deleteMany({
          where: { bookableId: { in: bookableIds } },
        });
        await prisma.availabilityWindow.deleteMany({
          where: { bookableId: { in: bookableIds } },
        });
        await prisma.bookable.deleteMany({
          where: { id: { in: bookableIds } },
        });
        await prisma.organization.deleteMany({
          where: { id: { in: organizationIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      await app?.close();
    }
  });

  it("supports OWNER CRUD and MEMBER read-only access", async () => {
    const created = await createWindow(owner, {
      type: "RECURRING",
      weekday: 1,
      startTime: "09:00",
      endTime: "17:00",
    });
    await request(app.getHttpServer())
      .get(`/api/v1/bookables/${bookableId}/availability/windows`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${bookableId}/availability/windows`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({
        type: "RECURRING",
        weekday: 1,
        startTime: "10:00",
        endTime: "11:00",
      })
      .expect(403);
    await request(app.getHttpServer())
      .patch(
        `/api/v1/bookables/${bookableId}/availability/windows/${created.id}`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ endTime: "16:00" })
      .expect(200);
    await request(app.getHttpServer())
      .delete(
        `/api/v1/bookables/${bookableId}/availability/windows/${created.id}`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(204);
  });

  it("validates recurring and specific windows", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${bookableId}/availability/windows`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        type: "RECURRING",
        weekday: 7,
        startTime: "09:00",
        endTime: "17:00",
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${bookableId}/availability/windows`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        type: "RECURRING",
        weekday: 1,
        startTime: "17:00",
        endTime: "09:00",
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${bookableId}/availability/windows`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        type: "SPECIFIC",
        startAt: "2026-10-15T13:00:00.000Z",
        endAt: "2026-10-15T12:00:00.000Z",
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${bookableId}/availability/windows`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        type: "SPECIFIC",
        startAt: "2026-10-15T09:00:00.000Z",
        endAt: "2026-10-15T13:00:00.000Z",
      })
      .expect(201);
  });

  it("evaluates recurring availability in the organization's timezone", async () => {
    await createWindow(owner, {
      type: "RECURRING",
      weekday: 1,
      startTime: "09:00",
      endTime: "17:00",
    });
    await check("2026-10-12T08:00:00.000Z", "2026-10-12T10:00:00.000Z", true);
    await check("2026-10-13T08:00:00.000Z", "2026-10-13T10:00:00.000Z", false);
    await check("2026-10-12T07:59:00.000Z", "2026-10-12T08:00:00.000Z", false);
  });

  it("evaluates specific windows and continuous coverage with half-open boundaries", async () => {
    await createWindow(owner, {
      type: "SPECIFIC",
      startAt: "2026-10-15T09:00:00.000Z",
      endAt: "2026-10-15T13:00:00.000Z",
    });
    await check("2026-10-15T10:00:00.000Z", "2026-10-15T11:00:00.000Z", true);
    await check("2026-10-15T13:00:00.000Z", "2026-10-15T14:00:00.000Z", false);

    await prisma.availabilityWindow.deleteMany({ where: { bookableId } });
    await createWindow(owner, {
      type: "SPECIFIC",
      startAt: "2026-10-15T09:00:00.000Z",
      endAt: "2026-10-15T12:00:00.000Z",
    });
    await createWindow(owner, {
      type: "SPECIFIC",
      startAt: "2026-10-15T14:00:00.000Z",
      endAt: "2026-10-15T17:00:00.000Z",
    });
    await check("2026-10-15T10:00:00.000Z", "2026-10-15T11:00:00.000Z", true);
    await check("2026-10-15T11:00:00.000Z", "2026-10-15T15:00:00.000Z", false);
  });

  it("subtracts BLOCK exceptions and adds OVERRIDE exceptions", async () => {
    await createWindow(owner, {
      type: "RECURRING",
      weekday: 1,
      startTime: "09:00",
      endTime: "17:00",
    });
    await createException(owner, {
      type: "BLOCK",
      startAt: "2026-10-12T11:00:00.000Z",
      endAt: "2026-10-12T13:00:00.000Z",
    });
    await check("2026-10-12T09:00:00.000Z", "2026-10-12T11:00:00.000Z", true);
    await check("2026-10-12T11:00:00.000Z", "2026-10-12T12:00:00.000Z", false);
    await check("2026-10-12T13:00:00.000Z", "2026-10-12T14:00:00.000Z", true);

    await createException(owner, {
      type: "OVERRIDE",
      startAt: "2026-10-17T10:00:00.000Z",
      endAt: "2026-10-17T14:00:00.000Z",
    });
    await check("2026-10-17T10:00:00.000Z", "2026-10-17T14:00:00.000Z", true);
  });

  it("rejects overlapping exceptions and protects tenant records", async () => {
    const first = await createException(owner, {
      type: "BLOCK",
      startAt: "2026-10-12T10:00:00.000Z",
      endAt: "2026-10-12T12:00:00.000Z",
    });
    await request(app.getHttpServer())
      .post(`/api/v1/bookables/${bookableId}/availability/exceptions`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        type: "OVERRIDE",
        startAt: "2026-10-12T11:00:00.000Z",
        endAt: "2026-10-12T13:00:00.000Z",
      })
      .expect(409);
    await request(app.getHttpServer())
      .get(`/api/v1/bookables/${bookableId}/availability/exceptions`)
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete(
        `/api/v1/bookables/${bookableId}/availability/exceptions/${first.id}`,
      )
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/bookables/${outsiderBookableId}/availability/windows`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(404);
  });

  async function register(label: string): Promise<Session> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
        password: "correct-horse-battery-staple",
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

  async function createOrganization(
    user: Session,
    name: string,
  ): Promise<Organization> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        name,
        slug: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timezone: "Africa/Lagos",
      })
      .expect(201);
    organizationIds.push(response.body.id);
    return response.body;
  }

  async function addMember(
    user: Session,
    organizationId: string,
    memberId: string,
  ) {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/members`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ userId: memberId })
      .expect(201);
  }

  async function createBookable(
    user: Session,
    organizationId: string,
    slug: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/bookables")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        organizationId,
        name: slug,
        slug: `${slug}-${Date.now()}`,
        capacity: 1,
        pricingType: "FREE",
      })
      .expect(201);
    bookableIds.push(response.body.id);
    return response.body.id;
  }

  async function createWindow(user: Session, input: Record<string, unknown>) {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/bookables/${bookableId}/availability/windows`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send(input)
      .expect(201);
    return response.body;
  }

  async function createException(
    user: Session,
    input: Record<string, unknown>,
  ) {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/bookables/${bookableId}/availability/exceptions`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send(input)
      .expect(201);
    return response.body;
  }

  async function check(startAt: string, endAt: string, available: boolean) {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/bookables/${bookableId}/availability/check`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .query({ startAt, endAt })
      .expect(200);
    expect(response.body.available).toBe(available);
  }
});
