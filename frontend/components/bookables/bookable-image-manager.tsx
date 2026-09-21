"use client";

import Image from "next/image";
import { ImagePlus, LoaderCircle, MoveLeft, MoveRight, Star, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../lib/api/client";
import {
  authorizeBookableImageUpload,
  deleteBookableImage,
  finalizeBookableImage,
  listBookableImages,
  replaceBookableImage,
  reorderBookableImages,
  setBookableImagePrimary,
} from "../../lib/api/bookable-images";
import { uploadToImageKit } from "../../lib/media/imagekit-upload";
import type { BookableImage, UploadAuthorization } from "../../types/bookable-images";
import { EmptyState } from "../empty-state";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

const MAX_IMAGES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

export function BookableImageManager({ bookableId }: { bookableId: string }) {
  const [images, setImages] = useState<BookableImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refreshImages() {
    const nextImages = await listBookableImages(bookableId);
    setImages(nextImages.sort((left, right) => left.sortOrder - right.sortOrder));
  }

  useEffect(() => {
    let cancelled = false;
    void listBookableImages(bookableId)
      .then((nextImages) => {
        if (!cancelled) setImages(nextImages.sort((left, right) => left.sortOrder - right.sortOrder));
      })
      .catch((caught) => {
        if (!cancelled) setError(errorMessage(caught, "Unable to load images."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookableId]);

  function openFilePicker(imageId?: string) {
    setReplacementId(imageId ?? null);
    setError("");
    fileInputRef.current?.click();
  }

  async function uploadSelectedFile(file: File, replaceImageId?: string) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      throw new Error("Choose a JPEG, PNG, or WebP image.");
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Images must be 5 MB or smaller.");
    }

    const authorization: UploadAuthorization = await authorizeBookableImageUpload(
      bookableId,
      {
        originalFilename: file.name,
        contentType: file.type,
        ...(replaceImageId ? { replaceImageId } : {}),
      },
    );
    const fileId = await uploadToImageKit(file, authorization);
    return { fileId, fileName: file.name };
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const currentReplacementId = replacementId;
    setActiveOperation(currentReplacementId ? `replace:${currentReplacementId}` : "upload");
    setError("");
    try {
      if (!currentReplacementId && images.length >= MAX_IMAGES) {
        throw new Error("A Bookable can have at most 3 images.");
      }
      const uploaded = await uploadSelectedFile(file, currentReplacementId ?? undefined);
      if (currentReplacementId) {
        await replaceBookableImage(bookableId, currentReplacementId, uploaded);
      } else {
        await finalizeBookableImage(bookableId, uploaded);
      }
      await refreshImages();
    } catch (caught) {
      setError(errorMessage(caught, "Unable to save this image."));
      try {
        await refreshImages();
      } catch {
        // Keep the original mutation error visible when reconciliation also fails.
      }
    } finally {
      setReplacementId(null);
      setActiveOperation(null);
    }
  }

  async function handlePrimary(imageId: string) {
    setActiveOperation(`primary:${imageId}`);
    setError("");
    try {
      await setBookableImagePrimary(bookableId, imageId);
      await refreshImages();
    } catch (caught) {
      setError(errorMessage(caught, "Unable to set the primary image."));
    } finally {
      setActiveOperation(null);
    }
  }

  async function handleReorder(imageId: string, direction: -1 | 1) {
    const currentIndex = images.findIndex((image) => image.id === imageId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= images.length) return;
    const nextIds = images.map((image) => image.id);
    [nextIds[currentIndex], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[currentIndex]];
    setActiveOperation(`reorder:${imageId}`);
    setError("");
    try {
      await reorderBookableImages(bookableId, { imageIds: nextIds });
      await refreshImages();
    } catch (caught) {
      setError(errorMessage(caught, "Unable to reorder images."));
    } finally {
      setActiveOperation(null);
    }
  }

  async function handleDelete(image: BookableImage) {
    if (!window.confirm("Delete this Bookable image?")) return;
    setActiveOperation(`delete:${image.id}`);
    setError("");
    try {
      await deleteBookableImage(bookableId, image.id);
      await refreshImages();
    } catch (caught) {
      setError(errorMessage(caught, "Unable to delete this image."));
    } finally {
      setActiveOperation(null);
    }
  }

  const busy = activeOperation !== null;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Images</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Bookable images</h2>
          <p className="mt-1 text-sm text-slate-500">Up to 3 JPEG, PNG, or WebP images. Maximum 5 MB each.</p>
        </div>
        <>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => void handleFileSelected(event)}
          />
          <Button type="button" onClick={() => openFilePicker()} disabled={busy || images.length >= MAX_IMAGES}>
            <ImagePlus className="size-4" aria-hidden="true" />
            Add image
          </Button>
        </>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-4 text-sm text-red-700" role="alert">{error}</p>}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="aspect-square" />
            <Skeleton className="aspect-square" />
            <Skeleton className="aspect-square" />
          </div>
        ) : images.length === 0 ? (
          <EmptyState
            title="No images yet"
            description="Add up to 3 images to give customers a clearer view of this Bookable."
            action={<Button type="button" onClick={() => openFilePicker()} disabled={busy}><ImagePlus className="size-4" /> Add image</Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image, index) => {
              const imageBusy = activeOperation?.endsWith(image.id) ?? false;
              return (
                <div key={image.id} className="overflow-hidden rounded-[8px] border border-slate-200 bg-white">
                  <div className="relative aspect-square bg-slate-100">
                    <Image src={image.url} alt="Bookable image" fill unoptimized className="object-cover" />
                    {image.isPrimary && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-slate-950/80 px-2 py-1 text-[11px] font-medium text-white"><Star className="size-3" fill="currentColor" /> Primary</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 p-3">
                    {!image.isPrimary && <Button type="button" variant="secondary" className="px-2.5" onClick={() => void handlePrimary(image.id)} disabled={busy}>Set primary</Button>}
                    <Button type="button" variant="ghost" className="px-2.5" onClick={() => void handleReorder(image.id, -1)} disabled={busy || index === 0} aria-label="Move image left" title="Move image left"><MoveLeft className="size-4" /></Button>
                    <Button type="button" variant="ghost" className="px-2.5" onClick={() => void handleReorder(image.id, 1)} disabled={busy || index === images.length - 1} aria-label="Move image right" title="Move image right"><MoveRight className="size-4" /></Button>
                    <Button type="button" variant="secondary" className="px-2.5" onClick={() => openFilePicker(image.id)} disabled={busy}>{imageBusy ? <LoaderCircle className="size-4 animate-spin" /> : "Replace"}</Button>
                    <Button type="button" variant="danger" className="px-2.5" onClick={() => void handleDelete(image)} disabled={busy} aria-label="Delete image" title="Delete image"><Trash2 className="size-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
