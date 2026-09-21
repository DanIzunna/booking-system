import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { STORAGE_PROVIDER } from "../../../common/storage/storage.module";
import {
  StorageAssetRef,
  StorageProvider,
  StorageVerificationError,
} from "../../../common/storage/storage.types";
import { OrganizationAuthorizationService } from "../../organizations/organization-authorization.service";
import { AuthorizeBookableImageDto } from "./dto/authorize-bookable-image.dto";
import { FinalizeBookableImageDto } from "./dto/finalize-bookable-image.dto";
import { ReplaceBookableImageDto } from "./dto/replace-bookable-image.dto";
import { ReorderBookableImagesDto } from "./dto/reorder-bookable-images.dto";

const MAX_BOOKABLE_IMAGES = 3;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

@Injectable()
export class BookableImagesService {
  private readonly logger = new Logger(BookableImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationAuthorization: OrganizationAuthorizationService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async authorizeUpload(userId: string, bookableId: string, input: AuthorizeBookableImageDto) {
    const bookable = await this.requireBookableMembership(userId, bookableId);
    const count = await this.prisma.bookableImage.count({ where: { bookableId } });
    if (count >= MAX_BOOKABLE_IMAGES) {
      throw new ConflictException("Bookable already has the maximum number of images");
    }

    return this.storage.authorizeUpload({
      folder: this.namespace(bookable.organizationId, bookable.id),
      fileName: input.originalFilename ?? "bookable-image",
      mimeType: input.contentType ?? "image/jpeg",
      originalFilename: input.originalFilename,
    });
  }

  async finalize(userId: string, bookableId: string, input: FinalizeBookableImageDto) {
    const bookable = await this.requireBookableMembership(userId, bookableId);
    const asset = await this.verifyAsset(bookable.organizationId, bookable.id, input.fileId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const count = await tx.bookableImage.count({ where: { bookableId } });
        if (count >= MAX_BOOKABLE_IMAGES) {
          throw new ConflictException("Bookable already has the maximum number of images");
        }
        return tx.bookableImage.create({
          data: this.imageData(bookable.organizationId, bookable.id, asset, count),
        });
      });
    } catch (error) {
      if (!isDuplicateProviderReferenceError(error)) {
        await this.cleanupProviderAsset(asset);
      }
      throw mapImagePersistenceError(error);
    }
  }

  async list(userId: string, bookableId: string) {
    await this.requireBookableMembership(userId, bookableId);
    return this.prisma.bookableImage.findMany({ where: { bookableId }, orderBy: { sortOrder: "asc" } });
  }

  async setPrimary(userId: string, bookableId: string, imageId: string) {
    const bookable = await this.requireBookableMembership(userId, bookableId);
    const image = await this.findImage(bookableId, imageId);
    this.assertImageTenant(image, bookable.organizationId);

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Bookable" WHERE "id" = ${bookableId} FOR UPDATE`;
      await tx.bookableImage.updateMany({ where: { bookableId, isPrimary: true }, data: { isPrimary: false } });
      return tx.bookableImage.update({ where: { id: imageId }, data: { isPrimary: true } });
    });
  }

  async reorder(userId: string, bookableId: string, input: ReorderBookableImagesDto) {
    const bookable = await this.requireBookableMembership(userId, bookableId);
    const images = await this.prisma.bookableImage.findMany({ where: { bookableId }, orderBy: { sortOrder: "asc" } });
    images.forEach((image) => this.assertImageTenant(image, bookable.organizationId));

    const existingIds = new Set(images.map((image) => image.id));
    const requestedIds = new Set(input.imageIds);
    if (images.length !== input.imageIds.length || requestedIds.size !== input.imageIds.length || input.imageIds.some((id) => !existingIds.has(id))) {
      throw new BadRequestException("Image order must contain exactly this Bookable's images");
    }

    return this.prisma.$transaction(async (tx) => {
      const temporaryBase = Math.max(-1, ...images.map((image) => image.sortOrder)) + images.length + 1;
      for (let index = 0; index < images.length; index += 1) {
        await tx.bookableImage.update({ where: { id: images[index].id }, data: { sortOrder: temporaryBase + index } });
      }
      for (let index = 0; index < input.imageIds.length; index += 1) {
        await tx.bookableImage.update({ where: { id: input.imageIds[index] }, data: { sortOrder: index } });
      }
      return tx.bookableImage.findMany({ where: { bookableId }, orderBy: { sortOrder: "asc" } });
    });
  }

  async replace(userId: string, bookableId: string, imageId: string, input: ReplaceBookableImageDto) {
    const bookable = await this.requireBookableMembership(userId, bookableId);
    const image = await this.findImage(bookableId, imageId);
    this.assertImageTenant(image, bookable.organizationId);
    const asset = await this.verifyAsset(bookable.organizationId, bookable.id, input.fileId);

    try {
      const updated = await this.prisma.bookableImage.update({
        where: { id: imageId },
        data: {
          provider: asset.provider,
          providerKey: asset.providerKey,
          url: asset.publicUrl,
          originalFilename: asset.originalFilename ?? null,
          mimeType: asset.mimeType as string,
          fileSizeBytes: asset.fileSizeBytes as number,
          width: asset.width as number,
          height: asset.height as number,
        },
      });
      await this.cleanupProviderAsset(imageToStorageRef(image));
      return updated;
    } catch (error) {
      await this.cleanupProviderAsset(asset);
      throw mapImagePersistenceError(error);
    }
  }

  async delete(userId: string, bookableId: string, imageId: string) {
    const bookable = await this.requireBookableMembership(userId, bookableId);
    const image = await this.findImage(bookableId, imageId);
    this.assertImageTenant(image, bookable.organizationId);

    await this.prisma.$transaction(async (tx) => {
      const remaining = await tx.bookableImage.findMany({ where: { bookableId, id: { not: imageId } }, orderBy: { sortOrder: "asc" } });
      remaining.forEach((entry) => this.assertImageTenant(entry, bookable.organizationId));
      await tx.bookableImage.delete({ where: { id: imageId } });

      const temporaryBase = Math.max(-1, ...remaining.map((entry) => entry.sortOrder)) + remaining.length + 1;
      for (let index = 0; index < remaining.length; index += 1) {
        await tx.bookableImage.update({ where: { id: remaining[index].id }, data: { sortOrder: temporaryBase + index } });
      }
      for (let index = 0; index < remaining.length; index += 1) {
        await tx.bookableImage.update({
          where: { id: remaining[index].id },
          data: { sortOrder: index, ...(image.isPrimary && index === 0 ? { isPrimary: true } : {}) },
        });
      }
    });

    await this.cleanupProviderAsset(imageToStorageRef(image));
    return { deleted: true };
  }

  private async verifyAsset(organizationId: string, bookableId: string, providerId: string) {
    let asset: StorageAssetRef;
    try {
      asset = await this.storage.verifyUpload({ providerId, expectedPrefix: this.namespace(organizationId, bookableId) });
    } catch (error) {
      if (error instanceof StorageVerificationError && error.verifiedAsset) {
        await this.cleanupProviderAsset(error.verifiedAsset);
      }
      throw new BadRequestException("Uploaded image could not be verified");
    }

    if (asset.provider !== "IMAGEKIT" || !asset.providerId || !asset.providerKey || !asset.publicUrl || !ALLOWED_MIME_TYPES.has(asset.mimeType ?? "") || !asset.fileSizeBytes || asset.fileSizeBytes > MAX_FILE_SIZE_BYTES || !asset.width || asset.width <= 0 || !asset.height || asset.height <= 0) {
      await this.cleanupProviderAsset(asset);
      throw new BadRequestException("Uploaded image does not meet the image requirements");
    }
    return asset;
  }

  private async findImage(bookableId: string, imageId: string) {
    const image = await this.prisma.bookableImage.findUnique({ where: { id: imageId } });
    if (!image || image.bookableId !== bookableId) throw new NotFoundException("Bookable image not found");
    return image;
  }

  private assertImageTenant(image: { organizationId: string }, organizationId: string) {
    if (image.organizationId !== organizationId) throw new NotFoundException("Bookable image not found");
  }

  private async requireBookableMembership(userId: string, bookableId: string) {
    const bookable = await this.prisma.bookable.findUnique({ where: { id: bookableId }, select: { id: true, organizationId: true } });
    if (!bookable) throw new NotFoundException("Bookable not found");
    await this.organizationAuthorization.requireMembership(userId, bookable.organizationId);
    return bookable;
  }

  private namespace(organizationId: string, bookableId: string) {
    return `organizations/${organizationId}/bookables/${bookableId}`;
  }

  private async cleanupProviderAsset(asset: StorageAssetRef) {
    try {
      await this.storage.delete(asset);
    } catch (error) {
      this.logger.warn(`Unable to clean up storage asset ${asset.providerId ?? asset.providerKey}: ${String(error)}`);
    }
  }

  private imageData(organizationId: string, bookableId: string, asset: StorageAssetRef, sortOrder: number): Prisma.BookableImageUncheckedCreateInput {
    return {
      bookableId,
      organizationId,
      provider: asset.provider,
      providerKey: asset.providerKey,
      url: asset.publicUrl,
      originalFilename: asset.originalFilename ?? null,
      mimeType: asset.mimeType as string,
      fileSizeBytes: asset.fileSizeBytes as number,
      width: asset.width as number,
      height: asset.height as number,
      sortOrder,
      isPrimary: sortOrder === 0,
    };
  }
}

function imageToStorageRef(image: { providerKey: string; url: string; originalFilename: string | null; mimeType: string; fileSizeBytes: number; width: number | null; height: number | null; id: string }): StorageAssetRef {
  return {
    provider: "IMAGEKIT",
    providerKey: image.providerKey,
    publicUrl: image.url,
    originalFilename: image.originalFilename ?? undefined,
    mimeType: image.mimeType,
    fileSizeBytes: image.fileSizeBytes,
    width: image.width,
    height: image.height,
  };
}

function mapImagePersistenceError(error: unknown): Error {
  if (error instanceof ConflictException || error instanceof BadRequestException) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return new ConflictException("Bookable image already exists");
  return error instanceof Error ? error : new Error("Bookable image persistence failed");
}

function isDuplicateProviderReferenceError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  return Array.isArray(target)
    ? target.includes("provider") && target.includes("providerKey")
    : typeof target === "string" &&
        target.includes("provider") &&
        target.includes("providerKey");
}
