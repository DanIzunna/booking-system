import { Injectable } from "@nestjs/common";
import ImageKit, { toFile } from "@imagekit/nodejs";
import {
  StorageAssetRef,
  StorageProvider,
  StorageUploadAuthorization,
  StorageUploadInput,
  StorageVerifyInput,
  StorageVerificationError,
} from "./storage.types";

export interface ImageKitStorageConfig {
  publicKey?: string;
  privateKey?: string;
  urlEndpoint?: string;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function readImageKitStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): ImageKitStorageConfig {
  return {
    publicKey: env.IMAGEKIT_PUBLIC_KEY || undefined,
    privateKey: env.IMAGEKIT_PRIVATE_KEY || undefined,
    urlEndpoint: env.IMAGEKIT_URL_ENDPOINT || undefined,
  };
}

@Injectable()
export class ImageKitStorageProvider extends StorageProvider {
  constructor(
    private readonly config: ImageKitStorageConfig = readImageKitStorageConfig(),
    private readonly client = config.privateKey
      ? new ImageKit({ privateKey: config.privateKey })
      : undefined,
  ) {
    super();
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.publicKey && this.config.privateKey && this.config.urlEndpoint,
    );
  }

  async authorizeUpload(
    input: Omit<StorageUploadInput, "buffer">,
  ): Promise<StorageUploadAuthorization> {
    if (!this.isConfigured() || !this.client) {
      throw new Error("ImageKit storage is not configured");
    }

    const folder = normalizeFolder(input.folder ?? "bookables");
    const authentication = this.client.helper.getAuthenticationParameters();

    return {
      ...authentication,
      publicKey: this.config.publicKey as string,
      urlEndpoint: this.config.urlEndpoint as string,
      folder,
      fileName: sanitizeFilename(input.fileName),
      maxFileSizeBytes: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    };
  }

  async verifyUpload(input: StorageVerifyInput): Promise<StorageAssetRef> {
    if (!this.isConfigured() || !this.client) {
      throw new Error("ImageKit storage is not configured");
    }

    const file = await this.client.files.get(input.providerId);
    const providerKey = normalizeProviderPath(file.filePath);
    const expectedPrefix = normalizeProviderPath(input.expectedPrefix);
    const asset: StorageAssetRef = {
      provider: "IMAGEKIT",
      providerId: file.fileId ?? input.providerId,
      providerKey,
      publicUrl: file.url ?? this.buildPublicUrl(providerKey),
      originalFilename: file.name,
      mimeType: file.mime,
      fileSizeBytes: file.size,
      width: file.width,
      height: file.height,
    };

    if (!providerKey.startsWith(`${expectedPrefix}/`)) {
      throw new StorageVerificationError(
        "ImageKit asset is outside the Bookable namespace",
        asset,
      );
    }
    if (!this.isConfiguredUrl(asset.publicUrl)) {
      throw new StorageVerificationError(
        "ImageKit asset URL is outside the configured endpoint",
        asset,
      );
    }

    return asset;
  }

  async upload(input: StorageUploadInput): Promise<StorageAssetRef> {
    if (!this.isConfigured() || !this.client) {
      throw new Error("ImageKit storage is not configured");
    }
    if (!input.buffer.length) {
      throw new Error("Image upload cannot be empty");
    }
    if (input.buffer.length > MAX_UPLOAD_BYTES) {
      throw new Error("Image upload exceeds the 5 MB limit");
    }
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(input.mimeType)) {
      throw new Error("Unsupported image MIME type");
    }

    const folder = normalizeFolder(input.folder ?? "bookables");
    const fileName = sanitizeFilename(input.fileName);
    const response = await this.client.files.upload({
      file: await toFile(input.buffer, fileName),
      fileName,
      folder: `/${folder}`,
      useUniqueFileName: true,
      overwriteFile: false,
    });
    const providerKey = normalizeProviderPath(response.filePath);
    return {
      provider: "IMAGEKIT",
      providerId: response.fileId ?? providerKey,
      providerKey,
      publicUrl: this.buildPublicUrl(providerKey),
      originalFilename: response.name ?? input.originalFilename ?? fileName,
      mimeType: input.mimeType,
      fileSizeBytes: response.size,
      width: response.width,
      height: response.height,
    };
  }

  async delete(reference: StorageAssetRef): Promise<void> {
    if (!this.isConfigured() || !this.client) {
      return;
    }

    if (!reference.providerKey) {
      return;
    }

    const assets = await this.client.assets.list({
      type: "file",
      searchQuery: `path = "/${reference.providerKey}"`,
      limit: 1,
    });
    const file = assets[0];
    if (file && "fileId" in file && file.fileId) {
      await this.client.files.delete(file.fileId);
    }
  }

  resolveUrl(reference: StorageAssetRef): string {
    if (reference.publicUrl) {
      return reference.publicUrl;
    }

    if (!this.config.urlEndpoint) {
      return "";
    }

    return this.buildPublicUrl(reference.providerKey);
  }

  private buildProviderKey(folder: string | undefined, fileName: string): string {
    const normalizedFolder = normalizeFolder(folder ?? "bookables");
    const normalizedName = sanitizeFilename(fileName);
    return `${normalizedFolder ? `${normalizedFolder}/` : ""}${normalizedName}`;
  }

  private buildPublicUrl(providerKey: string): string {
    const baseUrl = (this.config.urlEndpoint ?? "").replace(/\/+$/, "");
    const normalizedKey = providerKey.replace(/^\/+/, "");
    return baseUrl ? `${baseUrl}/${normalizedKey}` : normalizedKey;
  }

  private isConfiguredUrl(publicUrl: string): boolean {
    if (!this.config.urlEndpoint) return false;

    try {
      const expected = new URL(this.config.urlEndpoint);
      const actual = new URL(publicUrl);
      const expectedPath = expected.pathname.replace(/\/+$/, "");
      return (
        actual.origin === expected.origin &&
        actual.pathname.startsWith(`${expectedPath}/`)
      );
    } catch {
      return false;
    }
  }
}

function normalizeFolder(folder: string): string {
  return folder.replace(/^\/+|\/+$/g, "").replace(/\\+/g, "/");
}

function normalizeProviderPath(path: string | undefined): string {
  return (path ?? "").replace(/^\/+/, "").replace(/\\+/g, "/");
}

function sanitizeFilename(filename: string): string {
  const basename = filename.replace(/\\/g, "/").split("/").pop() ?? "upload";
  return basename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255) || "upload";
}
