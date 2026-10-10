-- AlterTable
ALTER TABLE "User" ALTER COLUMN "nationalId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
