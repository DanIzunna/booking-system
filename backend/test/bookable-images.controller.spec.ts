import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AccessTokenGuard } from "../src/modules/auth/guards/access-token.guard";
import { BookableImagesController } from "../src/modules/bookables/images/bookable-images.controller";
import { BookableImagesService } from "../src/modules/bookables/images/bookable-images.service";

describe("BookableImagesController validation", () => {
  let app: INestApplication;
  const service = {
    authorizeUpload: jest.fn(),
    finalize: jest.fn(),
    list: jest.fn(),
    reorder: jest.fn(),
    setPrimary: jest.fn(),
    replace: jest.fn(),
    delete: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BookableImagesController],
      providers: [{ provide: BookableImagesService, useValue: service }],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.use((request: any, _response: unknown, next: () => void) => {
      request.user = { id: "user-1" };
      next();
    });
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true,
    }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects malformed finalization bodies before invoking the service", async () => {
    await request(app.getHttpServer())
      .post("/bookables/bookable-1/images")
      .send({ fileName: "photo.jpg", provider: "OTHER" })
      .expect(400);

    expect(service.finalize).not.toHaveBeenCalled();
  });

  it("accepts a valid opaque ImageKit file ID", async () => {
    service.finalize.mockResolvedValue({ id: "image-1" });

    await request(app.getHttpServer())
      .post("/bookables/22222222-2222-4222-8222-222222222222/images")
      .send({ fileId: "imagekit-file-opaque-01", fileName: "photo.jpg" })
      .expect(201);

    expect(service.finalize).toHaveBeenCalledWith(
      "user-1",
      "22222222-2222-4222-8222-222222222222",
      expect.objectContaining({ fileId: "imagekit-file-opaque-01" }),
    );
  });

  it("rejects malformed Bookable route UUIDs", async () => {
    await request(app.getHttpServer())
      .get("/bookables/not-a-uuid/images")
      .expect(400);
  });

  it("rejects client-controlled upload namespace fields", async () => {
    await request(app.getHttpServer())
      .post("/bookables/bookable-1/images/upload-authorization")
      .send({ organizationId: "attacker-org", folder: "attacker-folder" })
      .expect(400);

    expect(service.authorizeUpload).not.toHaveBeenCalled();
  });
});
