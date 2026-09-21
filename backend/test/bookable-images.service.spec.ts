import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { BookableImagesService } from "../src/modules/bookables/images/bookable-images.service";
import {
  StorageAssetRef,
  StorageVerificationError,
} from "../src/common/storage/storage.types";

const organizationId = "11111111-1111-4111-8111-111111111111";
const bookableId = "22222222-2222-4222-8222-222222222222";
const imageOneId = "33333333-3333-4333-8333-333333333333";
const imageTwoId = "44444444-4444-4444-8444-444444444444";

describe("BookableImagesService", () => {
  let prisma: any;
  let authorization: any;
  let storage: any;
  let service: BookableImagesService;

  beforeEach(() => {
    prisma = {
      bookable: { findUnique: jest.fn() },
      bookableImage: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        updateMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(async (callback) => callback(prisma)),
    };
    authorization = { requireMembership: jest.fn() };
    storage = {
      authorizeUpload: jest.fn(),
      verifyUpload: jest.fn(),
      delete: jest.fn(),
    };
    service = new BookableImagesService(prisma, authorization, storage);
    prisma.bookable.findUnique.mockResolvedValue({ id: bookableId, organizationId });
  });

  const asset = (overrides: Record<string, unknown> = {}): StorageAssetRef => ({
    provider: "IMAGEKIT",
    providerId: "imagekit-file-1",
    providerKey: `organizations/${organizationId}/bookables/${bookableId}/photo.jpg`,
    publicUrl: "https://ik.example/photo.jpg",
    originalFilename: "photo.jpg",
    mimeType: "image/jpeg",
    fileSizeBytes: 1024,
    width: 1200,
    height: 800,
    ...overrides,
  });

  it("authorizes an upload in the backend-controlled namespace", async () => {
    prisma.bookableImage.count.mockResolvedValue(0);
    storage.authorizeUpload.mockResolvedValue({ folder: "expected" });

    await service.authorizeUpload("user-1", bookableId, {
      originalFilename: "../photo.jpg",
      contentType: "image/jpeg",
    });

    expect(authorization.requireMembership).toHaveBeenCalledWith("user-1", organizationId);
    expect(storage.authorizeUpload).toHaveBeenCalledWith(expect.objectContaining({
      folder: `organizations/${organizationId}/bookables/${bookableId}`,
    }));
  });

  it("allows a new upload with two existing images", async () => {
    prisma.bookableImage.count.mockResolvedValue(2);
    storage.authorizeUpload.mockResolvedValue({ folder: "expected" });

    await expect(service.authorizeUpload("user-1", bookableId, {
      originalFilename: "third.jpg",
      contentType: "image/jpeg",
    })).resolves.toEqual({ folder: "expected" });
  });

  it("rejects a new upload when three images already exist", async () => {
    prisma.bookableImage.count.mockResolvedValue(3);

    await expect(service.authorizeUpload("user-1", bookableId, {
      originalFilename: "fourth.jpg",
      contentType: "image/jpeg",
    })).rejects.toBeInstanceOf(ConflictException);
    expect(storage.authorizeUpload).not.toHaveBeenCalled();
  });

  it.each([
    { label: "nonexistent", image: null },
    { label: "another Bookable", image: { bookableId: "other-bookable", organizationId } },
    { label: "another organization", image: { bookableId, organizationId: "other-org" } },
  ])("rejects replacement authorization for $label image IDs", async ({ image }) => {
    prisma.bookableImage.findUnique.mockResolvedValue(image);
    prisma.bookableImage.count.mockResolvedValue(3);

    await expect(service.authorizeUpload("user-1", bookableId, {
      originalFilename: "replacement.jpg",
      contentType: "image/jpeg",
      replaceImageId: imageOneId,
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.authorizeUpload).not.toHaveBeenCalled();
  });

  it.each([2, 3])("allows replacement authorization with %i existing images", async (count) => {
    prisma.bookableImage.findUnique.mockResolvedValue({
      bookableId,
      organizationId,
    });
    prisma.bookableImage.count.mockResolvedValue(count);
    storage.authorizeUpload.mockResolvedValue({
      folder: `organizations/${organizationId}/bookables/${bookableId}`,
    });

    await expect(service.authorizeUpload("user-1", bookableId, {
      originalFilename: "replacement.jpg",
      contentType: "image/jpeg",
      replaceImageId: imageOneId,
    })).resolves.toEqual({
      folder: `organizations/${organizationId}/bookables/${bookableId}`,
    });
    expect(storage.authorizeUpload).toHaveBeenCalledWith(expect.objectContaining({
      folder: `organizations/${organizationId}/bookables/${bookableId}`,
    }));
  });

  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s from verified provider metadata", async (mimeType) => {
    storage.verifyUpload.mockResolvedValue(asset({ mimeType }));
    prisma.bookableImage.count.mockResolvedValue(0);
    prisma.bookableImage.create.mockResolvedValue({ id: imageOneId });

    await service.finalize("user-1", bookableId, { fileId: "imagekit-file-1", fileName: "photo.jpg" });

    expect(prisma.bookableImage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ mimeType }),
    }));
  });

  it.each([
    { mimeType: "application/pdf" },
    { fileSizeBytes: 5 * 1024 * 1024 + 1 },
    { width: 0 },
    { height: -1 },
    { provider: "OTHER" },
  ])("rejects invalid verified asset metadata: %j", async (invalid) => {
    storage.verifyUpload.mockResolvedValue(asset(invalid));

    await expect(service.finalize("user-1", bookableId, { fileId: "imagekit-file-1", fileName: "photo.jpg" }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.bookableImage.create).not.toHaveBeenCalled();
  });

  it.each(["outside namespace", "arbitrary external URL"])("rejects provider verification failure: %s", async () => {
    storage.verifyUpload.mockRejectedValue(new Error("provider verification failed"));

    await expect(service.finalize("user-1", bookableId, { fileId: "imagekit-file-1", fileName: "photo.jpg" }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("cleans up only a provider asset whose ownership was established", async () => {
    const verified = asset({
      providerKey: "organizations/other/bookables/other/photo.jpg",
    });
    storage.verifyUpload.mockRejectedValue(
      new StorageVerificationError("outside namespace", verified),
    );

    await expect(service.finalize("user-1", bookableId, { fileId: "imagekit-file-1", fileName: "photo.jpg" }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(storage.delete).toHaveBeenCalledWith(verified);
  });

  it("cleans up a verified asset when database insertion fails", async () => {
    const verified = asset();
    storage.verifyUpload.mockResolvedValue(verified);
    prisma.$transaction.mockRejectedValue(new Error("database failure"));

    await expect(service.finalize("user-1", bookableId, { fileId: "imagekit-file-1", fileName: "photo.jpg" }))
      .rejects.toThrow("database failure");
    expect(storage.delete).toHaveBeenCalledWith(verified);
  });

  it("rejects a fourth image and cleans up the verified provider asset", async () => {
    const verified = asset();
    storage.verifyUpload.mockResolvedValue(verified);
    prisma.bookableImage.count.mockResolvedValue(3);

    await expect(service.finalize("user-1", bookableId, { fileId: "imagekit-file-1", fileName: "photo.jpg" }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(storage.delete).toHaveBeenCalledWith(verified);
  });

  it("does not delete an already-referenced provider asset after duplicate finalization", async () => {
    const verified = asset({ providerKey: "organizations/org/bookables/bookable/photo.jpg" });
    const duplicate = new Prisma.PrismaClientKnownRequestError("duplicate", {
      code: "P2002",
      clientVersion: "6.19.0",
      meta: { target: ["provider", "providerKey"] },
    });
    storage.verifyUpload.mockResolvedValue(verified);
    prisma.bookableImage.count.mockResolvedValue(1);
    prisma.bookableImage.create.mockRejectedValue(duplicate);

    await expect(service.finalize("user-1", bookableId, { fileId: "imagekit-file-1", fileName: "photo.jpg" }))
      .rejects.toBeInstanceOf(ConflictException);

    expect(storage.delete).not.toHaveBeenCalled();
    expect(prisma.bookableImage.create).toHaveBeenCalled();
    expect(prisma.bookableImage.update).not.toHaveBeenCalled();
    expect(prisma.bookableImage.delete).not.toHaveBeenCalled();
  });

  it("rejects inconsistent image organization and cross-bookable image IDs", async () => {
    prisma.bookableImage.findUnique.mockResolvedValue({ id: imageOneId, bookableId, organizationId: "other-org" });
    await expect(service.setPrimary("user-1", bookableId, imageOneId)).rejects.toBeInstanceOf(NotFoundException);

    prisma.bookableImage.findUnique.mockResolvedValue({ id: imageOneId, bookableId: "other-bookable", organizationId });
    await expect(service.delete("user-1", bookableId, imageOneId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("switches primary without changing sort order", async () => {
    prisma.bookableImage.findUnique.mockResolvedValue({ id: imageTwoId, bookableId, organizationId, isPrimary: false, sortOrder: 1 });
    prisma.bookableImage.updateMany.mockResolvedValue({ count: 1 });
    prisma.bookableImage.update.mockResolvedValue({ id: imageTwoId, isPrimary: true, sortOrder: 1 });

    await service.setPrimary("user-1", bookableId, imageTwoId);

    expect(prisma.bookableImage.update).toHaveBeenCalledWith({ where: { id: imageTwoId }, data: { isPrimary: true } });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.bookableImage.updateMany.mock.invocationCallOrder[0],
    );
  });

  it("promotes the lowest-order remaining image when deleting primary", async () => {
    const image = { id: imageOneId, bookableId, organizationId, providerKey: "one", url: "one", isPrimary: true, sortOrder: 0, originalFilename: null, mimeType: "image/jpeg", fileSizeBytes: 1, width: 1, height: 1 };
    prisma.bookableImage.findUnique.mockResolvedValue(image);
    prisma.bookableImage.findMany.mockResolvedValue([{ ...image, id: imageTwoId, isPrimary: false, sortOrder: 1 }]);

    await service.delete("user-1", bookableId, imageOneId);

    expect(prisma.bookableImage.update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: imageTwoId },
      data: expect.objectContaining({ isPrimary: true, sortOrder: 0 }),
    }));
  });

  it("replaces the existing row and preserves its identity, order, and primary state", async () => {
    const existing = { id: imageOneId, bookableId, organizationId, providerKey: "old", url: "old", isPrimary: true, sortOrder: 2, originalFilename: null, mimeType: "image/jpeg", fileSizeBytes: 1, width: 1, height: 1 };
    const verified = asset({ providerId: "imagekit-file-2", providerKey: `organizations/${organizationId}/bookables/${bookableId}/new.png`, mimeType: "image/png" });
    prisma.bookableImage.findUnique.mockResolvedValue(existing);
    storage.verifyUpload.mockResolvedValue(verified);
    prisma.bookableImage.update.mockResolvedValue({ ...existing, providerKey: verified.providerKey });

    const result = await service.replace("user-1", bookableId, imageOneId, { fileId: "imagekit-file-2", fileName: "new.png" });

    expect(result.id).toBe(imageOneId);
    expect(prisma.bookableImage.delete).not.toHaveBeenCalled();
    expect(storage.delete).toHaveBeenCalled();
  });

  it("cleans up the new asset when replacement DB update fails", async () => {
    const existing = { id: imageOneId, bookableId, organizationId, providerKey: "old", url: "old", isPrimary: true, sortOrder: 2, originalFilename: null, mimeType: "image/jpeg", fileSizeBytes: 1, width: 1, height: 1 };
    const verified = asset({ providerId: "imagekit-file-2" });
    prisma.bookableImage.findUnique.mockResolvedValue(existing);
    storage.verifyUpload.mockResolvedValue(verified);
    prisma.bookableImage.update.mockRejectedValue(new Error("database failure"));

    await expect(service.replace("user-1", bookableId, imageOneId, { fileId: "imagekit-file-2", fileName: "new.png" }))
      .rejects.toThrow("database failure");
    expect(storage.delete).toHaveBeenCalledWith(verified);
  });

  it("keeps replacement successful when old-provider cleanup fails", async () => {
    const existing = { id: imageOneId, bookableId, organizationId, providerKey: "old", url: "old", isPrimary: true, sortOrder: 2, originalFilename: null, mimeType: "image/jpeg", fileSizeBytes: 1, width: 1, height: 1 };
    const verified = asset({ providerId: "imagekit-file-2" });
    prisma.bookableImage.findUnique.mockResolvedValue(existing);
    storage.verifyUpload.mockResolvedValue(verified);
    prisma.bookableImage.update.mockResolvedValue({ ...existing, providerKey: verified.providerKey });
    storage.delete.mockRejectedValue(new Error("provider unavailable"));

    await expect(service.replace("user-1", bookableId, imageOneId, { fileId: "imagekit-file-2", fileName: "new.png" }))
      .resolves.toEqual(expect.objectContaining({ id: imageOneId }));
  });

  it("uses a temporary sort range before applying a reordered contiguous sequence", async () => {
    prisma.bookableImage.findMany.mockResolvedValue([
      { id: imageOneId, bookableId, organizationId, sortOrder: 0 },
      { id: imageTwoId, bookableId, organizationId, sortOrder: 1 },
    ]);

    await service.reorder("user-1", bookableId, { imageIds: [imageTwoId, imageOneId] });

    const updates = prisma.bookableImage.update.mock.calls;
    expect(updates[0][0].data.sortOrder).toBeGreaterThan(1);
    expect(updates[1][0].data.sortOrder).toBeGreaterThan(1);
    expect(updates.slice(-2).map(([call]: any[]) => call.data.sortOrder)).toEqual([0, 1]);
  });
});
