import { Injectable } from "@nestjs/common";
import {
  StorageAssetRef,
  StorageProvider,
  StorageReplaceInput,
  StorageUploadInput,
} from "./storage.types";

export interface ImageKitStorageConfig {
  publicKey?: string;
  privateKey?: string;
  urlEndpoint?: string;
}

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
  ) {
    super();
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.publicKey && this.config.privateKey && this.config.urlEndpoint,
    );
  }

  async upload(input: StorageUploadInput): Promise<StorageAssetRef> {
    if (!this.isConfigured()) {
      throw new Error("ImageKit storage is not configured");
    }

    const providerKey = this.buildProviderKey(input.folder, input.fileName);
    return {
      provider: "IMAGEKIT",
      providerKey,
      publicUrl: this.buildPublicUrl(providerKey),
      originalFilename: input.originalFilename ?? input.fileName,
      mimeType: input.mimeType,
      fileSizeBytes: input.buffer.byteLength,
    };
  }

  async replace(
    reference: StorageAssetRef,
    input: StorageReplaceInput,
  ): Promise<StorageAssetRef> {
    await this.delete(reference);
    return this.upload(input);
  }

  async delete(reference: StorageAssetRef): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    if (!reference.providerKey) {
      return;
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
    const normalizedFolder = (folder ?? "bookables").replace(/^\/+|\/+$/g, "");
    const normalizedName = fileName.replace(/\s+/g, "-");
    return `${normalizedFolder ? `${normalizedFolder}/` : ""}${normalizedName}`;
  }

  private buildPublicUrl(providerKey: string): string {
    const baseUrl = (this.config.urlEndpoint ?? "").replace(/\/+$/, "");
    const normalizedKey = providerKey.replace(/^\/+/, "");
    return baseUrl ? `${baseUrl}/${normalizedKey}` : normalizedKey;
  }
}
