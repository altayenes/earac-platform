-- AlterEnum
BEGIN;
CREATE TYPE "ReservationState_new" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'EXPIRED', 'PAYMENT_FAILED', 'CANCELLED', 'ACTIVE', 'COMPLETED', 'NO_SHOW');
ALTER TABLE "public"."Reservation" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "Reservation" ALTER COLUMN "state" TYPE "ReservationState_new" USING ("state"::text::"ReservationState_new");
ALTER TABLE "ReservationStatusHistory" ALTER COLUMN "fromStatus" TYPE "ReservationState_new" USING ("fromStatus"::text::"ReservationState_new");
ALTER TABLE "ReservationStatusHistory" ALTER COLUMN "toStatus" TYPE "ReservationState_new" USING ("toStatus"::text::"ReservationState_new");
ALTER TYPE "ReservationState" RENAME TO "ReservationState_old";
ALTER TYPE "ReservationState_new" RENAME TO "ReservationState";
DROP TYPE "public"."ReservationState_old";
ALTER TABLE "Reservation" ALTER COLUMN "state" SET DEFAULT 'PENDING_PAYMENT';
COMMIT;

-- AlterTable
ALTER TABLE "Reservation" ALTER COLUMN "state" SET DEFAULT 'PENDING_PAYMENT';
