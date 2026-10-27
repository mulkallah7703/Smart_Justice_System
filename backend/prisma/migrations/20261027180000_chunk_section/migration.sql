-- Section label for Saudi ruling chunks (منطوق / أسباب / وقائع).
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "section" TEXT;
