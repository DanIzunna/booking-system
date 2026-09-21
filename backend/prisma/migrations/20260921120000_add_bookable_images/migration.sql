DROP TABLE IF EXISTS "BookableImage";

CREATE TABLE "BookableImage" (
  "id" UUID NOT NULL,
  "bookableId" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "provider" VARCHAR(40) NOT NULL,
  "providerKey" VARCHAR(255) NOT NULL,
  "url" TEXT NOT NULL,
  "originalFilename" VARCHAR(255),
  "mimeType" VARCHAR(80) NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "sortOrder" INTEGER NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "BookableImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookableImage_bookableId_fkey"
    FOREIGN KEY ("bookableId") REFERENCES "Bookable"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookableImage_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BookableImage_bookableId_sortOrder_key"
  ON "BookableImage"("bookableId", "sortOrder");
CREATE UNIQUE INDEX "BookableImage_provider_providerKey_key"
  ON "BookableImage"("provider", "providerKey");
CREATE INDEX "BookableImage_bookableId_idx"
  ON "BookableImage"("bookableId");
CREATE INDEX "BookableImage_organizationId_idx"
  ON "BookableImage"("organizationId");
