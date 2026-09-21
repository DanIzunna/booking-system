"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PublicBookableImage } from "../../types/public-booking";

interface PublicBookableGalleryProps {
  bookableName: string;
  images: PublicBookableImage[];
}

export function PublicBookableGallery({
  bookableName,
  images,
}: PublicBookableGalleryProps) {
  const orderedImages = [...images].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  const primaryIndex = Math.max(
    0,
    orderedImages.findIndex((image) => image.isPrimary),
  );
  const [activeIndex, setActiveIndex] = useState(primaryIndex);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (lightboxIndex === null || orderedImages.length === 0) return;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
      }
      if (event.key === "ArrowLeft" && orderedImages.length > 1) {
        event.preventDefault();
        setLightboxIndex((current) =>
          current === null
            ? null
            : (current - 1 + orderedImages.length) % orderedImages.length,
        );
      }
      if (event.key === "ArrowRight" && orderedImages.length > 1) {
        event.preventDefault();
        setLightboxIndex((current) =>
          current === null ? null : (current + 1) % orderedImages.length,
        );
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, orderedImages.length]);

  useEffect(() => {
    if (
      lightboxIndex === null ||
      (orderedImages.length > 0 && lightboxIndex < orderedImages.length)
    ) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      if (orderedImages.length === 0) {
        closeLightbox();
      } else {
        setLightboxIndex(orderedImages.length - 1);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [lightboxIndex, orderedImages.length]);

  if (orderedImages.length === 0) return null;

  const safeActiveIndex = Math.min(
    Math.max(activeIndex, 0),
    orderedImages.length - 1,
  );
  const safeLightboxIndex =
    lightboxIndex === null
      ? null
      : Math.min(Math.max(lightboxIndex, 0), orderedImages.length - 1);
  const activeImage = orderedImages[safeActiveIndex];
  const lightboxImage =
    safeLightboxIndex === null ? null : orderedImages[safeLightboxIndex];

  function closeLightbox() {
    setLightboxIndex(null);
    const opener = openerRef.current;
    openerRef.current = null;
    requestAnimationFrame(() => opener?.focus());
  }

  function openLightbox(index: number, opener: HTMLButtonElement) {
    openerRef.current = opener;
    setLightboxIndex(index);
  }

  function markFailed(imageId: string) {
    setFailedImages((current) => new Set(current).add(imageId));
  }

  function renderImage(image: PublicBookableImage, className: string) {
    if (failedImages.has(image.id)) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-slate-100 px-4 text-center text-xs text-slate-500">
          Image unavailable
        </div>
      );
    }

    return (
      <Image
        src={image.url}
        alt={`${bookableName} image`}
        fill
        unoptimized
        className={className}
        onError={() => markFailed(image.id)}
      />
    );
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-[14px] border border-slate-200 bg-slate-100">
        <button
          type="button"
          className="relative block aspect-[16/9] w-full cursor-zoom-in text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-inset"
          onClick={(event) => openLightbox(safeActiveIndex, event.currentTarget)}
          aria-label={`Open ${bookableName} image ${safeActiveIndex + 1} of ${orderedImages.length}`}
        >
          {renderImage(activeImage, "object-cover")}
        </button>
      </div>
      {orderedImages.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
          {orderedImages.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className={`relative aspect-[4/3] overflow-hidden rounded-[8px] border bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 ${index === activeIndex ? "border-indigo-500 ring-1 ring-indigo-500" : "border-slate-200"}`}
              onClick={(event) => {
                setActiveIndex(index);
                openLightbox(index, event.currentTarget);
              }}
              aria-label={`View ${bookableName} image ${index + 1} of ${orderedImages.length}`}
              aria-current={index === activeIndex ? "true" : undefined}
            >
              {renderImage(image, "object-cover")}
            </button>
          ))}
        </div>
      )}

      {lightboxImage && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${bookableName} image ${safeLightboxIndex! + 1} of ${orderedImages.length}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeLightbox();
          }}
        >
          <div className="relative flex h-full w-full max-w-5xl items-center justify-center">
            <button
              ref={closeButtonRef}
              type="button"
              className="absolute right-0 top-0 z-10 inline-flex min-h-10 min-w-10 items-center justify-center rounded-[6px] bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={closeLightbox}
              aria-label="Close image viewer"
            >
              <X className="size-5" />
            </button>
            <button
              type="button"
              className="absolute left-0 z-10 inline-flex min-h-10 min-w-10 items-center justify-center rounded-[6px] bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40"
              onClick={() => setLightboxIndex((safeLightboxIndex! - 1 + orderedImages.length) % orderedImages.length)}
              disabled={orderedImages.length < 2}
              aria-label="Previous image"
            >
              <ChevronLeft className="size-6" />
            </button>
            <div className="relative h-[min(78vh,720px)] w-full">
              {renderImage(lightboxImage, "object-contain")}
            </div>
            <button
              type="button"
              className="absolute right-0 z-10 inline-flex min-h-10 min-w-10 items-center justify-center rounded-[6px] bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40"
              onClick={() => setLightboxIndex((safeLightboxIndex! + 1) % orderedImages.length)}
              disabled={orderedImages.length < 2}
              aria-label="Next image"
            >
              <ChevronRight className="size-6" />
            </button>
            <p className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
              {safeLightboxIndex! + 1} / {orderedImages.length}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
