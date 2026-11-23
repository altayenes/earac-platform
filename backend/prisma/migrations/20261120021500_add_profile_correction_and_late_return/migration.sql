-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PROFILE_CORRECTION_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'PROFILE_CORRECTION_REVIEWED';

-- AlterTable
ALTER TABLE "ReturnRecord" ADD COLUMN     "isLateReturn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lateMinutes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProfileCorrectionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedFirstName" TEXT,
    "requestedLastName" TEXT,
    "requestedBirthDate" DATE,
    "requestedLicenseDate" DATE,
    "requestedNationalId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileCorrectionRequest_userId_status_idx" ON "ProfileCorrectionRequest"("userId", "status");

-- AddForeignKey
ALTER TABLE "ProfileCorrectionRequest" ADD CONSTRAINT "ProfileCorrectionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
