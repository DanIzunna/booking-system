export type StorageProviderName = "IMAGEKIT";

export interface StorageAssetRef {
  provider: StorageProviderName | string;
  providerKey: string;
  publicUrl: string;
  originalFilename?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
}

export interface StorageUploadInput {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folder?: string;
  originalFilename?: string;
}

export interface StorageReplaceInput extends StorageUploadInput {
  existingKey?: string;
}

export abstract class StorageProvider {
  abstract upload(input: StorageUploadInput): Promise<StorageAssetRef>;

  abstract replace(
    reference: StorageAssetRef,
    input: StorageReplaceInput,
  ): Promise<StorageAssetRef>;

  abstract delete(reference: StorageAssetRef): Promise<void>;

  abstract resolveUrl(reference: StorageAssetRef): string;

  abstract isConfigured(): boolean;
}
