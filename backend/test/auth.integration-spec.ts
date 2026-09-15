import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as argon2 from "argon2";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { DEFAULT_REFRESH_COOKIE_NAME } from "../src/modules/auth/auth.constants";
import { hashRefreshToken } from "../src/modules/auth/token.utils";

const password = "correct-horse-battery-staple";

describe("Authentication & identity (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: string;
  let userId: string;
  let accessToken: string;
  let refreshCookie: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for auth integration tests");
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
  });

  afterAll(async () => {
    try {
      if (userId) {
        await prisma.user.delete({ where: { id: userId } });
      }
    } finally {
      await app?.close();
    }
  });

  it("registers a user, hashes the password, issues access credentials, and sets only a refresh cookie", async () => {
    email = `auth-${Date.now()}@example.test`;

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: ` ${email.toUpperCase()} `,
        password,
        name: "Auth Test User",
      })
      .expect(201);

    expect(response.body).toEqual({
      accessToken: expect.any(String),
      user: {
        id: expect.any(String),
        email,
        name: "Auth Test User",
        createdAt: expect.any(String),
      },
    });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${DEFAULT_REFRESH_COOKIE_NAME}=`),
      ]),
    );

    accessToken = response.body.accessToken;
    refreshCookie = extractCookie(
      response.headers["set-cookie"],
      DEFAULT_REFRESH_COOKIE_NAME,
    );
    userId = response.body.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { refreshSessions: true },
    });
    expect(user).not.toBeNull();
    expect(user?.passwordHash).not.toBe(password);
    expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
    await expect(argon2.verify(user!.passwordHash, password)).resolves.toBe(
      true,
    );
    expect(user?.refreshSessions).toHaveLength(1);
    expect(user?.refreshSessions[0].tokenHash).not.toBe(
      cookieValue(refreshCookie),
    );
    expect(user?.refreshSessions[0].tokenHash).toBe(
      hashRefreshToken(cookieValue(refreshCookie)),
    );
  });

  it("rejects duplicate email registration", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email, password, name: "Duplicate User" })
      .expect(409);
  });

  it("rejects malformed registration input", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email: "not-an-email", password: "short", name: "" })
      .expect(400);
  });

  it("rejects invalid login without revealing whether the account exists", async () => {
    const existingAccountResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: "wrong-password" })
      .expect(401);
    const missingAccountResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "missing@example.test", password: "wrong-password" })
      .expect(401);

    expect(existingAccountResponse.body.message).toBe(
      missingAccountResponse.body.message,
    );
  });

  it("allows valid login and returns safe identity data", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(201);

    expect(response.body.user).toEqual({
      id: userId,
      email,
      name: "Auth Test User",
      createdAt: expect.any(String),
    });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.body.accessToken).toEqual(expect.any(String));
  });

  it("requires authentication for /auth/me and returns safe fields", async () => {
    await request(app.getHttpServer()).get("/api/v1/auth/me").expect(401);

    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual({
      id: userId,
      email,
      name: "Auth Test User",
      createdAt: expect.any(String),
    });
    expect(response.body.passwordHash).toBeUndefined();
  });

  it("rotates refresh sessions and rejects the revoked token", async () => {
    const oldCookie = refreshCookie;
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", oldCookie)
      .expect(201);

    const newCookie = extractCookie(
      response.headers["set-cookie"],
      DEFAULT_REFRESH_COOKIE_NAME,
    );
    expect(newCookie).not.toBe(oldCookie);
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.body.accessToken).toEqual(expect.any(String));

    const sessions = await prisma.refreshSession.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    expect(sessions).toHaveLength(3);

    const presentedSession = sessions.find(
      (session) =>
        session.tokenHash === hashRefreshToken(cookieValue(oldCookie)),
    );
    const replacementSession = sessions.find(
      (session) =>
        session.tokenHash === hashRefreshToken(cookieValue(newCookie)),
    );

    expect(presentedSession?.revokedAt).not.toBeNull();
    expect(replacementSession?.revokedAt).toBeNull();
    expect(
      sessions.filter((session) => session.revokedAt === null),
    ).toHaveLength(2);

    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", oldCookie)
      .expect(401);

    refreshCookie = newCookie;
    accessToken = response.body.accessToken;
  });

  it("rejects expired refresh sessions", async () => {
    const expiredToken = "expired-token-for-auth-test";
    await prisma.refreshSession.create({
      data: {
        userId,
        tokenHash: hashRefreshToken(expiredToken),
        expiresAt: new Date(Date.now() - 1_000),
      },
    });

    const expiredCookie = `${DEFAULT_REFRESH_COOKIE_NAME}=${expiredToken}`;
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", expiredCookie)
      .expect(401);
  });

  it("revokes the current refresh session on logout", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Cookie", refreshCookie)
      .expect(201);

    const session = await prisma.refreshSession.findFirst({
      where: { tokenHash: hashRefreshToken(cookieValue(refreshCookie)) },
    });
    expect(session?.revokedAt).not.toBeNull();

    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookie)
      .expect(401);
  });
});

function cookieValue(cookie: string): string {
  return cookie.split(";")[0].split("=").slice(1).join("=");
}

function extractCookie(
  cookies: string | string[] | undefined,
  name: string,
): string {
  const values = cookies ? (Array.isArray(cookies) ? cookies : [cookies]) : [];
  const cookie = values.find((value) => value.startsWith(`${name}=`));
  if (!cookie) {
    throw new Error(`Expected ${name} cookie`);
  }
  return cookie.split(";")[0];
}
