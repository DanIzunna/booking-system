export interface BookableImage {
  id: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface UploadAuthorization {
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

export interface ReorderBookableImagesInput {
  imageIds: string[];
}

export interface ImageMutationResult {
  deleted: boolean;
}
