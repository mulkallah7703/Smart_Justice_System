-- CreateEnum
CREATE TYPE "DocumentChunkEmbeddingStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "DocumentChunk" ADD COLUMN     "embeddingStatus" "DocumentChunkEmbeddingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "embeddingModel" TEXT,
ADD COLUMN     "embeddedAt" TIMESTAMP(3),
ADD COLUMN     "embeddingErrorCode" TEXT;

-- CreateIndex
CREATE INDEX "DocumentChunk_documentId_embeddingStatus_idx" ON "DocumentChunk"("documentId", "embeddingStatus");
