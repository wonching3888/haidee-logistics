-- Lindung 24 jam override + SOCSO Second Category driver flag
ALTER TABLE "drivers" ADD COLUMN "is_socso_second_category" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "driver_payroll_months" ADD COLUMN "lindung_24_jam_override" DECIMAL(10,2);

UPDATE "drivers" SET "is_socso_second_category" = true WHERE "full_name" = 'Yong Ah Fook';
