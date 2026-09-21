import { apiRequest } from "./client";
import type {
  BookableImage,
  ImageMutationResult,
  ReorderBookableImagesInput,
  UploadAuthorization,
} from "../../types/bookable-images";

export function authorizeBookableImageUpload(
  bookableId: string,
  input: {
    originalFilename: string;
    contentType: string;
    replaceImageId?: string;
  },
): Promise<UploadAuthorization> {
  return apiRequest<UploadAuthorization>(
    `/bookables/${encodeURIComponent(bookableId)}/images/upload-authorization`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function finalizeBookableImage(
  bookableId: string,
  input: { fileId: string; fileName: string },
): Promise<BookableImage> {
  return apiRequest<BookableImage>(
    `/bookables/${encodeURIComponent(bookableId)}/images`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function listBookableImages(bookableId: string): Promise<BookableImage[]> {
  return apiRequest<BookableImage[]>(
    `/bookables/${encodeURIComponent(bookableId)}/images`,
  );
}

export function reorderBookableImages(
  bookableId: string,
  input: ReorderBookableImagesInput,
): Promise<BookableImage[]> {
  return apiRequest<BookableImage[]>(
    `/bookables/${encodeURIComponent(bookableId)}/images/reorder`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function setBookableImagePrimary(
  bookableId: string,
  imageId: string,
): Promise<BookableImage> {
  return apiRequest<BookableImage>(
    `/bookables/${encodeURIComponent(bookableId)}/images/${encodeURIComponent(imageId)}/primary`,
    { method: "PATCH" },
  );
}

export function replaceBookableImage(
  bookableId: string,
  imageId: string,
  input: { fileId: string; fileName: string },
): Promise<BookableImage> {
  return apiRequest<BookableImage>(
    `/bookables/${encodeURIComponent(bookableId)}/images/${encodeURIComponent(imageId)}/replace`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function deleteBookableImage(
  bookableId: string,
  imageId: string,
): Promise<ImageMutationResult> {
  return apiRequest<ImageMutationResult>(
    `/bookables/${encodeURIComponent(bookableId)}/images/${encodeURIComponent(imageId)}`,
    { method: "DELETE" },
  );
}
