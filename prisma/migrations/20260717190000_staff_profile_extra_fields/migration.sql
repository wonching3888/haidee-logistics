-- Staff profile fields for Phase 2 (empty table — safe defaults).
ALTER TABLE "staff" ADD COLUMN "payroll_category" TEXT NOT NULL DEFAULT 'salary';
ALTER TABLE "staff" ADD COLUMN "tin_number" TEXT;
ALTER TABLE "staff" ADD COLUMN "phone_number" TEXT;
ALTER TABLE "staff" ADD COLUMN "start_date" DATE;
