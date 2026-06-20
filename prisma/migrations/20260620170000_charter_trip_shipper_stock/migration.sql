-- AlterTable
ALTER TABLE "charter_trips" ADD COLUMN "shipper_id" UUID;
ALTER TABLE "charter_trips" ADD COLUMN "stock_area_note" TEXT;

-- AddForeignKey
ALTER TABLE "charter_trips" ADD CONSTRAINT "charter_trips_shipper_id_fkey" FOREIGN KEY ("shipper_id") REFERENCES "shippers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
