-- AlterTable
ALTER TABLE "drivers" ADD COLUMN "spouse_working" BOOLEAN;
ALTER TABLE "drivers" ADD COLUMN "pcb_needs_review" BOOLEAN NOT NULL DEFAULT true;
