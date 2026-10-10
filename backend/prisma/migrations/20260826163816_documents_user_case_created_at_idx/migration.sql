-- CreateIndex
CREATE INDEX "Document_userId_caseId_idx" ON "Document"("userId", "caseId");

-- CreateIndex
CREATE INDEX "Document_userId_createdAt_idx" ON "Document"("userId", "createdAt");
