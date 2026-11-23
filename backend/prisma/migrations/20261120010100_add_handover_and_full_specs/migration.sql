-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'VEHICLE_EXCEPTION_ASSIGNED';

-- AlterTable
ALTER TABLE "HandoverRecord" ADD COLUMN     "actualPickupAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "customerApproved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReservationChangeRequest" ADD COLUMN     "requestedFuelTypeId" TEXT,
ADD COLUMN     "requestedTransmissionTypeId" TEXT;

-- AlterTable
ALTER TABLE "ReservationPriceSnapshot" ADD COLUMN     "fuelTypeId" TEXT,
ADD COLUMN     "fuelTypeName" TEXT,
ADD COLUMN     "transmissionTypeId" TEXT,
ADD COLUMN     "transmissionTypeName" TEXT;

-- AlterTable
ALTER TABLE "ReturnRecord" ADD COLUMN     "actualReturnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
