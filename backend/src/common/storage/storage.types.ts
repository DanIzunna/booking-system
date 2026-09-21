export type StorageProviderName = "IMAGEKIT";

export interface StorageAssetRef {
  provider: StorageProviderName;
  providerId?: string;
  providerKey: string;
  publicUrl: string;
  originalFilename?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  width?: number | null;
  height?: number | null;
}

export interface StorageUploadInput {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folder?: string;
  originalFilename?: string;
}

export interface StorageUploadAuthorization {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
  folder: string;
  fileName: string;
  maxFileSizeBytes: number;
  allowedMimeTypes: string[];
}

export interface StorageVerifyInput {
  providerId: string;
  expectedPrefix: string;
}

export class StorageVerificationError extends Error {
  constructor(message: string, readonly verifiedAsset?: StorageAssetRef) {
    super(message);
    this.name = "StorageVerificationError";
  }
}

export abstract class StorageProvider {
  abstract authorizeUpload(
    input: Omit<StorageUploadInput, "buffer">,
  ): Promise<StorageUploadAuthorization>;

  abstract verifyUpload(input: StorageVerifyInput): Promise<StorageAssetRef>;

  abstract upload(input: StorageUploadInput): Promise<StorageAssetRef>;

  abstract delete(reference: StorageAssetRef): Promise<void>;

  abstract resolveUrl(reference: StorageAssetRef): string;

  abstract isConfigured(): boolean;
}
