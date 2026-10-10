-- CreateEnum
CREATE TYPE "DocumentPageExtractionMethod" AS ENUM ('TEXT_LAYER', 'OCR');

-- CreateEnum
CREATE TYPE "DocumentPageTrust" AS ENUM ('TRUSTED', 'REVIEW_REQUIRED', 'UNUSABLE');

-- CreateTable
CREATE TABLE "DocumentPage" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "extractionMethod" "DocumentPageExtractionMethod" NOT NULL,
    "trust" "DocumentPageTrust" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "warnings" TEXT[],
    "language" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentPage_documentId_idx" ON "DocumentPage"("documentId");

-- CreateIndex
CREATE INDEX "DocumentPage_documentId_trust_idx" ON "DocumentPage"("documentId", "trust");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPage_documentId_pageNumber_key" ON "DocumentPage"("documentId", "pageNumber");

-- AddForeignKey
ALTER TABLE "DocumentPage" ADD CONSTRAINT "DocumentPage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
