-- Songkhla daily labor: optional total wage paid (manual total, not count × unit rate).
ALTER TABLE "thai_daily_labor_attendance"
  ADD COLUMN IF NOT EXISTS "total_wage_paid" DECIMAL(12, 2);
