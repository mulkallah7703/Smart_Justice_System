-- CreateEnum
CREATE TYPE "AiJobType" AS ENUM ('DOCUMENT_ANALYSIS', 'OCR', 'EMBEDDING');

-- AlterTable
ALTER TABLE "AiJob" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxAttempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "pipelineVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
-- Added nullable first, then backfilled, because AiJob may already hold rows
-- created before this phase (development seed data).
ALTER TABLE "AiJob" ADD COLUMN "type" "AiJobType",
ADD COLUMN "idempotencyKey" TEXT;

UPDATE "AiJob"
SET "type" = 'DOCUMENT_ANALYSIS'
WHERE "type" IS NULL;

-- Pre-existing rows never had a derived key. A per-row value keeps the unique
-- index satisfiable without colliding with any key the application derives.
UPDATE "AiJob"
SET "idempotencyKey" = 'legacy:' || "id"
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "AiJob" ALTER COLUMN "type" SET NOT NULL,
ALTER COLUMN "idempotencyKey" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AiJob_userId_idempotencyKey_key" ON "AiJob"("userId", "idempotencyKey");
