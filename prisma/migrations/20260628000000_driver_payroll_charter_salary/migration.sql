-- Charter fixed driver salary on payroll trips (Step 1: driver view + EPF; P&L unchanged until Step 2+3).
ALTER TABLE "driver_payroll_trips" ADD COLUMN "charter_salary" DECIMAL(10,2) NOT NULL DEFAULT 0;
